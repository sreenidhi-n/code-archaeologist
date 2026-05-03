import { writeFile, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { spawn } from 'child_process';
import { generateText } from '../utils/watsonx.js';
import { logger } from '../utils/logger.js';

// Sanitize a filename for use in find -name: strip path separators and glob chars
// so the argument matches exactly one name and cannot be used for path injection.
function sanitizeFilename(str) {
  return basename(str).replace(/[*?[\]{}()!]/g, '_');
}

// Try to locate a file by name when the exact git-history path doesn't exist.
// Repos restructure their directory layout over time — this handles that gracefully.
function findFileByName(repoPath, filename) {
  const safeName = sanitizeFilename(filename);
  return new Promise((resolve) => {
    const proc = spawn('find', [repoPath, '-name', safeName, '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*', '-not', '-path', '*/target/*'], {
      stdio: ['ignore', 'pipe', 'ignore']
    });
    let output = '';
    proc.stdout.on('data', chunk => { output += chunk.toString(); });
    proc.on('close', () => {
      const found = output.trim().split('\n').filter(Boolean)[0] || null;
      resolve(found);
    });
    proc.on('error', () => resolve(null));
    setTimeout(() => { proc.kill(); resolve(null); }, 5000);
  });
}

// Maps Maven groupId (or artifactId for legacy commons-* packages) to Java package path prefix.
// Used to detect whether an orphaned file lives in a CVE-affected module.
const MAVEN_PACKAGE_PATHS = {
  'commons-collections': 'org/apache/commons/collections',
  'commons-beanutils':   'org/apache/commons/beanutils',
  'commons-fileupload':  'org/apache/commons/fileupload',
  'commons-lang':        'org/apache/commons/lang',
  'commons-codec':       'org/apache/commons/codec',
  'xerces':              'org/apache/xerces',
  'log4j':               'org/apache/log4j',
};

// Derive the Java source-path prefix from a Maven dep string (groupId:artifactId:version).
function getPackagePath(depString) {
  const parts = depString.split(':');
  const groupId = parts[0] || '';
  const artifactId = parts[1] || '';
  if (MAVEN_PACKAGE_PATHS[groupId])    return MAVEN_PACKAGE_PATHS[groupId];
  if (MAVEN_PACKAGE_PATHS[artifactId]) return MAVEN_PACKAGE_PATHS[artifactId];
  if (groupId.includes('.'))           return groupId.replace(/\./g, '/');
  return null;
}

// Find files that are BOTH orphaned (from Knowledge Obituaries) AND either
// (a) live in a CVE-affected package's source path, or
// (b) import/use a CVE-affected package (import scanning).
// Third-party CVEs (commons-collections, log4j) live outside the repo, so path
// matching alone never fires — import scanning is the productive path.
async function crossRefCvesAndOrphans(gitResult, depResult, repoPath) {
  const obituaries = gitResult?.knowledgeObituaries || [];
  const cveFlags = depResult?.cveFlags || [];
  if (obituaries.length === 0 || cveFlags.length === 0) return [];

  // Build a map of package path → {importPattern, cve} for each CVE dependency
  const cvePackages = [];
  const seenDep = new Set();
  for (const cve of cveFlags) {
    const pkgPath = getPackagePath(cve.dependency);
    if (!pkgPath) continue;
    if (seenDep.has(pkgPath)) continue;
    seenDep.add(pkgPath);
    cvePackages.push({
      pkgPath,
      importPattern: pkgPath.replace(/\//g, '.'), // e.g. org.apache.commons.collections
      cve
    });
  }
  if (cvePackages.length === 0) return [];

  const intersections = [];
  const seenFile = new Set();

  for (const obituary of obituaries) {
    // Limit to top 5 orphaned files per obituary to keep this fast
    const filesToCheck = (obituary.orphanedFiles || []).slice(0, 5);
    const daysSince = Math.round((Date.now() - new Date(obituary.lastActive).getTime()) / 86400000);

    for (const filePath of filesToCheck) {
      if (seenFile.has(filePath)) continue;

      // Fast path: does the file path itself live under a CVE package?
      const normalizedPath = filePath.replace(/\\/g, '/');
      let matchedCve = null;
      for (const { pkgPath, cve } of cvePackages) {
        if (normalizedPath.includes(pkgPath)) { matchedCve = cve; break; }
      }

      // Slow path: read the file and scan for import statements
      if (!matchedCve && repoPath) {
        let resolvedPath = join(repoPath, filePath);
        if (!existsSync(resolvedPath)) {
          const found = await findFileByName(repoPath, basename(filePath));
          if (found) resolvedPath = found;
        }
        if (existsSync(resolvedPath)) {
          try {
            const content = await readFile(resolvedPath, 'utf-8');
            // Only scan import block — first 80 lines
            const importBlock = content.split('\n').slice(0, 80).join('\n');
            for (const { importPattern, cve } of cvePackages) {
              if (importBlock.includes(`import ${importPattern}`)) {
                matchedCve = cve;
                break;
              }
            }
          } catch { /* skip unreadable */ }
        }
      }

      if (matchedCve) {
        seenFile.add(filePath);
        intersections.push({
          file: filePath,
          contributor: obituary.contributor,
          lastActive: obituary.lastActive,
          yearsGone: obituary.yearsGone,
          daysSince,
          cve: matchedCve,
          allCves: cvePackages.filter(cp => cp.cve.dependency === matchedCve.dependency).map(cp => cp.cve),
        });
      }
    }
  }

  return intersections.sort((a, b) => b.cve.cvss - a.cve.cvss);
}

// Send the top 3 critical intersections to WatsonX for urgent advisories.
// Returns the input array enriched with an `advisory` and `advisorySource` field.
async function generateCrossRefAdvisories(intersections) {
  if (intersections.length === 0) return [];
  const top3 = intersections.slice(0, 3);

  const prompt = `These files are the "perfect storm" of legacy technical debt — they contain code from known CVE-vulnerable packages AND have been orphaned by departed developers with no successor. Write a 2-sentence urgent advisory for each file below. Be direct and specific. Label each advisory with just the filename.

${top3.map((i, idx) => `File ${idx + 1}: ${basename(i.file)}
Path: ${i.file}
CVE: ${i.cve.id} (${i.cve.severity.toUpperCase()}, CVSS ${i.cve.cvss}) — ${i.cve.description}
Last touched by: ${i.contributor}, ${i.daysSince} days ago (departed ${i.lastActive})
Status: Zero commits since departure — no successor identified`).join('\n\n')}

Format: one advisory paragraph per file, separated by blank lines.`;

  const aiResult = await generateText(prompt, { maxTokens: 350 }).catch(() => null);

  if (aiResult) {
    const paragraphs = aiResult.trim().split(/\n\n+/).filter(p => p.trim().length > 20);
    return top3.map((i, idx) => ({
      ...i,
      advisory: paragraphs[idx]?.trim() || buildTemplateAdvisory(i),
      advisorySource: paragraphs[idx] ? 'watsonx' : 'template'
    }));
  }

  return top3.map(i => ({ ...i, advisory: buildTemplateAdvisory(i), advisorySource: 'template' }));
}

function buildTemplateAdvisory(i) {
  return `${basename(i.file)} contains ${i.cve.id} (CVSS ${i.cve.cvss}) — ${i.cve.description.toLowerCase()} — and has not been touched in ${i.yearsGone} years since ${i.contributor} departed. This file represents critical risk: a known exploitable vulnerability in code with no active maintainer and no institutional memory.`;
}

// Build the modernization roadmap directly from real CVE + outdated data.
// More accurate than asking an AI to guess.
function buildRoadmap(gitResult, depResult) {
  const critical = [];
  const high = [];
  const medium = [];
  const low = [];

  // Critical: CVEs with CVSS >= 9
  for (const cve of (depResult?.cveFlags || [])) {
    if (cve.cvss >= 9) {
      critical.push(`Fix ${cve.id} (CVSS ${cve.cvss}) in ${cve.dependency.split(':')[1]} → upgrade to ${cve.fixVersion}+`);
    } else if (cve.cvss >= 7) {
      high.push(`Fix ${cve.id} (CVSS ${cve.cvss}) in ${cve.dependency.split(':')[1]} → upgrade to ${cve.fixVersion}+`);
    } else {
      medium.push(`Address ${cve.id} in ${cve.dependency.split(':')[1]}`);
    }
  }

  // High: bus factor risk
  const bf = gitResult?.busFactorAnalysis;
  if (bf?.busFactorNumber <= 2) {
    high.push(`Bus factor ${bf.busFactorNumber}: document all implicit knowledge held by top contributors before it is lost`);
  }

  // High: abandoned top contributor knowledge
  const top = gitResult?.topContributors?.[0];
  if (top) {
    const lastYear = parseInt(top.lastActive?.substring(0, 4) || '0');
    const yearsGone = new Date().getFullYear() - lastYear;
    if (yearsGone > 5) {
      high.push(`${top.name} (${top.percentOfTotal}% of commits) has been gone ${yearsGone} years — map their code areas before any major refactor`);
    }
  }

  // Medium: outdated deps with no CVE
  const allCveDeps = new Set((depResult?.cveFlags || []).map(c => c.dependency.split(':')[0] + ':' + c.dependency.split(':')[1]));
  for (const flag of (depResult?.outdatedFlags || [])) {
    const depKey = flag.dependency.split(':')[0];
    if (!allCveDeps.has(depKey)) {
      medium.push(`Upgrade ${flag.dependency} → ${flag.safeVersion}+`);
    }
  }

  // Medium: high-churn files need documentation
  const churnFiles = gitResult?.highChurnFiles?.slice(0, 3) || [];
  if (churnFiles.length > 0) {
    medium.push(`Add inline documentation to the ${churnFiles.length} highest-churn files (${churnFiles.map(f => f.file.split('/').pop()).join(', ')})`);
  }

  // Low: general modernization
  if (depResult?.buildSystem === 'maven') {
    low.push('Migrate from Maven 2 to Maven 3 (Maven 2 is end-of-life)');
  }
  low.push('Set up static analysis (SpotBugs, PMD, Checkstyle) in the CI pipeline');
  low.push('Evaluate migration to a modern framework (Spring MVC, Quarkus, or Jakarta EE)');
  low.push('Add CONTRIBUTING.md and onboarding documentation for future maintainers');

  return { critical, high, medium, low };
}

// Risk heatmap calculated from real data — not AI-guessed.
function calculateRiskHeatmap(gitResult, depResult) {
  // Security: directly from CVE risk score
  const security = depResult?.riskScore ?? 5;

  // Maintenance: based on repo inactivity
  const lastCommitYear = gitResult?.lastCommit ? parseInt(gitResult.lastCommit.substring(0, 4)) : new Date().getFullYear();
  const yearsInactive = new Date().getFullYear() - lastCommitYear;
  const maintenance = Math.min(10, Math.round((yearsInactive / 2) * 10) / 10 + (gitResult?.busFactorAnalysis?.busFactorNumber <= 2 ? 3 : 1));

  // Complexity: churn + contributor spread
  const busFactor = gitResult?.busFactorAnalysis?.busFactorNumber ?? 5;
  const complexity = Math.min(10, Math.round((10 - Math.min(busFactor, 5)) * 1.5 * 10) / 10);

  // Documentation: heuristic (we don't scan for docs yet — medium default)
  const documentation = 5.5;

  const overall = Math.round(((security * 0.4) + (maintenance * 0.3) + (complexity * 0.2) + (documentation * 0.1)) * 10) / 10;

  return { security, maintenance, complexity, documentation, overall };
}

// Impact metrics banner — shown at the top of every output.
function buildImpactMetricsBanner(gitResult, depResult, reconResult, criticalIntersections) {
  const filesAnalyzed = reconResult?.totalFiles ?? '?';
  const cveCount = (depResult?.cveFlags ?? []).length;
  const contributors = gitResult?.contributorCount ?? '?';
  const commits = gitResult?.totalCommits ? gitResult.totalCommits.toLocaleString() : '?';
  const repoAge = gitResult?.repoAgeYears ?? '?';
  const obituaryCount = (gitResult?.knowledgeObituaries ?? []).length;
  const intersectionCount = (criticalIntersections ?? []).length;
  const cveSourceNote = depResult?.cveSource === 'osv' ? ' · CVEs via live OSV feed' : '';
  const obituaryNote = obituaryCount > 0 ? ` · 💀 ${obituaryCount} knowledge gap${obituaryCount !== 1 ? 's' : ''} identified` : '';
  const intersectionNote = intersectionCount > 0 ? ` · 🚨 ${intersectionCount} critical intersection${intersectionCount !== 1 ? 's' : ''} found` : '';
  return `> **Code Archaeologist** | ${filesAnalyzed} files analyzed · ${commits} commits parsed · ${cveCount} CVEs detected · ${contributors} contributors mapped · ${repoAge}-year-old codebase — excavated in <90 seconds${cveSourceNote}${obituaryNote}${intersectionNote}`;
}

// FIX 4: Read top high-churn files and send to WatsonX Granite for code analysis.
// This is the "real AI does real work" moment — Granite reads actual source code.
async function analyzeHighRiskFiles(gitResult, repoPath) {
  const topFiles = (gitResult?.highChurnFiles || []).slice(0, 3);
  if (topFiles.length === 0) return [];

  const results = [];

  for (const fileInfo of topFiles) {
    let filePath = join(repoPath, fileInfo.file);

    // If exact path doesn't exist, try to find the file by name (repo may have restructured)
    if (!existsSync(filePath)) {
      const filename = basename(fileInfo.file);
      logger.info(`High-churn file not at recorded path, searching by name: ${filename}`);
      const found = await findFileByName(repoPath, filename);
      if (found) {
        logger.info(`Found relocated file: ${found}`);
        filePath = found;
      } else {
        logger.warn(`High-churn file not found on disk: ${fileInfo.file}`);
        results.push({
          file: fileInfo.file,
          commits: fileInfo.commits,
          analysis: `This high-churn file (${fileInfo.commits} modifications) could not be read — it may have been deleted or moved. Review git history to understand what it contained.`,
          analysisSource: 'template'
        });
        continue;
      }
    }

    try {
      const MAX_ANALYSIS_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      const fileStat = await stat(filePath).catch(() => null);
      if (fileStat && fileStat.size > MAX_ANALYSIS_FILE_SIZE) {
        results.push({
          file: fileInfo.file,
          commits: fileInfo.commits,
          analysis: `File too large for analysis (${Math.round(fileStat.size / 1024 / 1024)}MB) — manual review required.`,
          analysisSource: 'size-limit'
        });
        continue;
      }
      const raw = await readFile(filePath, 'utf-8');
      // Cap at 150 lines to stay within token budget
      const lines = raw.split('\n');
      const content = lines.slice(0, 150).join('\n');
      const truncated = lines.length > 150;

      const prompt = `You are a code archaeologist reviewing a legacy codebase. This file has been modified ${fileInfo.commits} times — one of the highest churn rates in the entire codebase.

File: ${fileInfo.file}${truncated ? ` (first 150 of ${lines.length} lines shown)` : ''}
\`\`\`
${content}
\`\`\`

In 2-3 sentences: (1) what does this file do, (2) what implicit knowledge does a developer need to safely modify it, and (3) what is the single highest-risk aspect?

Be specific. Reference actual class names, methods, or patterns you see in the code. 2-3 sentences only.`;

      const analysis = await generateText(prompt, { maxTokens: 150 }).catch((err) => {
        logger.warn(`WatsonX file analysis failed for ${fileInfo.file}`, { error: err.message });
        return null;
      });

      results.push({
        file: fileInfo.file,
        commits: fileInfo.commits,
        linesOfCode: lines.length,
        analysis: analysis?.trim() || `High-churn file with ${fileInfo.commits} modifications — review all callers and subclasses before making any changes here.`,
        analysisSource: analysis ? 'watsonx' : 'template'
      });

      logger.info(`File analysis complete: ${fileInfo.file}`, { source: analysis ? 'watsonx' : 'template' });

    } catch (err) {
      logger.warn(`Could not read file for analysis: ${fileInfo.file}`, { error: err.message });
      results.push({
        file: fileInfo.file,
        commits: fileInfo.commits,
        analysis: `File analysis failed — review manually.`,
        analysisSource: 'error'
      });
    }
  }

  return results;
}

function buildOnboardingReadme(gitResult, depResult, reconResult, executiveSummary, whereToStart, impactBanner) {
  const repoName = reconResult?.repoName || 'Unknown Project';
  const today = new Date().toISOString().split('T')[0];
  const lastCommitYear = gitResult?.lastCommit?.substring(0, 4) || '?';
  const yearsInactive = new Date().getFullYear() - parseInt(lastCommitYear || new Date().getFullYear());
  const status = yearsInactive > 2 ? `Last commit: ${gitResult?.lastCommit} (${yearsInactive} years ago)` : `Active — last commit: ${gitResult?.lastCommit}`;
  const criticalCves = (depResult?.cveFlags || []).filter(c => c.severity === 'critical');

  const contributorRows = (gitResult?.topContributors || []).slice(0, 5).map((c, i) =>
    `| ${i + 1} | ${c.name} | ${c.commits} | ${c.percentOfTotal}% | ${c.lastActive} |`
  ).join('\n');

  const cveRows = (depResult?.cveFlags || []).map(c =>
    `| \`${c.id}\` | ${c.severity.toUpperCase()} | ${c.cvss} | \`${c.dependency.split(':')[1]}\` | ${c.description} |`
  ).join('\n');

  const churnRows = (gitResult?.highChurnFiles || []).slice(0, 5).map(f =>
    `| \`${f.file.split('/').pop()}\` | ${f.commits} | \`${f.file}\` |`
  ).join('\n');

  return `# ${repoName} — Developer Onboarding Guide
> Generated by **Code Archaeologist** on ${today}
> Powered by IBM Bob + WatsonX Granite

${impactBanner}

---

## Executive Summary

${executiveSummary}

---

## Repository Facts

| Property | Value |
|----------|-------|
| Age | ${gitResult?.repoAgeYears ?? '?'} years (first commit: ${gitResult?.firstCommit ?? '?'}) |
| Status | ${status} |
| Total Commits | ${(gitResult?.totalCommits ?? 0).toLocaleString()} |
| Contributors | ${gitResult?.contributorCount ?? '?'} |
| Build System | ${depResult?.buildSystem ?? '?'} |
| Dependencies | ${depResult?.totalDependencies ?? '?'} |
| CVEs Detected | ${(depResult?.cveFlags ?? []).length} (${criticalCves.length} critical) |
| Risk Score | ${depResult?.riskScore ?? '?'}/10 |

---

## Key Contributors (Historical)

| Rank | Name | Commits | % of Total | Last Active |
|------|------|---------|------------|-------------|
${contributorRows}

**Bus Factor: ${gitResult?.busFactorAnalysis?.busFactorNumber ?? '?'}** — ${gitResult?.busFactorAnalysis?.explanation ?? ''}

---

## Security Warnings

${(depResult?.cveFlags ?? []).length === 0 ? 'No known CVEs detected.' : `
| CVE | Severity | CVSS | Package | Description |
|-----|----------|------|---------|-------------|
${cveRows}

> **Do not deploy to production without addressing the critical CVEs above.**`}

---

## High-Churn Files (Most Frequently Modified)

These files have the highest change frequency — understand them before making changes.

| File | Commits | Full Path |
|------|---------|-----------|\n${churnRows}

---

## Where to Start

${whereToStart}

---

*Generated by [Code Archaeologist](https://github.com/git-happens/code-archaeologist) — IBM Dev Day Bob Hackathon 2026*
`;
}

function buildExcavationReport(gitResult, depResult, reconResult, roadmap, heatmap, highRiskFiles, impactBanner, knowledgeObituaries, criticalIntersections) {
  const repoName = reconResult?.repoName || 'Unknown Project';
  const today = new Date().toISOString().split('T')[0];

  const riskLabel = (score) => score >= 7 ? 'CRITICAL' : score >= 4 ? 'ELEVATED' : 'ACCEPTABLE';

  const roadmapSection = (items) => {
    if (!items || items.length === 0) return '_None identified._';
    return items.map(i => `- ${i}`).join('\n');
  };

  const highRiskSection = (highRiskFiles || []).length > 0
    ? highRiskFiles.map(f =>
        `### \`${f.file.split('/').pop()}\` — ${f.commits} commits${f.linesOfCode ? ` · ${f.linesOfCode} lines` : ''}\n` +
        `**Path:** \`${f.file}\`  \n` +
        `**Analysis (${f.analysisSource}):** ${f.analysis || '_Analysis unavailable_'}`
      ).join('\n\n')
    : '_No high-churn files identified._';

  const cveRows = (depResult?.cveFlags || []).map(c =>
    `| \`${c.id}\` | ${c.severity.toUpperCase()} | ${c.cvss} | \`${c.dependency.split(':')[1]}\` | Upgrade to ${c.fixVersion}+ |`
  ).join('\n');

  return `# ${repoName} — Full Excavation Report
> Generated by **Code Archaeologist** on ${today}
> Powered by IBM Bob + WatsonX Granite

${impactBanner}

---

## Risk Heatmap

| Dimension | Score | Status |
|-----------|-------|--------|
| Security | ${heatmap.security}/10 | ${riskLabel(heatmap.security)} |
| Maintenance | ${heatmap.maintenance}/10 | ${riskLabel(heatmap.maintenance)} |
| Complexity | ${heatmap.complexity}/10 | ${riskLabel(heatmap.complexity)} |
| Documentation | ${heatmap.documentation}/10 | ${riskLabel(heatmap.documentation)} |
| **Overall** | **${heatmap.overall}/10** | **${riskLabel(heatmap.overall)}** |

---

## Modernization Roadmap

### CRITICAL — Address immediately
${roadmapSection(roadmap.critical)}

### HIGH PRIORITY
${roadmapSection(roadmap.high)}

### MEDIUM PRIORITY
${roadmapSection(roadmap.medium)}

### LOW PRIORITY (backlog)
${roadmapSection(roadmap.low)}

---

## High-Risk File Analysis (WatsonX Granite)

The following files have the highest commit churn in the entire history. WatsonX Granite has read their source code and identified what you need to know before touching them.

${highRiskSection}

---

## CVE Details

${(depResult?.cveFlags ?? []).length === 0
  ? 'No known CVEs detected in dependency tree.'
  : `| CVE | Severity | CVSS | Package | Fix |
|-----|----------|------|---------|-----|
${cveRows}`}

---

## 💀 Knowledge Obituaries

${(knowledgeObituaries || []).length === 0
  ? '_No departed high-impact contributors identified._'
  : `**${(knowledgeObituaries || []).length} key contributor${(knowledgeObituaries || []).length !== 1 ? 's have' : ' has'} departed with deep knowledge of this codebase. Their institutional knowledge is at risk of permanent loss.**

${(knowledgeObituaries || []).map(ob =>
  `### ${ob.contributor} — ${ob.commitsAuthored} commits (${ob.percentOfTotal}% of codebase)\n` +
  `**Last Active:** ${ob.lastActive} (${ob.yearsGone} year${ob.yearsGone !== 1 ? 's' : ''} ago)  \n` +
  `**Orphaned Files:** ${ob.orphanedFiles.length > 0
    ? `${ob.orphanedFiles.length} file${ob.orphanedFiles.length !== 1 ? 's have' : ' has'} had zero commits since their departure (${ob.orphanedFiles.map(f => f.split('/').pop()).join(', ')})`
    : 'All touched files have had subsequent commits — but implicit design knowledge remains at risk'
  }  \n\n` +
  `> ${ob.obituary}`
).join('\n\n')}`}

---

## 🚨 Critical Risk Intersections

${(criticalIntersections || []).length === 0
  ? '_No files found at the intersection of CVE-affected packages and orphaned contributor knowledge._'
  : `**${(criticalIntersections || []).length} file${(criticalIntersections || []).length !== 1 ? 's' : ''} identified as the "perfect storm": CVE-vulnerable code owned by departed developers with no successor.**

${(criticalIntersections || []).map(i =>
  `### \`${basename(i.file)}\`\n` +
  `\`${i.file}\` contains **${i.cve.id}** (${i.cve.severity.toUpperCase()}, CVSS ${i.cve.cvss}) and was last touched by **${i.contributor}** ${i.daysSince} days ago. No successor identified.\n\n` +
  `> ${i.advisory || buildTemplateAdvisory(i)}`
).join('\n\n')}`}

---

## Repository Statistics

| Metric | Value |
|--------|-------|
| Repo Age | ${gitResult?.repoAgeYears ?? '?'} years |
| First Commit | ${gitResult?.firstCommit ?? '?'} |
| Last Commit | ${gitResult?.lastCommit ?? '?'} |
| Total Commits | ${(gitResult?.totalCommits ?? 0).toLocaleString()} |
| Contributors | ${gitResult?.contributorCount ?? '?'} |
| Bus Factor | ${gitResult?.busFactorAnalysis?.busFactorNumber ?? '?'} (${gitResult?.busFactorAnalysis?.risk ?? '?'} risk) |
| Primary Language | ${reconResult?.primaryLanguage ?? '?'} |
| Total Files | ${reconResult?.totalFiles ?? '?'} |
| Build System | ${depResult?.buildSystem ?? '?'} |
| Dependencies | ${depResult?.totalDependencies ?? '?'} |

---

*Generated by [Code Archaeologist](https://github.com/git-happens/code-archaeologist) — IBM Dev Day Bob Hackathon 2026*
`;
}

function buildTemplateExecutiveSummary(gitResult, depResult) {
  const age = gitResult?.repoAgeYears ?? '?';
  const lastYear = gitResult?.lastCommit?.substring(0, 4) ?? 'unknown';
  const yearsInactive = new Date().getFullYear() - parseInt(lastYear || new Date().getFullYear());
  const cveCount = depResult?.cveFlags?.length ?? 0;
  const criticalCount = (depResult?.cveFlags ?? []).filter(c => c.severity === 'critical').length;
  const top = gitResult?.topContributors?.[0];

  let s = `This is a ${age}-year-old codebase that has been inactive for ${yearsInactive} years.`;
  if (cveCount > 0) {
    s += ` Its dependency tree contains ${cveCount} known CVEs${criticalCount > 0 ? `, including ${criticalCount} rated critical` : ''} — making it an immediate security liability.`;
  }
  if (top) {
    s += ` The top contributor (${top.name}, ${top.percentOfTotal}% of commits) last committed in ${top.lastActive?.substring(0, 4)}.`;
  }
  s += ` New developers should begin with a security audit and dependency upgrades before making any functional changes.`;
  return s;
}

function buildTemplateWhereToStart(gitResult, depResult) {
  const churnFile = gitResult?.highChurnFiles?.[0];
  const worstCve = [...(depResult?.cveFlags ?? [])].sort((a, b) => b.cvss - a.cvss)[0];
  const top = gitResult?.topContributors?.[0];

  const steps = [
    `**Read the build file first** (\`${depResult?.buildSystem === 'maven' ? 'pom.xml' : 'package.json'}\`) — understand what this project depends on before reading code.`
  ];
  if (worstCve) {
    steps.push(`**Address ${worstCve.id} immediately** — this is a CVSS ${worstCve.cvss} vulnerability in \`${worstCve.dependency.split(':')[1]}\`. Upgrade before anything else.`);
  }
  if (churnFile) {
    steps.push(`**Study \`${churnFile.file.split('/').pop()}\` carefully** — it's been modified ${churnFile.commits} times and is the heart of this codebase.`);
  }
  if (top) {
    steps.push(`**Search for ${top.name.split(' ')[0]}'s commits** — they wrote ${top.percentOfTotal}% of the codebase. Understanding their patterns unlocks the rest.`);
  }
  steps.push('**Run the tests first** — establish a baseline before making any changes, even dependency upgrades.');

  return steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

export async function docsGenerator({ repoPath, gitHistorianResult, dependencyGrapherResult, reconResult }) {
  const start = Date.now();
  logger.info('Docs Generator starting', { repoPath });

  const git = gitHistorianResult || {};
  const dep = dependencyGrapherResult || {};
  const recon = reconResult || {};

  try {
    // Build roadmap and heatmap from real data — no AI needed for these
    const modernizationRoadmap = buildRoadmap(git, dep);
    const riskHeatmap = calculateRiskHeatmap(git, dep);

    // WatsonX call 1: Executive summary
    const summaryPrompt = `You are a senior software architect writing a concise executive briefing for a developer about to inherit a legacy codebase. Based on the analysis below, write a 3-5 sentence executive summary covering: what this codebase does, its age and current status, the most critical risk, and the single most important first action.

Git Analysis:
- Age: ${git.repoAgeYears} years (${git.firstCommit} to ${git.lastCommit})
- Commits: ${git.totalCommits?.toLocaleString()}, Contributors: ${git.contributorCount}
- Bus factor: ${git.busFactorAnalysis?.busFactorNumber} (${git.busFactorAnalysis?.risk})
- Top contributor: ${git.topContributors?.[0]?.name}, last active ${git.topContributors?.[0]?.lastActive}

Dependency Analysis:
- Build system: ${dep.buildSystem}, ${dep.totalDependencies} dependencies
- CVEs: ${dep.cveFlags?.length} total, ${dep.cveFlags?.filter(c => c.severity === 'critical').length} critical
- Worst CVE: ${dep.cveFlags?.sort((a, b) => b.cvss - a.cvss)?.[0]?.id} (CVSS ${dep.cveFlags?.sort((a, b) => b.cvss - a.cvss)?.[0]?.cvss})
- Risk score: ${dep.riskScore}/10

Write clearly. No bullet points. Lead with the most alarming truth.`;

    // WatsonX call 2: Where to start
    const whereToStartPrompt = `You are a senior developer writing the "Where to Start" section of an onboarding guide for a legacy codebase. Give 4-5 specific, actionable steps a new developer should take in their first week. Be concrete — reference actual files, CVE IDs, and contributor names from the data below.

Key facts:
- Highest-churn file: ${git.highChurnFiles?.[0]?.file} (${git.highChurnFiles?.[0]?.commits} commits)
- Top contributor: ${git.topContributors?.[0]?.name} (${git.topContributors?.[0]?.percentOfTotal}% of commits, last active ${git.topContributors?.[0]?.lastActive})
- Most critical CVE: ${dep.cveFlags?.sort((a, b) => b.cvss - a.cvss)?.[0]?.id} in ${dep.cveFlags?.sort((a, b) => b.cvss - a.cvss)?.[0]?.dependency?.split(':')?.[1]}
- Build system: ${dep.buildSystem}

Format as a numbered list. Each item should be 1-2 sentences.`;

    // Run WatsonX calls + file analysis + C5 advisories in parallel
    const [aiSummary, aiWhereToStart, highRiskFiles, criticalIntersections] = await Promise.all([
      generateText(summaryPrompt, { maxTokens: 250 }).catch((err) => {
        logger.warn('WatsonX executive summary failed, using template fallback', { error: err.message });
        return null;
      }),
      generateText(whereToStartPrompt, { maxTokens: 300 }).catch((err) => {
        logger.warn('WatsonX where-to-start failed, using template fallback', { error: err.message });
        return null;
      }),
      analyzeHighRiskFiles(git, repoPath),
      // C5: scan orphaned files for CVE package imports, then generate advisories
      crossRefCvesAndOrphans(git, dep, repoPath).then(generateCrossRefAdvisories)
    ]);

    const executiveSummary = aiSummary?.trim() || buildTemplateExecutiveSummary(git, dep);
    const whereToStart = aiWhereToStart?.trim() || buildTemplateWhereToStart(git, dep);

    // Build banner after all async work completes so intersection count is available
    const impactBanner = buildImpactMetricsBanner(git, dep, recon, criticalIntersections);

    // Build both output documents
    const onboardingReadme = buildOnboardingReadme(git, dep, recon, executiveSummary, whereToStart, impactBanner);
    const excavationReport = buildExcavationReport(git, dep, recon, modernizationRoadmap, riskHeatmap, highRiskFiles, impactBanner, git.knowledgeObituaries || [], criticalIntersections);

    // FIX 1: Auto-save both files to the analyzed repo root
    const savedFiles = [];

    try {
      const onboardingPath = join(repoPath, 'ONBOARDING.md');
      await writeFile(onboardingPath, onboardingReadme, 'utf-8');
      savedFiles.push(onboardingPath);
      logger.info('ONBOARDING.md saved to repo root', { path: onboardingPath });
    } catch (err) {
      logger.warn('Could not save ONBOARDING.md', { error: err.message });
    }

    try {
      const reportPath = join(repoPath, 'EXCAVATION_REPORT.md');
      await writeFile(reportPath, excavationReport, 'utf-8');
      savedFiles.push(reportPath);
      logger.info('EXCAVATION_REPORT.md saved to repo root', { path: reportPath });
    } catch (err) {
      logger.warn('Could not save EXCAVATION_REPORT.md', { error: err.message });
    }

    const result = {
      repoPath,
      generatedAt: new Date().toISOString(),
      impactBanner,
      executiveSummary,
      onboardingReadme,
      excavationReport,
      modernizationRoadmap,
      riskHeatmap,
      highRiskFiles,
      criticalIntersections,
      savedFiles,
      narrativeSources: {
        executiveSummary: aiSummary ? 'watsonx' : 'template',
        whereToStart: aiWhereToStart ? 'watsonx' : 'template',
        highRiskFiles: highRiskFiles.length > 0
          ? highRiskFiles.map(f => f.analysisSource)
          : [],
        crossRefAdvisories: criticalIntersections.map(i => i.advisorySource || 'template')
      }
    };

    logger.info('Docs Generator completed', {
      duration: `${Date.now() - start}ms`,
      savedFiles: savedFiles.length,
      highRiskFilesAnalyzed: highRiskFiles.length,
      narrativeSources: result.narrativeSources
    });

    return result;

  } catch (error) {
    logger.error('Docs Generator failed', { error: error.message });
    throw error;
  }
}
