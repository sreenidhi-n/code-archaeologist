import { readFile, stat, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve as resolvePath } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { generateText } from '../utils/watsonx.js';
import { logger } from '../utils/logger.js';

// Configurable OSV timeouts — override via env vars if network is slow.
const OSV_REQUEST_TIMEOUT = parseInt(process.env.OSV_TIMEOUT || '5000');
const OSV_OVERALL_TIMEOUT = parseInt(process.env.OSV_OVERALL_TIMEOUT || '10000');
const CVE_DATABASE_VERSION = '2026-05-02';

// Request queue for rate limiting OSV API calls
class RequestQueue {
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  
  async add(fn) {
    while (this.running >= this.concurrency) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
  }
}

const osvQueue = new RequestQueue(5); // Max 5 concurrent OSV requests

// Curated CVE list for common Java legacy dependencies.
// Last updated: 2026-05-02
// In production this would be replaced with a live OSV API call (https://osv.dev/docs/)
// — hardcoded for hackathon demo reliability and zero network dependency.
const KNOWN_MAVEN_CVES = [
  {
    groupId: 'org.apache.struts', artifactId: 'struts-core',
    affectedBelow: '1.4.0',
    cves: [
      { id: 'CVE-2014-0114', cvss: 7.5, severity: 'high', description: 'ClassLoader manipulation via ActionForm bean property allows arbitrary code execution' },
      { id: 'CVE-2016-1181', cvss: 8.1, severity: 'high', description: 'ActionServlet multipart handling RCE in some container configurations' }
    ]
  },
  {
    groupId: 'commons-collections', artifactId: 'commons-collections',
    affectedBelow: '3.2.2',
    cves: [
      { id: 'CVE-2015-6420', cvss: 9.8, severity: 'critical', description: 'Remote code execution via Java deserialization gadget chain' },
      { id: 'CVE-2015-7501', cvss: 9.8, severity: 'critical', description: 'Deserialization of untrusted data allows arbitrary code execution' }
    ]
  },
  {
    groupId: 'commons-beanutils', artifactId: 'commons-beanutils',
    affectedBelow: '1.9.4',
    cves: [
      { id: 'CVE-2019-10086', cvss: 7.3, severity: 'high', description: 'Improper access control allows class access bypass via BeanUtils' }
    ]
  },
  {
    groupId: 'commons-fileupload', artifactId: 'commons-fileupload',
    affectedBelow: '1.3.3',
    cves: [
      { id: 'CVE-2016-3092', cvss: 7.8, severity: 'high', description: 'DoS via malicious multipart upload causing excessive CPU usage' },
      { id: 'CVE-2014-0050', cvss: 7.5, severity: 'high', description: 'Infinite loop in multipart boundary handling (denial of service)' }
    ]
  },
  {
    groupId: 'log4j', artifactId: 'log4j',
    affectedBelow: '2.0.0', // all 1.x versions are affected
    cves: [
      { id: 'CVE-2019-17571', cvss: 9.8, severity: 'critical', description: 'Log4j 1.x Chainsaw/SocketServer RCE via deserialized data' },
      { id: 'CVE-2022-23302', cvss: 8.8, severity: 'high', description: 'JMSSink deserialization allows RCE in Log4j 1.x' },
      { id: 'CVE-2022-23305', cvss: 9.8, severity: 'critical', description: 'SQL injection in Log4j 1.x JDBCAppender' }
    ]
  },
  {
    groupId: 'commons-lang', artifactId: 'commons-lang',
    affectedBelow: '2.6',
    cves: [
      { id: 'CVE-2017-15708', cvss: 9.8, severity: 'critical', description: 'Remote code execution via ClassLoader in Apache Commons Lang' }
    ]
  },
  {
    groupId: 'xerces', artifactId: 'xercesImpl',
    affectedBelow: '2.12.0',
    cves: [
      { id: 'CVE-2022-23437', cvss: 6.5, severity: 'medium', description: 'Infinite loop via crafted XML input (denial of service)' }
    ]
  },
  {
    groupId: 'commons-codec', artifactId: 'commons-codec',
    affectedBelow: '1.13',
    cves: [] // no major CVEs but worth flagging as outdated
  }
];

