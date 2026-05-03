import { spawn } from 'child_process';
import { generateText } from '../utils/watsonx.js';
import { logger } from '../utils/logger.js';

// Configurable timeouts — override via env vars for large repos.
const GIT_TIMEOUT = parseInt(process.env.GIT_TIMEOUT || '60000');
const GIT_FILE_TIMEOUT = parseInt(process.env.GIT_FILE_TIMEOUT || '15000');
const GIT_TOUCH_TIMEOUT = parseInt(process.env.GIT_TOUCH_TIMEOUT || '5000');

// Buffer size limit to prevent memory exhaustion on malformed repos
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

// Git's --author flag treats the argument as a regex; escape metacharacters
// so contributor emails match exactly and don't accidentally match others.
// SECURITY: Also validates email format to prevent command injection
function escapeGitRegex(str) {
  // Validate email format first to prevent command injection
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(str)) {
    throw new Error('Invalid email format for git author filter');
  }
  // Escape regex metacharacters
  let escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Also escape spaces and quotes for git's --author flag (handles RFC 5322 edge cases)
  escaped = escaped.replace(/\s/g, '\\ ').replace(/"/g, '\\"');
  return escaped;
}

// Stream git log and aggregate contributor + timeline stats.
// Uses --format flag to fetch only needed fields — avoids loading full log into memory.
async function parseCommitHistory(repoPath) {
  return new Promise((resolve, reject) => {
    const contributors = new Map(); // email → { name, email, commits, firstActive, lastActive }
    let totalCommits = 0;
    let firstCommit = null;
    let lastCommit = null;
    const monthlyCommits = new Map(); // YYYY-MM → count
    let settled = false; // Prevents race condition between timeout and close events

    // Use %aI (strict ISO 8601) instead of --date=short so dates are always UTC-normalized,
    // avoiding ordering errors on repos with commits from mixed timezones.
    const git = spawn('git', ['log', '--format=%ae|%an|%aI'], {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const gitTimeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        git.kill('SIGTERM');
        reject(new Error(`git log timed out after ${GIT_TIMEOUT}ms`));
      }
    }, GIT_TIMEOUT);

    let buffer = '';
    let bufferSize = 0;

    git.stdout.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      bufferSize += chunkStr.length;
      
      // Prevent buffer overflow on malformed repos or extremely long commit messages
      if (bufferSize > MAX_BUFFER_SIZE) {
        if (!settled) {
          settled = true;
          clearTimeout(gitTimeout);
          git.kill('SIGTERM');
          reject(new Error('Git output exceeded buffer limit - possible malformed repository'));
        }
        return;
      }
      
      buffer += chunkStr;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // hold last incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('|');
        if (parts.length < 3) continue;
        const [rawEmail, rawName, rawDate] = parts;
        const email = rawEmail.toLowerCase().trim();
        const name = rawName.trim();
        // Normalize ISO 8601 timestamp to YYYY-MM-DD in UTC so lexicographic comparison is valid
        const date = rawDate ? new Date(rawDate).toISOString().split('T')[0] : null;
        if (!email || !date) continue;

        totalCommits++;
        // Note: String comparison works because --date=short outputs YYYY-MM-DD (lexicographically sortable)
        if (!firstCommit || date < firstCommit) firstCommit = date;
        if (!lastCommit || date > lastCommit) lastCommit = date;

        if (!contributors.has(email)) {
          contributors.set(email, { name, email, commits: 0, firstActive: date, lastActive: date });
        }
        const c = contributors.get(email);
        c.commits++;
        if (date < c.firstActive) c.firstActive = date;
        if (date > c.lastActive) c.lastActive = date;

        const month = date.substring(0, 7); // YYYY-MM
        monthlyCommits.set(month, (monthlyCommits.get(month) || 0) + 1);
      }
    });

    git.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(gitTimeout);
        reject(new Error(`git not found: ${err.message}`));
      }
    });
    
    git.on('close', (code) => {
      if (settled) return; // Already handled by timeout or error
      settled = true;
      clearTimeout(gitTimeout);
      
      // Handle empty repository (valid but no commits yet)
      if (code === 0 && totalCommits === 0) {
        resolve({ contributors: new Map(), totalCommits: 0, firstCommit: null, lastCommit: null, monthlyCommits: new Map() });
        return;
      }
      
      if (code !== 0 && totalCommits === 0) {
        reject(new Error(`git log exited with code ${code} — is ${repoPath} a git repository?`));
        return;
      }
      
      resolve({ contributors, totalCommits, firstCommit, lastCommit, monthlyCommits });
    });
  });
}

