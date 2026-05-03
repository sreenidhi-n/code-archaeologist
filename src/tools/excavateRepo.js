import { readdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, relative } from 'path';
import { spawn } from 'child_process';
import { generateText } from '../utils/watsonx.js';
import { logger } from '../utils/logger.js';
import { gitHistorian } from './gitHistorian.js';
import { dependencyGrapher, clearOSVCache } from './dependencyGrapher.js';
import { docsGenerator } from './docsGenerator.js';

// Language detection by file extension
const EXTENSION_LANGUAGES = {
  '.java': 'Java', '.kt': 'Kotlin', '.scala': 'Scala', '.groovy': 'Groovy',
  '.js': 'JavaScript', '.ts': 'TypeScript', '.jsx': 'JavaScript', '.tsx': 'TypeScript',
  '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust',
  '.cpp': 'C++', '.cc': 'C++', '.c': 'C', '.h': 'C/C++',
  '.cs': 'C#', '.php': 'PHP', '.swift': 'Swift',
  '.xml': 'XML', '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
  '.html': 'HTML', '.css': 'CSS', '.sql': 'SQL', '.sh': 'Shell'
};

const SKIP_DIRS = new Set(['.git', 'node_modules', '.bob', 'dist', 'build', 'target', '.idea', '.vscode']);

const MAX_FILES_TO_PROCESS = 50000;
const MAX_FILE_SIZE_BYTES  = 10 * 1024 * 1024; // 10MB — skip individual oversized files
const MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024; // 500MB — stop entire walk if exceeded

// Sanitize user-controlled strings before embedding in WatsonX prompts
// to prevent prompt injection via malicious file/directory names.
function sanitizeForPrompt(str) {
  if (!str) return 'unknown';
  return String(str).replace(/[\x00-\x1F\x7F-\x9F]/g, '').substring(0, 200).trim();
}

// FIX 3: Emit phase progress to stderr so Bob sees real-time updates.
function emitProgress(message) {
  process.stderr.write(`[Code Archaeologist] ${message}\n`);
}

async function walkDirectory(dir, depth = 0, maxDepth = 12, _shared = { fileCount: 0, totalSize: 0 }) {
  if (depth > maxDepth) return { fileCounts: {}, totalFiles: 0, maxDepthSeen: depth, fileSizes: [] };
  if (_shared.fileCount >= MAX_FILES_TO_PROCESS || _shared.totalSize >= MAX_TOTAL_SIZE_BYTES) {
    return { fileCounts: {}, totalFiles: 0, maxDepthSeen: depth, fileSizes: [] };
  }

  const fileCounts = {};
  let totalFiles = 0;
  let maxDepthSeen = depth;
  const fileSizes = []; // [{ path, size, ext }]

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { fileCounts, totalFiles, maxDepthSeen, fileSizes };
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const sub = await walkDirectory(join(dir, entry.name), depth + 1, maxDepth, _shared);
      totalFiles += sub.totalFiles;
      maxDepthSeen = Math.max(maxDepthSeen, sub.maxDepthSeen);
      for (const [ext, count] of Object.entries(sub.fileCounts)) {
        fileCounts[ext] = (fileCounts[ext] || 0) + count;
      }
      fileSizes.push(...sub.fileSizes);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (ext) {
        fileCounts[ext] = (fileCounts[ext] || 0) + 1;
        totalFiles++;
        try {
          const s = await stat(join(dir, entry.name));
          if (s.size > MAX_FILE_SIZE_BYTES) continue; // skip individual oversized files
          _shared.fileCount++;
          _shared.totalSize += s.size;
          fileSizes.push({ path: join(dir, entry.name), size: s.size, ext });
        } catch { /* skip */ }
      }
    }
  }

  return { fileCounts, totalFiles, maxDepthSeen, fileSizes };
}