// Curated CVE list for common npm packages.
// Last updated: 2026-05-02
// Covers high-profile vulnerabilities in widely-used packages.
const KNOWN_NPM_CVES = [
  {
    name: 'lodash',
    affectedBelow: '4.17.21',
    cves: [
      { id: 'CVE-2021-23337', cvss: 7.2, severity: 'high', description: 'Command injection via template function in lodash < 4.17.21' },
      { id: 'CVE-2020-8203', cvss: 7.4, severity: 'high', description: 'Prototype pollution via zipObjectDeep in lodash' }
    ]
  },
  {
    name: 'axios',
    affectedBelow: '1.6.0',
    cves: [
      { id: 'CVE-2023-45857', cvss: 8.8, severity: 'high', description: 'CSRF token leak via cross-origin request in axios < 1.6.0' }
    ]
  },
  {
    name: 'express',
    affectedBelow: '4.19.2',
    cves: [
      { id: 'CVE-2024-29041', cvss: 6.1, severity: 'medium', description: 'Open redirect vulnerability in Express.js < 4.19.2' }
    ]
  },
  {
    name: 'minimist',
    affectedBelow: '1.2.6',
    cves: [
      { id: 'CVE-2021-44906', cvss: 9.8, severity: 'critical', description: 'Prototype pollution in minimist < 1.2.6 allows arbitrary code execution' }
    ]
  },
  {
    name: 'node-fetch',
    affectedBelow: '2.6.7',
    cves: [
      { id: 'CVE-2022-0235', cvss: 8.8, severity: 'high', description: 'Exposure of sensitive information to an unauthorized actor via redirect in node-fetch' }
    ]
  },
  {
    name: 'serialize-javascript',
    affectedBelow: '6.0.0',
    cves: [
      { id: 'CVE-2022-25878', cvss: 9.8, severity: 'critical', description: 'Remote code execution via regex injection in serialize-javascript < 6.0.0' }
    ]
  },
  {
    name: 'moment',
    affectedBelow: '2.29.4',
    cves: [
      { id: 'CVE-2022-24785', cvss: 7.5, severity: 'high', description: 'Path traversal in moment.js locale loading allows arbitrary file read' }
    ]
  },
  {
    name: 'json5',
    affectedBelow: '2.2.2',
    cves: [
      { id: 'CVE-2022-46175', cvss: 8.8, severity: 'high', description: 'Prototype pollution in json5 < 2.2.2 via parse() function' }
    ]
  },
  {
    name: 'tough-cookie',
    affectedBelow: '4.1.3',
    cves: [
      { id: 'CVE-2023-26136', cvss: 9.8, severity: 'critical', description: 'Prototype pollution in tough-cookie < 4.1.3 via the CookieJar' }
    ]
  },
  {
    name: 'semver',
    affectedBelow: '7.5.2',
    cves: [
      { id: 'CVE-2022-25883', cvss: 7.5, severity: 'high', description: 'Regular expression denial of service (ReDoS) in semver < 7.5.2' }
    ]
  }
];

// Simple version comparison: returns true if version < threshold.
// Handles standard major.minor.patch format with qualifiers.
function isVersionBelow(version, threshold) {
  if (!version || version.includes('$')) {
    return true; // Unresolved property references treated as vulnerable
  }
  
  // Extract base version from qualifiers like -SNAPSHOT, .Final, .RELEASE
  const extractBase = (v) => {
    const match = v.match(/^(\d+(?:\.\d+)*)/);
    return match ? match[1] : v;
  };
  
  const baseVersion = extractBase(version);
  const baseThreshold = extractBase(threshold);
  
  const parse = (v) => v.split('.').map(n => parseInt(n) || 0);
  const vParts = parse(baseVersion);
  const tParts = parse(baseThreshold);
  
  for (let i = 0; i < Math.max(vParts.length, tParts.length); i++) {
    const v = vParts[i] || 0;
    const t = tParts[i] || 0;
    if (v < t) return true;
    if (v > t) return false;
  }
  
  // If base versions equal, check if it's a snapshot (less stable than release)
  if (version.toLowerCase().includes('snapshot')) return true;
  
  return false; // equal = not below threshold
}

// In-memory OSV cache with TTL — avoids duplicate network calls and stale data.
const OSV_CACHE = new Map(); // key → { data, timestamp }
const OSV_CACHE_TTL = 3600000; // 1 hour