// Find the files touched most across the entire history.
async function getHighChurnFiles(repoPath, limit = 10) {
  return new Promise((resolve, reject) => {
    const fileCounts = new Map();
    let settled = false;

    const git = spawn('git', ['log', '--pretty=format:', '--name-only'], {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const gitTimeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        git.kill('SIGTERM');
        reject(new Error(`git churn analysis timed out after ${GIT_TIMEOUT}ms`));
      }
    }, GIT_TIMEOUT);

    let buffer = '';
    let bufferSize = 0;

    git.stdout.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      bufferSize += chunkStr.length;
      
      if (bufferSize > MAX_BUFFER_SIZE) {
        if (!settled) {
          settled = true;
          clearTimeout(gitTimeout);
          git.kill('SIGTERM');
          reject(new Error('Git churn output exceeded buffer limit'));
        }
        return;
      }
      
      buffer += chunkStr;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const file = line.trim();
        if (!file) continue;
        fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
      }
    });

    git.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(gitTimeout);
        reject(err);
      }
    });
    
    git.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(gitTimeout);
      const sorted = [...fileCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([file, commits]) => ({ file, commits }));
      resolve(sorted);
    });
  });
}

// Get the files most frequently touched by a specific contributor.
async function getTopFilesByContributor(repoPath, email, limit = 10) {
  // Reject invalid emails — must contain @ and be under RFC 5321 max length
  if (!email || !email.includes('@') || email.length > 254 || email.includes('\0') || email.includes('\n')) {
    logger.warn('Skipping contributor file analysis — invalid email format', { email: email?.substring(0, 50) });
    return [];
  }
  return new Promise((resolve) => {
    const fileCounts = new Map();
    const git = spawn('git', ['log', `--author=${escapeGitRegex(email)}`, '--pretty=format:', '--name-only'], {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: false  // SECURITY: Disable shell to prevent command injection
    });
    const timeout = setTimeout(() => { git.kill(); resolve([]); }, GIT_FILE_TIMEOUT);
    let buffer = '';
    git.stdout.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const file = line.trim();
        if (file) fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
      }
    });
    git.on('close', () => {
      clearTimeout(timeout);
      resolve([...fileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([file, count]) => ({ file, count })));
    });
    git.on('error', () => { clearTimeout(timeout); resolve([]); });
  });
}

// Returns true if any commit after `since` touched `file`.
// Uses --after which in git means commits with date > since (exclusive).
async function hasFileBeenTouchedSince(repoPath, file, since) {
  return new Promise((resolve) => {
    const git = spawn('git', ['log', '--oneline', `--after=${since}`, '--', file], {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        git.kill('SIGTERM');
        setTimeout(() => { if (!git.killed) git.kill('SIGKILL'); }, 1000);
        resolve(false);
      }
    }, GIT_TOUCH_TIMEOUT);
    let output = '';
    git.stdout.on('data', chunk => { output += chunk.toString(); });
    git.on('close', () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(output.trim().length > 0); }
    });
    git.on('error', () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(false); }
    });
  });
}