async function getFirstCommitDate(repoPath) {
  return new Promise((resolve) => {
    const git = spawn('git', ['log', '--reverse', '--format=%ad', '--date=short'], {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    let output = '';
    git.stdout.on('data', (chunk) => { output += chunk.toString(); });
    git.on('close', () => resolve(output.trim().split('\n')[0] || null));
    git.on('error', () => resolve(null));
  });
}

async function reconnaissance(repoPath) {
  const { fileCounts, totalFiles } = await walkDirectory(repoPath);

  // Determine primary language by file count
  const languageCounts = {};
  for (const [ext, count] of Object.entries(fileCounts)) {
    const lang = EXTENSION_LANGUAGES[ext];
    if (lang) languageCounts[lang] = (languageCounts[lang] || 0) + count;
  }
  // Prefer code languages over markup/config (XML, JSON, YAML, HTML, CSS)
  const CODE_LANGUAGES = new Set(['Java', 'Kotlin', 'Scala', 'JavaScript', 'TypeScript', 'Python', 'Ruby', 'Go', 'Rust', 'C++', 'C', 'C#', 'PHP', 'Swift', 'Groovy']);
  const sorted = Object.entries(languageCounts).sort((a, b) => b[1] - a[1]);
  const primaryLanguage =
    sorted.find(([lang]) => CODE_LANGUAGES.has(lang))?.[0] ||
    sorted[0]?.[0] ||
    'Unknown';

  // Check for key project markers
  const hasReadme = existsSync(join(repoPath, 'README.md')) || existsSync(join(repoPath, 'README'));
  const hasDocs   = existsSync(join(repoPath, 'docs')) || existsSync(join(repoPath, 'documentation'));
  const hasTests  = existsSync(join(repoPath, 'test')) || existsSync(join(repoPath, 'tests')) || existsSync(join(repoPath, 'src/test'));

  const repoName = repoPath.split('/').pop();
  const firstCommit = await getFirstCommitDate(repoPath);
  const repoAgeYears = firstCommit
    ? new Date().getFullYear() - parseInt(firstCommit.substring(0, 4))
    : null;

  return {
    repoName,
    repoPath,
    totalFiles,
    fileCounts,
    languageCounts,
    primaryLanguage,
    hasReadme,
    hasDocs,
    hasTests,
    repoAgeYears,
    firstCommit
  };
}

// FIX 6: Real Phase 3 — Semantic Mapping.
// Produces LOC counts, largest files, test ratio, directory depth,
// and a WatsonX structural observation from actual data.
async function semanticMapping(repoPath, reconResult) {
  logger.info('Semantic Mapping: walking repo for file metrics', { repoPath });

  // Re-walk with size data (recon already walked but didn't collect sizes)
  const { fileCounts, totalFiles, maxDepthSeen, fileSizes } = await walkDirectory(repoPath);

  // Largest files (top 10 by bytes)
  const largestFiles = fileSizes
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map(f => ({
      path: relative(repoPath, f.path),
      sizeKb: Math.round(f.size / 1024 * 10) / 10,
      ext: f.ext
    }));

  // LOC estimate: count lines in top 5 largest files of the primary language
  const primaryLang = reconResult?.primaryLanguage || 'Java';
  const primaryExt = Object.entries(EXTENSION_LANGUAGES).find(([, lang]) => lang === primaryLang)?.[0] || '.java';
  const primaryFiles = fileSizes
    .filter(f => f.ext === primaryExt)
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  let locSample = 0;
  let locFilesRead = 0;
  for (const f of primaryFiles) {
    try {
      const content = await readFile(f.path, 'utf-8');
      locSample += content.split('\n').length;
      locFilesRead++;
    } catch { /* skip unreadable files */ }
  }

  // Extrapolate total LOC from sample (sample files / total primary files)
  const totalPrimaryFiles = fileSizes.filter(f => f.ext === primaryExt).length;
  const estimatedTotalLoc = locFilesRead > 0 && totalPrimaryFiles > 0
    ? Math.round((locSample / locFilesRead) * totalPrimaryFiles)
    : null;

  // Test file ratio
  const testFiles = fileSizes.filter(f =>
    f.path.toLowerCase().includes('/test/') ||
    f.path.toLowerCase().includes('/tests/') ||
    f.path.toLowerCase().includes('.test.') ||
    f.path.toLowerCase().includes('test.java') ||
    f.path.toLowerCase().includes('spec.')
  ).length;
  const testRatio = totalFiles > 0 ? Math.round((testFiles / totalFiles) * 1000) / 10 : 0;

  const metrics = {
    primaryLanguage: primaryLang,
    totalFiles,
    totalPrimaryLanguageFiles: totalPrimaryFiles,
    estimatedLinesOfCode: estimatedTotalLoc,
    locSampleBasis: `${locFilesRead} largest ${primaryLang} files`,
    testFiles,
    testRatio: `${testRatio}%`,
    directoryDepth: maxDepthSeen,
    largestFiles
  };

  // WatsonX structural observation — send the metrics, get architectural insight
  const prompt = `You are a code archaeologist. Given these structural metrics from a legacy codebase, write 2-3 sentences describing what the structure tells you about this codebase's architecture, maintainability, and any structural risks a new developer should know about.

Metrics:
- Primary language: ${sanitizeForPrompt(primaryLang)}
- Total source files: ${totalFiles}
- ${sanitizeForPrompt(primaryLang)} files: ${totalPrimaryFiles}
- Estimated lines of code: ${estimatedTotalLoc ? estimatedTotalLoc.toLocaleString() : 'unknown'}
- Test file ratio: ${testRatio}% of files are tests
- Directory depth: ${maxDepthSeen} levels
- Largest file: ${sanitizeForPrompt(largestFiles[0]?.path)} (${largestFiles[0]?.sizeKb || '?'} KB)

2-3 sentences. Be specific about structural risk.`;

  const aiObservation = await generateText(prompt, { maxTokens: 120 }).catch((err) => {
    logger.warn('WatsonX structural observation failed, using template fallback', { error: err.message });
    return null;
  });

  const templateObservation = `This ${primaryLang} codebase spans ${totalPrimaryFiles} source files across ${maxDepthSeen} directory levels${estimatedTotalLoc ? ` with an estimated ${estimatedTotalLoc.toLocaleString()} lines of code` : ''}. ` +
    `At ${testRatio}% test coverage by file count, testing is ${testRatio < 10 ? 'critically underrepresented — changes carry high regression risk' : testRatio < 25 ? 'sparse — verify behavior manually before any refactor' : 'reasonable for a legacy codebase'}. ` +
    `The ${maxDepthSeen}-level directory depth suggests ${maxDepthSeen > 8 ? 'deep package nesting — expect long import paths and tight coupling' : 'a manageable package structure'}.`;

  metrics.structuralObservation = aiObservation?.trim() || templateObservation;
  metrics.observationSource = aiObservation ? 'watsonx' : 'template';

  logger.info('Semantic Mapping complete', {
    totalFiles,
    testRatio: `${testRatio}%`,
    directoryDepth: maxDepthSeen,
    estimatedLoc: estimatedTotalLoc,
    observationSource: metrics.observationSource
  });

  return metrics;
}

// Wrap each phase with timing, status tracking, and graceful error handling.
async function runPhase(id, name, fn) {
  const phase = { id, name, status: 'running', startedAt: new Date().toISOString(), result: null, error: null };
  logger.info(`Phase ${id} starting: ${name}`);

  // FIX 3: Emit start progress
  emitProgress(`Phase ${id}/${5}: ${name} — starting...`);

  try {
    phase.result = await fn();
    phase.status = 'complete';
  } catch (err) {
    phase.status = 'error';
    phase.error = err.message;
    logger.error(`Phase ${id} failed: ${name}`, { error: err.message });
  }
  phase.completedAt = new Date().toISOString();
  phase.durationMs = new Date(phase.completedAt) - new Date(phase.startedAt);

  // FIX 3: Emit completion progress with timing
  const durationSec = (phase.durationMs / 1000).toFixed(1);
  emitProgress(`Phase ${id}/5: ${name} — ${phase.status.toUpperCase()} (${durationSec}s)`);

  return phase;
}

export async function excavateRepo({ repoPath }) {
  const excavationStart = Date.now();
  logger.info('Excavation starting', { repoPath });

  // FIX 3: Announce excavation start
  emitProgress(`Excavation started: ${repoPath}`);

  const report = {
    repoPath,
    status: 'running',
    startedAt: new Date().toISOString(),
    phases: [],
    report: null
  };

  // Phase 1: Reconnaissance (fast — local file scan)
  const phase1 = await runPhase(1, 'Reconnaissance', () => reconnaissance(repoPath));
  report.phases.push(phase1);

  // Phase 2 + Phase 4 in parallel — they're independent
  emitProgress('Phase 2+4: Running Historical Excavation and Risk Assessment in parallel...');
  const [phase2, phase4] = await Promise.all([
    runPhase(2, 'Historical Excavation', () => gitHistorian({ repoPath })),
    runPhase(4, 'Risk Assessment',       () => dependencyGrapher({ repoPath }))
  ]);
  report.phases.push(phase2);

  // FIX 6: Phase 3 is now real — Semantic Mapping
  const phase3 = await runPhase(3, 'Semantic Mapping', () =>
    semanticMapping(repoPath, phase1.result)
  );
  report.phases.push(phase3);
  report.phases.push(phase4);

  // Phase 5: Docs Generator — needs phase 2 + 4 results
  const phase5 = await runPhase(5, 'Modernization Roadmap', () =>
    docsGenerator({
      repoPath,
      gitHistorianResult:      phase2.result,
      dependencyGrapherResult: phase4.result,
      reconResult:             phase1.result
    })
  );
  report.phases.push(phase5);

  // Clear the per-run OSV cache so back-to-back excavations don't share stale results.
  clearOSVCache();

  const totalDuration = Date.now() - excavationStart;
  report.status = report.phases.some(p => p.status === 'error') ? 'partial' : 'complete';
  report.completedAt = new Date().toISOString();
  report.totalDurationMs = totalDuration;
  report.report = phase5.result; // top-level shortcut for Bob

  logger.info('Excavation complete', {
    status: report.status,
    duration: `${(totalDuration / 1000).toFixed(1)}s`,
    phases: report.phases.map(p => `${p.name}:${p.status}`).join(', ')
  });

  // FIX 3: Final summary line
  const savedFiles = phase5.result?.savedFiles || [];
  emitProgress(
    `Excavation complete in ${(totalDuration / 1000).toFixed(1)}s — status: ${report.status.toUpperCase()}` +
    (savedFiles.length > 0 ? ` — saved: ${savedFiles.map(f => f.split('/').pop()).join(', ')}` : '')
  );

  return report;
}