// Query OSV.dev for a single package/version with rate limiting and cache TTL.
// Returns array of CVE-shaped objects, or throws on network failure/timeout.
async function queryOSVSingle(name, version, ecosystem) {
  const cacheKey = `${name}@${version}:${ecosystem}`;
  const cached = OSV_CACHE.get(cacheKey);
  
  // Check cache with TTL
  if (cached && (Date.now() - cached.timestamp) < OSV_CACHE_TTL) {
    return cached.data;
  }

  // Use request queue to limit concurrent requests
  return osvQueue.add(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OSV_REQUEST_TIMEOUT);

    try {
      const response = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, package: { name, ecosystem } }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`OSV API ${response.status}`);

      const data = await response.json();
      const cveEntries = [];

      for (const vuln of (data.vulns || [])) {
        const cveId = vuln.aliases?.find(a => a.startsWith('CVE-')) || vuln.id;
        const rawSeverity = (vuln.database_specific?.severity || 'MEDIUM').toUpperCase();
        const severityMap = {
          CRITICAL: { label: 'critical', cvss: 9.5 },
          HIGH:     { label: 'high',     cvss: 7.5 },
          MODERATE: { label: 'medium',   cvss: 5.5 },
          MEDIUM:   { label: 'medium',   cvss: 5.5 },
          LOW:      { label: 'low',      cvss: 3.5 }
        };
        const { label: severity, cvss } = severityMap[rawSeverity] || { label: 'medium', cvss: 5.0 };

        let fixVersion = null;
        outer: for (const affected of (vuln.affected || [])) {
          for (const range of (affected.ranges || [])) {
            const fixEvent = (range.events || []).find(e => e.fixed);
            if (fixEvent) { fixVersion = fixEvent.fixed; break outer; }
          }
        }

        cveEntries.push({
          id: cveId,
          cvss,
          severity,
          description: vuln.summary || `Vulnerability in ${name}`,
          fixVersion: fixVersion || 'latest'
        });
      }

      OSV_CACHE.set(cacheKey, { data: cveEntries, timestamp: Date.now() });
      return cveEntries;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  });
}

