#!/usr/bin/env node
// Integration test — runs Phase 2 and Phase 3 against the real apache/struts1 repo.
// Run: node test/test-real-repo.js [path-to-struts1]

import { gitHistorian } from '../src/tools/gitHistorian.js';
import { dependencyGrapher } from '../src/tools/dependencyGrapher.js';
import { homedir } from 'os';

const REPO = process.argv[2] || `${homedir()}/struts1`;

console.log('═══════════════════════════════════════════');
console.log('  Code Archaeologist — Real Repo Test');
console.log(`  Repo: ${REPO}`);
console.log('═══════════════════════════════════════════\n');

// ── Phase 2: Git Historian ───────────────────
console.log('[ Phase 2: Git Historian ]\n');
console.time('git_historian');
const gitResult = await gitHistorian({ repoPath: REPO }).catch(err => {
  console.error('❌ Git Historian failed:', err.message);
  process.exit(1);
});
console.timeEnd('git_historian');

console.log(`  Total commits:    ${gitResult.totalCommits.toLocaleString()}`);
console.log(`  Contributors:     ${gitResult.contributorCount}`);
console.log(`  Repo age:         ${gitResult.repoAgeYears} years (${gitResult.firstCommit} → ${gitResult.lastCommit})`);
console.log(`  Bus factor:       ${gitResult.busFactorAnalysis.busFactorNumber} (${gitResult.busFactorAnalysis.risk})`);
console.log(`  Narrative source: ${gitResult.narrativeSource}`);
console.log('\n  Top 5 contributors:');
gitResult.topContributors.slice(0, 5).forEach((c, i) => {
  console.log(`  ${i + 1}. ${c.name} — ${c.commits} commits (${c.percentOfTotal}%) last active ${c.lastActive}`);
});
console.log('\n  High churn files:');
gitResult.highChurnFiles.slice(0, 3).forEach(f => {
  console.log(`  · ${f.file} (${f.commits} commits)`);
});
console.log('\n  Narrative:');
console.log(`  "${gitResult.narrative}"\n`);

// ── Phase 3: Dependency Grapher ─────────────
console.log('[ Phase 3: Dependency Grapher ]\n');
console.time('dependency_grapher');
const depResult = await dependencyGrapher({ repoPath: REPO }).catch(err => {
  console.error('❌ Dependency Grapher failed:', err.message);
  process.exit(1);
});
console.timeEnd('dependency_grapher');

console.log(`  Build system:     ${depResult.buildSystem}`);
console.log(`  Dependencies:     ${depResult.totalDependencies}`);
console.log(`  CVEs found:       ${depResult.cveFlags.length}`);
console.log(`  Risk score:       ${depResult.riskScore}/10`);
console.log(`  Narrative source: ${depResult.narrativeSource}`);
console.log('\n  CVE flags:');
depResult.cveFlags.forEach(c => {
  console.log(`  ⚠️  ${c.id} (CVSS ${c.cvss}, ${c.severity}) — ${c.dependency}`);
  console.log(`      ${c.description}`);
});
console.log('\n  Risk narrative:');
console.log(`  "${depResult.riskNarrative}"\n`);

console.log('═══════════════════════════════════════════');
console.log('  ✅ Phase 2 + 3 complete.');
console.log('═══════════════════════════════════════════');