// Build Knowledge Obituaries for contributors who:
//   (a) authored ≥15% of commits AND (b) have been inactive for >6 months.
// For each, identifies orphaned files and generates a WatsonX obituary.
// Uses Promise.allSettled to prevent individual failures from breaking entire analysis.
async function buildKnowledgeObituaries(repoPath, topContributors) {
  const SIX_MONTHS_AGO = new Date();
  SIX_MONTHS_AGO.setMonth(SIX_MONTHS_AGO.getMonth() - 6);

  const departed = topContributors.filter(c =>
    new Date(c.lastActive) < SIX_MONTHS_AGO && c.percentOfTotal >= 15
  );

  if (departed.length === 0) return [];

  const obituaryResults = await Promise.allSettled(departed.map(async (contributor) => {
    try {
      const topFiles = await getTopFilesByContributor(repoPath, contributor.email, 10);

      const orphanChecks = await Promise.all(
        topFiles.map(async ({ file, count }) => {
          const touched = await hasFileBeenTouchedSince(repoPath, file, contributor.lastActive);
          return { file, count, orphaned: !touched };
        })
      );
      const orphanedFiles = orphanChecks.filter(f => f.orphaned);
      const yearsGone = Math.round((Date.now() - new Date(contributor.lastActive).getTime()) / (1000 * 60 * 60 * 24 * 365));

      const prompt = `You are a code archaeologist. A key developer has left this project and their knowledge may be lost. Write a 2-3 sentence "knowledge obituary" — what institutional knowledge walked out the door when they left, and what risks does that create for anyone inheriting their code?

Contributor: ${contributor.name}
Active period: ${contributor.firstActive} to ${contributor.lastActive} (gone ${yearsGone} years)
Commits: ${contributor.commits} (${contributor.percentOfTotal}% of total codebase)
Files they owned most: ${topFiles.slice(0, 3).map(f => f.file.split('/').pop()).join(', ') || 'unknown'}
Orphaned files (zero commits since departure): ${orphanedFiles.length > 0 ? orphanedFiles.slice(0, 3).map(f => f.file.split('/').pop()).join(', ') : 'none identified'}

2-3 sentences. Focus on the institutional knowledge risk. Be specific.`;

      const aiObituary = await generateText(prompt, { maxTokens: 120 }).catch(() => null);

      return {
        contributor: contributor.name,
        email: contributor.email,
        percentOfTotal: contributor.percentOfTotal,
        lastActive: contributor.lastActive,
        yearsGone,
        commitsAuthored: contributor.commits,
        topFiles: topFiles.slice(0, 5).map(f => f.file),
        orphanedFiles: orphanedFiles.slice(0, 5).map(f => f.file),
        obituary: aiObituary?.trim() ||
          `${contributor.name} authored ${contributor.percentOfTotal}% of this codebase and has been absent for ${yearsGone} years. ` +
          (orphanedFiles.length > 0
            ? `${orphanedFiles.length} of their key files have had zero commits since their departure — the implicit knowledge required to safely modify them is gone.`
            : `Their departure created a significant knowledge concentration risk across the codebase.`) +
          ` Any changes to their code areas carry elevated regression risk without documentation of their design intent.`,
        obituarySource: aiObituary ? 'watsonx' : 'template'
      };
    } catch (err) {
      logger.warn('Failed to build obituary for contributor', {
        contributor: contributor.email,
        error: err.message
      });
      return null;
    }
  }));

  const obituaries = obituaryResults
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  return obituaries;
}

// How many contributors does it take to account for >50% of all commits?
function calculateBusFactor(contributors, totalCommits) {
  // Handle edge cases
  if (contributors.size === 0 || totalCommits === 0) {
    return { busFactorNumber: 0, cumulativePercent: 0, risk: 'unknown' };
  }
  
  if (contributors.size === 1) {
    return { busFactorNumber: 1, cumulativePercent: 100, risk: 'critical' };
  }
  
  const sorted = [...contributors.values()].sort((a, b) => b.commits - a.commits);
  let cumulative = 0;
  let busFactorNumber = 0;

  for (const c of sorted) {
    cumulative += (c.commits / totalCommits) * 100;
    busFactorNumber++;
    if (cumulative >= 50) break;
  }

  return {
    busFactorNumber,
    cumulativePercent: Math.round(cumulative * 10) / 10,
    risk: busFactorNumber <= 1 ? 'critical' : busFactorNumber <= 3 ? 'high' : 'medium'
  };
}

// Group monthly commit counts into readable year-range periods.
function buildCommitTimeline(monthlyCommits, firstCommit, lastCommit) {
  if (!firstCommit) return [];

  const firstYear = parseInt(firstCommit.substring(0, 4));
  const lastYear = parseInt(lastCommit.substring(0, 4));
  const span = lastYear - firstYear + 1;
  const periodSize = Math.max(3, Math.ceil(span / 5));

  const periods = [];
  for (let y = firstYear; y <= lastYear; y += periodSize) {
    const endYear = Math.min(y + periodSize - 1, lastYear);
    let commits = 0;
    for (const [month, count] of monthlyCommits) {
      const year = parseInt(month.substring(0, 4));
      if (year >= y && year <= endYear) commits += count;
    }
    const prev = periods[periods.length - 1];
    let trend = 'growing';
    if (prev) {
      const ratio = commits / (prev.commits || 1);
      if (commits < 30) trend = 'abandoned';
      else if (ratio < 0.5) trend = 'declining';
      else if (ratio > 1.3) trend = 'growing';
      else trend = 'stable';
    }
    periods.push({ period: `${y}–${endYear}`, commits, trend });
  }
  return periods;
}