// Check all dependencies against the live OSV feed in parallel.
// Returns same {cveFlags, outdatedFlags} shape as the offline checkers.
async function checkOSVCVEs(dependencies, ecosystem) {
  const queries = dependencies.map(dep => {
    const name = ecosystem === 'Maven'
      ? `${dep.groupId}:${dep.artifactId}`
      : (dep.name || dep.artifactId);
    const version = dep.version;
    if (!version || version.includes('$') || version.toLowerCase().includes('snapshot')) {
      return Promise.resolve({ dep, cves: [] });
    }
    return queryOSVSingle(name, version, ecosystem)
      .then(cves => ({ dep, cves }))
      .catch(() => ({ dep, cves: [] })); // per-package failure is non-fatal
  });

  const results = await Promise.all(queries);
  const cveFlags = [];
  const outdatedFlags = [];
  const seen = new Set();

  for (const { dep, cves } of results) {
    for (const cve of cves) {
      const depLabel = ecosystem === 'Maven'
        ? `${dep.groupId}:${dep.artifactId}:${dep.version || 'unspecified'}`
        : `${dep.name || dep.artifactId}:${dep.version || 'unspecified'}`;
      const dedupeKey = `${depLabel}:${cve.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      cveFlags.push({ dependency: depLabel, ...cve });
    }
    if (cves.length > 0 && dep.version) {
      const depKey = ecosystem === 'Maven'
        ? `${dep.artifactId}:${dep.version}`
        : `${dep.name}:${dep.version}`;
      const worst = cves.reduce((max, c) => c.cvss > max.cvss ? c : max, cves[0]);
      outdatedFlags.push({
        dependency: depKey,
        safeVersion: cves.find(c => c.fixVersion && c.fixVersion !== 'latest')?.fixVersion || 'latest',
        severity: worst.severity
      });
    }
  }

  return { cveFlags, outdatedFlags };
}

// Async version avoids blocking the event loop on slow/NFS filesystems.
// Gradle detection removed — parsing is not implemented, so detecting it misleads callers.
async function detectBuildSystem(repoPath) {
  const check = (file) => access(join(repoPath, file)).then(() => true).catch(() => false);
  const [hasPom, hasPackage, hasRequirements, hasSetup] = await Promise.all([
    check('pom.xml'),
    check('package.json'),
    check('requirements.txt'),
    check('setup.py')
  ]);
  if (hasPom) return 'maven';
  if (hasPackage) return 'npm';
  if (hasRequirements || hasSetup) return 'python';
  return 'unknown';
}

async function parsePomXml(pomPath) {
  const MAX_POM_SIZE = 10 * 1024 * 1024; // 10MB
  const fileStat = await stat(pomPath);
  if (fileStat.size > MAX_POM_SIZE) {
    throw new Error(`pom.xml too large to parse (${Math.round(fileStat.size / 1024 / 1024)}MB)`);
  }

  const xml = await readFile(pomPath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === 'dependency' || name === 'module',
    processEntities: false,      // SECURITY: Prevents XXE attacks
    htmlEntities: false,         // SECURITY: Prevents HTML entity expansion DoS
    ignoreDeclaration: true,
    parseTagValue: false,        // SECURITY: Prevents type coercion attacks
    parseAttributeValue: false,
    trimValues: true,
  });
  const doc = parser.parse(xml);
  const project = doc.project || {};

  const extractDeps = (depsNode) => {
    if (!depsNode?.dependency) return [];
    return depsNode.dependency
      .filter(d => d.groupId && d.artifactId)
      .map(d => ({
        groupId: String(d.groupId).trim(),
        artifactId: String(d.artifactId).trim(),
        version: d.version ? String(d.version).trim() : null,
        scope: d.scope ? String(d.scope).trim() : 'compile',
        versionSource: d.version ? 'explicit' : 'inherited'
      }));
  };

  const deps = [
    ...extractDeps(project.dependencies),
    ...extractDeps(project.dependencyManagement?.dependencies)
  ];

  const modules = (project.modules?.module || []).map(m => String(m).trim());
  const parentVersion = project.parent?.version ? String(project.parent.version).trim() : null;
  const projectVersion = project.version ? String(project.version).trim() : parentVersion;

  return { deps, modules, projectVersion, artifactId: project.artifactId };
}

async function collectAllDependencies(repoPath, buildFilePath) {
  const rootPom = buildFilePath || join(repoPath, 'pom.xml');
  const allDeps = new Map(); // `groupId:artifactId` → dep object

  const processPom = async (pomPath, visited = new Set()) => {
    const normalizedPath = resolvePath(pomPath);
    if (visited.has(normalizedPath)) {
      logger.warn('Circular module reference detected', { path: normalizedPath });
      return;
    }
    if (!existsSync(normalizedPath)) return;
    if (visited.size >= 100) {
      logger.error('Module depth limit exceeded — possible circular reference', { depth: visited.size });
      return;
    }
    visited.add(normalizedPath);
    try {
      const { deps, modules } = await parsePomXml(normalizedPath);
      for (const dep of deps) {
        const key = `${dep.groupId}:${dep.artifactId}`;
        if (!allDeps.has(key) || (dep.version && !allDeps.get(key).version)) {
          allDeps.set(key, dep);
        }
      }
      for (const mod of modules) {
        const modulePom = join(normalizedPath, '..', mod, 'pom.xml');
        await processPom(modulePom, visited);
      }
    } catch (e) {
      logger.warn(`Could not parse pom.xml`, { error: e.message });
    }
  };

  await processPom(rootPom);
  return [...allDeps.values()];
}

function checkMavenCVEs(dependencies) {
  const cveFlags = [];
  const outdatedFlags = [];

  for (const dep of dependencies) {
    const entry = KNOWN_MAVEN_CVES.find(
      e => e.groupId === dep.groupId && e.artifactId === dep.artifactId
    );
    if (!entry) continue;

    const isVulnerable = isVersionBelow(dep.version, entry.affectedBelow);
    if (!isVulnerable) continue;

    for (const cve of entry.cves) {
      cveFlags.push({
        dependency: `${dep.groupId}:${dep.artifactId}:${dep.version || 'unspecified'}`,
        ...cve,
        fixVersion: entry.affectedBelow
      });
    }

    if (dep.version) {
      outdatedFlags.push({
        dependency: `${dep.artifactId}:${dep.version}`,
        safeVersion: entry.affectedBelow,
        severity: entry.cves.length > 0
          ? entry.cves.reduce((max, c) => c.cvss > max ? c.cvss : max, 0) >= 9 ? 'critical' : 'high'
          : 'medium'
      });
    }
  }

  return { cveFlags, outdatedFlags };
}

// Extract a comparable version from an npm version range string.
// Handles: ^/~/>=/>/<= prefixes, npm aliases (npm:pkg@ver), x-ranges (1.2.x).
function parseNpmVersion(versionRange) {
  if (!versionRange) return versionRange;
  // npm alias: "npm:other-package@1.2.3" → extract version after last @
  if (versionRange.startsWith('npm:')) {
    versionRange = versionRange.split('@').pop();
  }
  // Extract first full semver from complex ranges like ">=1.2.3 <2.0.0"
  const semverMatch = versionRange.match(/(\d+\.\d+\.\d+)/);
  if (semverMatch) return semverMatch[1];
  // x-ranges: "1.2.x" → "1.2.0"
  const xMatch = versionRange.match(/^(\d+\.\d+)\.x/);
  if (xMatch) return `${xMatch[1]}.0`;
  // Fallback: strip leading non-numeric prefix, take first token
  return versionRange.replace(/^[^0-9]*/, '').split(' ')[0] || versionRange;
}

// Parse package.json for npm dependencies (direct + devDependencies)
async function parsePackageJson(pkgPath) {
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw);
  const deps = [];
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, versionRange] of Object.entries(allDeps)) {
    const version = parseNpmVersion(versionRange);
    deps.push({ name, version, raw: versionRange });
  }
  return deps;
}

function checkNpmCVEs(npmDeps) {
  const cveFlags = [];
  const outdatedFlags = [];

  for (const dep of npmDeps) {
    const entry = KNOWN_NPM_CVES.find(e => e.name === dep.name);
    if (!entry) continue;

    const isVulnerable = isVersionBelow(dep.version, entry.affectedBelow);
    if (!isVulnerable) continue;

    for (const cve of entry.cves) {
      cveFlags.push({
        dependency: `${dep.name}:${dep.version || 'unspecified'}`,
        ...cve,
        fixVersion: entry.affectedBelow
      });
    }

    if (dep.version) {
      outdatedFlags.push({
        dependency: `${dep.name}:${dep.version}`,
        safeVersion: entry.affectedBelow,
        severity: entry.cves.length > 0
          ? entry.cves.reduce((max, c) => c.cvss > max ? c.cvss : max, 0) >= 9 ? 'critical' : 'high'
          : 'medium'
      });
    }
  }

  return { cveFlags, outdatedFlags };
}

// Single-pass risk analysis — avoids iterating cveFlags multiple times across callers.
function analyzeRisk(cveFlags) {
  let score = 0;
  let criticalCount = 0;
  let highCount = 0;
  let worst = null;
  for (const cve of cveFlags) {
    if (cve.severity === 'critical') { score += 3; criticalCount++; }
    else if (cve.severity === 'high') { score += 1.5; highCount++; }
    else if (cve.severity === 'medium') score += 0.5;
    if (!worst || cve.cvss > worst.cvss) worst = cve;
  }
  return { score: Math.min(10, Math.round(score * 10) / 10), criticalCount, highCount, worst };
}

function calculateRiskScore(cveFlags) {
  return analyzeRisk(cveFlags).score;
}

function buildTemplateNarrative(deps, cveFlags, riskScore) {
  const { criticalCount, highCount, worst } = analyzeRisk(cveFlags);

  let n = `This dependency tree contains ${deps.length} dependencies with a risk score of ${riskScore}/10.`;
  if (criticalCount > 0) {
    n += ` ${criticalCount} critical CVE${criticalCount !== 1 ? 's' : ''} were detected`;
    if (worst) n += `, including ${worst.id} (CVSS ${worst.cvss}) in ${worst.dependency.split(':')[1]}`;
    n += '.';
  }
  if (highCount > 0) {
    n += ` An additional ${highCount} high-severity vulnerabilit${highCount !== 1 ? 'ies' : 'y'} require attention.`;
  }
  n += ' Immediate dependency upgrades are required before any production deployment.';
  return n;
}

export async function dependencyGrapher({ repoPath, buildFilePath }) {
  const start = Date.now();
  logger.info('Dependency Grapher starting', { repoPath });

  const _cveDatabaseAgeDays = Math.round((Date.now() - new Date(CVE_DATABASE_VERSION).getTime()) / 86400000);
  if (_cveDatabaseAgeDays > 90) {
    logger.warn('Offline CVE database may be stale', { version: CVE_DATABASE_VERSION, ageDays: _cveDatabaseAgeDays });
  }

  try {
    const buildSystem = await detectBuildSystem(repoPath);
    logger.info('Build system detected', { buildSystem });

    let dependencies = [];
    let cveFlags = [];
    let outdatedFlags = [];
    let cveSource = 'offline';

    if (buildSystem === 'maven') {
      dependencies = await collectAllDependencies(repoPath, buildFilePath);
      // Try live OSV feed first — falls back to hardcoded list if network unavailable
      try {
        const osvResult = await Promise.race([
          checkOSVCVEs(dependencies, 'Maven'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OSV overall timeout')), OSV_OVERALL_TIMEOUT))
        ]);
        cveFlags = osvResult.cveFlags;
        outdatedFlags = osvResult.outdatedFlags;
        cveSource = 'osv';
        logger.info('OSV live CVE check succeeded', { cveCount: cveFlags.length });
      } catch (err) {
        logger.warn('OSV live check failed, using offline list', { error: err.message });
        const fallback = checkMavenCVEs(dependencies);
        cveFlags = fallback.cveFlags;
        outdatedFlags = fallback.outdatedFlags;
      }
    } else if (buildSystem === 'npm') {
      const pkgPath = buildFilePath || join(repoPath, 'package.json');
      const npmDeps = await parsePackageJson(pkgPath);
      // Map to a common shape for display
      dependencies = npmDeps.map(d => ({ groupId: 'npm', artifactId: d.name, version: d.version, scope: 'compile' }));
      try {
        const osvResult = await Promise.race([
          checkOSVCVEs(npmDeps, 'npm'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OSV overall timeout')), OSV_OVERALL_TIMEOUT))
        ]);
        cveFlags = osvResult.cveFlags;
        outdatedFlags = osvResult.outdatedFlags;
        cveSource = 'osv';
        logger.info('OSV live CVE check succeeded', { cveCount: cveFlags.length });
      } catch (err) {
        logger.warn('OSV live check failed, using offline list', { error: err.message });
        const fallback = checkNpmCVEs(npmDeps);
        cveFlags = fallback.cveFlags;
        outdatedFlags = fallback.outdatedFlags;
      }
    } else {
      logger.warn('Unsupported build system — CVE detection skipped', { buildSystem });
    }

    const riskScore = calculateRiskScore(cveFlags);

    const result = {
      repoPath,
      buildSystem,
      buildFile: buildFilePath || join(repoPath, buildSystem === 'npm' ? 'package.json' : 'pom.xml'),
      totalDependencies: dependencies.length,
      dependencies,
      outdatedFlags,
      cveFlags,
      riskScore,
      cveSource
    };

    // WatsonX narrative — falls back to template if unavailable
    const prompt = `You are a security-conscious code archaeologist. Given this dependency analysis of a legacy codebase, write a 3-4 sentence risk assessment. Focus on the most critical vulnerabilities, the overall health of the dependency tree, and what a new developer should be careful about.

Analysis:
${JSON.stringify({
  buildSystem,
  totalDependencies: dependencies.length,
  criticalCVEs: cveFlags.filter(c => c.severity === 'critical').map(c => ({ id: c.id, cvss: c.cvss, dep: c.dependency })),
  highCVEs: cveFlags.filter(c => c.severity === 'high').map(c => ({ id: c.id, cvss: c.cvss, dep: c.dependency })),
  riskScore
}, null, 2)}

Be specific about which dependencies are dangerous and why. Prioritize actionable warnings. 3-4 sentences only.`;

    const aiNarrative = await generateText(prompt, { maxTokens: 200 }).catch((err) => {
      logger.warn('WatsonX risk narrative failed, using template fallback', { error: err.message });
      return null;
    });
    result.riskNarrative = aiNarrative?.trim() || buildTemplateNarrative(dependencies, cveFlags, riskScore);
    result.narrativeSource = aiNarrative ? 'watsonx' : 'template';

    logger.info('Dependency Grapher completed', {
      duration: `${Date.now() - start}ms`,
      totalDependencies: dependencies.length,
      cveCount: cveFlags.length,
      riskScore,
      narrativeSource: result.narrativeSource
    });

    return result;

  } catch (error) {
    logger.error('Dependency Grapher failed', { error: error.message, repoPath });
    throw error;
  }
}

// Allows excavateRepo to clear the OSV cache between successive excavations.
export function clearOSVCache() { OSV_CACHE.clear(); }
