#!/usr/bin/env node
// Manual test — verifies all tool functions return valid JSON shapes.
// For git_historian and dependency_grapher, uses struts1 if available, otherwise skips.
// Run: npm test

import { excavateRepo } from '../src/tools/excavateRepo.js';
import { gitHistorian } from '../src/tools/gitHistorian.js';
import { dependencyGrapher } from '../src/tools/dependencyGrapher.js';
import { docsGenerator } from '../src/tools/docsGenerator.js';
import { existsSync } from 'fs';
import { homedir } from 'os';

const STUB_REPO = '/tmp/test-repo';
const REAL_REPO = process.env.TEST_REPO || `${homedir()}/struts1`;
const hasRealRepo = existsSync(REAL_REPO);

const results = [];

function check(label, condition) {
  const pass = Boolean(condition);
  console.log(pass ? `  ✅ ${label}` : `  ❌ ${label}`);
  return pass;
}

async function run() {
  console.log('═══════════════════════════════════════');
  console.log('  Code Archaeologist — Manual Test');
  console.log('═══════════════════════════════════════\n');

  // ── excavate_repo ──────────────────────────────
  console.log('[ excavate_repo ]');
  const erRepo = hasRealRepo ? REAL_REPO : STUB_REPO;
  if (!hasRealRepo) console.log(`  (using stub path — some phases will error gracefully)`);
  const er = await excavateRepo({ repoPath: erRepo });
  const erPass = [
    check('has repoPath',     er.repoPath === erRepo),
    check('has status',       typeof er.status === 'string'),
    check('phases is array',  Array.isArray(er.phases)),
    check('5 phases',         er.phases.length === 5),
    check('phase 3 ran',      ['complete', 'error'].includes(er.phases[2].status)),
    check('has completedAt',  typeof er.completedAt === 'string'),
    check('has report',       er.report !== null || er.phases[4].status === 'error')
  ].every(Boolean);
  results.push({ tool: 'excavate_repo', pass: erPass });

  // ── git_historian ──────────────────────────────
  console.log('\n[ git_historian ]');
  if (!hasRealRepo) {
    console.log(`  ⚠️  Skipped — real repo not found at ${REAL_REPO}`);
    console.log('      Set TEST_REPO env var or clone struts1 to ~/struts1');
    results.push({ tool: 'git_historian', pass: true, skipped: true });
  } else {
    console.log(`  (using ${REAL_REPO})`);
    const gh = await gitHistorian({ repoPath: REAL_REPO }).catch(err => { throw err; });
    const ghPass = [
      check('totalCommits > 0',           gh.totalCommits > 0),
      check('topContributors array',       Array.isArray(gh.topContributors)),
      check('busFactorAnalysis present',   typeof gh.busFactorAnalysis === 'object'),
      check('busFactorNumber is number',   typeof gh.busFactorAnalysis.busFactorNumber === 'number'),
      check('highChurnFiles array',        Array.isArray(gh.highChurnFiles)),
      check('narrative is string',         typeof gh.narrative === 'string'),
      check('knowledgeObituaries array',   Array.isArray(gh.knowledgeObituaries))
    ].every(Boolean);
    results.push({ tool: 'git_historian', pass: ghPass });
  }

  // ── dependency_grapher ─────────────────────────
  console.log('\n[ dependency_grapher ]');
  if (!hasRealRepo) {
    console.log(`  ⚠️  Skipped — real repo not found at ${REAL_REPO}`);
    results.push({ tool: 'dependency_grapher', pass: true, skipped: true });
  } else {
    console.log(`  (using ${REAL_REPO})`);
    const dg = await dependencyGrapher({ repoPath: REAL_REPO });
    const dgPass = [
      check('buildSystem is string',   typeof dg.buildSystem === 'string'),
      check('dependencies array',       Array.isArray(dg.dependencies)),
      check('cveFlags array',           Array.isArray(dg.cveFlags)),
      check('riskScore 1-10',           dg.riskScore >= 1 && dg.riskScore <= 10),
      check('riskNarrative is string',  typeof dg.riskNarrative === 'string'),
      check('cveSource is set',         ['osv', 'offline'].includes(dg.cveSource))
    ].every(Boolean);
    results.push({ tool: 'dependency_grapher', pass: dgPass });
  }

  // ── docs_generator ─────────────────────────────
  console.log('\n[ docs_generator ]');
  const dc = await docsGenerator({ repoPath: STUB_REPO });
  const dcPass = [
    check('executiveSummary is string',    typeof dc.executiveSummary === 'string'),
    check('onboardingReadme is string',    typeof dc.onboardingReadme === 'string'),
    check('modernizationRoadmap object',   typeof dc.modernizationRoadmap === 'object'),
    check('roadmap.critical array',        Array.isArray(dc.modernizationRoadmap.critical)),
    check('riskHeatmap object',            typeof dc.riskHeatmap === 'object'),
    check('riskHeatmap.overall number',    typeof dc.riskHeatmap.overall === 'number')
  ].every(Boolean);
  results.push({ tool: 'docs_generator', pass: dcPass });

  // ── Summary ─────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════');
  const allPassed = results.every(r => r.pass);
  results.forEach(r => {
    const icon = r.pass ? '✅' : '❌';
    const note = r.skipped ? ' (skipped — no real repo)' : '';
    console.log(`  ${icon}  ${r.tool}${note}`);
  });
  console.log(`\n  ${allPassed ? '✅ All tests passed.' : '❌ Some tests failed.'}`);
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