function buildTemplateNarrative(stats) {
  const { topContributors, totalCommits, repoAgeYears, contributorCount, busFactorAnalysis, lastCommit } = stats;
  const top = topContributors[0];
  const lastYear = lastCommit ? parseInt(lastCommit.substring(0, 4)) : new Date().getFullYear();
  const yearsInactive = new Date().getFullYear() - lastYear;

  let n = `This codebase is ${repoAgeYears} years old with ${totalCommits.toLocaleString()} commits from ${contributorCount} contributors.`;
  if (top) {
    n += ` ${top.name} authored ${top.percentOfTotal}% of all commits, last committing on ${top.lastActive}.`;
  }
  if (yearsInactive > 1) {
    n += ` The repository has been inactive for ${yearsInactive} year${yearsInactive !== 1 ? 's' : ''}.`;
  }
  n += ` Bus factor is ${busFactorAnalysis.busFactorNumber} — ${busFactorAnalysis.busFactorNumber <= 2 ? 'a critical single point of failure for institutional knowledge.' : 'moderate knowledge concentration risk.'}`;
  return n;
}

export async function gitHistorian({ repoPath }) {
  const start = Date.now();
  logger.info('Git Historian starting', { repoPath });

  try {
    // Run both git commands in parallel
    const [history, highChurnFiles] = await Promise.all([
      parseCommitHistory(repoPath),
      getHighChurnFiles(repoPath, 10)
    ]);

    const { contributors, totalCommits, firstCommit, lastCommit, monthlyCommits } = history;

    const topContributors = [...contributors.values()]
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 10)
      .map(c => ({ ...c, percentOfTotal: Math.round((c.commits / totalCommits) * 1000) / 10 }));

    const firstYear = firstCommit ? parseInt(firstCommit.substring(0, 4)) : new Date().getFullYear();
    const repoAgeYears = new Date().getFullYear() - firstYear;
    const busFactor = calculateBusFactor(contributors, totalCommits);
    const commitTimeline = buildCommitTimeline(monthlyCommits, firstCommit, lastCommit);

    const stats = {
      repoPath,
      totalCommits,
      contributorCount: contributors.size,
      repoAgeYears,
      firstCommit,
      lastCommit,
      topContributors,
      busFactorAnalysis: {
        busFactorNumber: busFactor.busFactorNumber,
        explanation: `${busFactor.busFactorNumber} contributor${busFactor.busFactorNumber !== 1 ? 's' : ''} authored over 50% of all commits`,
        topPercent: busFactor.cumulativePercent,
        risk: busFactor.risk
      },
      commitTimeline,
      highChurnFiles
    };

    // WatsonX narrative — falls back to template if unavailable
    const prompt = `You are a code archaeologist analyzing a legacy codebase. Given these git history statistics, write a 3-4 sentence narrative that tells the human story of this codebase — who built it, when they left, and what risks that creates for a new developer inheriting it.

Stats:
${JSON.stringify({
  repoAgeYears,
  totalCommits,
  contributorCount: contributors.size,
  topContributor: topContributors[0] || null,
  busFactorNumber: busFactor.busFactorNumber,
  firstCommit,
  lastCommit
}, null, 2)}

Write in a direct, slightly dramatic tone. Highlight the biggest risk. 3-4 sentences only.`;

    // Run WatsonX narrative + Knowledge Obituary in parallel — both are independent
    const [aiNarrative, knowledgeObituaries] = await Promise.all([
      generateText(prompt, { maxTokens: 200 }).catch((err) => {
        logger.warn('WatsonX narrative failed, using template fallback', { error: err.message });
        return null;
      }),
      buildKnowledgeObituaries(repoPath, topContributors).catch(err => {
        logger.warn('Knowledge Obituary build failed', { error: err.message });
        return [];
      })
    ]);
    stats.narrative = aiNarrative?.trim() || buildTemplateNarrative(stats);
    stats.narrativeSource = aiNarrative ? 'watsonx' : 'template';
    stats.knowledgeObituaries = knowledgeObituaries;

    logger.info('Git Historian completed', {
      duration: `${Date.now() - start}ms`,
      totalCommits,
      contributors: contributors.size,
      narrativeSource: stats.narrativeSource
    });

    return stats;

  } catch (error) {
    logger.error('Git Historian failed', { error: error.message, repoPath });
    throw error;
  }
}
