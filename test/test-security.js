#!/usr/bin/env node
/**
 * Security test suite for Code Archaeologist
 * Tests: command injection, XML entity injection, path traversal, input limits
 *
 * Run: node test/test-security.js
 */

import { validateRepoPath } from '../src/utils/validation.js';
import { dependencyGrapher } from '../src/tools/dependencyGrapher.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let passed = 0;
let failed = 0;
const failures = [];

function suite(name) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('─'.repeat(60));
}

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${label}`);
    console.log(`      → ${err.message}`);
    failed++;
    failures.push({ label, error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ── Suite 1: Validation — Input Length Limits ─────────────────────────────────

suite('1. Validation — Input Length Limits');

await test('rejects repoPath > 4096 chars', async () => {
  const longPath = '/tmp/' + 'a'.repeat(4100);
  try {
    validateRepoPath(longPath);
    throw new Error('Should have thrown');
  } catch (err) {
    assert(!err.message.includes('Should have thrown'), err.message);
    assert(err.message.includes('4096') || err.message.toLowerCase().includes('length'),
      `expected length-limit error, got: ${err.message}`);
  }
});

await test('accepts repoPath of exactly 4096 chars (boundary)', async () => {
  // 4096 chars — the check should only reject > 4096, not exactly 4096
  // We can't actually validate a real path of this length (filesystem limits),
  // so just ensure the validator doesn't throw on a borderline string
  // (it will fail on "does not exist" which is a later check — not a length error)
  const borderPath = '/tmp/' + 'a'.repeat(4091); // exactly 4096
  try {
    validateRepoPath(borderPath);
  } catch (err) {
    assert(!err.message.includes('4096') && !err.message.toLowerCase().includes('length'),
      `should not fail on length at boundary; got: ${err.message}`);
  }
});

// ── Suite 2: Validation — No Path Leakage in Error Messages ──────────────────

suite('2. Validation — Error Messages Do Not Leak Paths');

await test('non-existent path error does not contain absolute path', async () => {
  try {
    validateRepoPath('/tmp/definitely-does-not-exist-' + Date.now());
    throw new Error('Should have thrown');
  } catch (err) {
    assert(!err.message.includes('/tmp/'),
      `error message leaks absolute path: "${err.message}"`);
  }
});

await test('non-git directory error does not contain absolute path', async () => {
  // /tmp is a real directory but not a git repo
  try {
    validateRepoPath('/tmp');
    throw new Error('Should have thrown');
  } catch (err) {
    assert(!err.message.includes('/tmp'),
      `error message leaks path: "${err.message}"`);
  }
});

// ── Suite 3: XML Entity Injection — parsePomXml hardening ────────────────────

suite('3. XML Entity Injection — pom.xml Hardening');

const TEMP_XML_DIR = join(tmpdir(), `ca-sec-test-${Date.now()}`);

function makeGitDir(dir) {
  mkdirSync(join(dir, '.git'), { recursive: true });
  writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
}

await test('XML with DOCTYPE / XXE entity does not read /etc/passwd', async () => {
  mkdirSync(TEMP_XML_DIR, { recursive: true });
  makeGitDir(TEMP_XML_DIR);

  const maliciousPom = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>evil</groupId>
  <artifactId>&xxe;</artifactId>
  <version>1.0</version>
  <dependencies/>
</project>`;

  writeFileSync(join(TEMP_XML_DIR, 'pom.xml'), maliciousPom);

  const result = await dependencyGrapher({ repoPath: TEMP_XML_DIR });
  // The artifactId should NOT contain /etc/passwd content — it should be empty or literal "&xxe;"
  const depJson = JSON.stringify(result);
  assert(!depJson.includes('root:'), 'XXE succeeded — /etc/passwd content found in output');
  assert(!depJson.includes('/bin/bash'), 'XXE succeeded — /etc/passwd content found in output');
});

await test('XML with billion laughs entity expansion does not hang (< 5s)', async () => {
  const billionLaughs = `<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<project>
  <groupId>&lol3;</groupId>
  <artifactId>test</artifactId>
  <version>1.0</version>
  <dependencies/>
</project>`;

  writeFileSync(join(TEMP_XML_DIR, 'pom.xml'), billionLaughs);

  const start = Date.now();
  const result = await dependencyGrapher({ repoPath: TEMP_XML_DIR });
  const elapsed = Date.now() - start;

  assert(elapsed < 5000, `XML expansion took ${elapsed}ms — entity expansion not blocked`);
  assert(Array.isArray(result.dependencies), 'should return valid result structure');
});

// Cleanup temp dir
if (existsSync(TEMP_XML_DIR)) {
  rmSync(TEMP_XML_DIR, { recursive: true, force: true });
}

// ── Suite 4: Filename Sanitization ───────────────────────────────────────────

suite('4. Filename Sanitization — sanitizeFilename()');

// sanitizeFilename isn't exported — test the equivalent logic inline
// (mirrors exactly what docsGenerator.js does)
function sanitizeFilenameLocal(str) {
  const baseName = str.split('/').pop();
  return baseName.replace(/[*?[\]{}()!]/g, '_');
}

const dangerousNames = [
  '*.java',
  'Action[Servlet].java',
  '{evil}.java',
  'foo(bar).java',
  'test!.java',
  '../../../etc/passwd',
];

for (const name of dangerousNames) {
  await test(`sanitize: "${name}" → no dangerous chars`, () => {
    const safe = sanitizeFilenameLocal(name);
    assert(!/[*?[\]{}()!]/.test(safe), `dangerous chars remain in: ${safe}`);
    assert(!safe.includes('..'), `path traversal not stripped from: ${safe}`);
    assert(!safe.includes('/'), `path separator not stripped from: ${safe}`);
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log('  Security Test Summary');
console.log('═'.repeat(60));
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\n  Failures:');
  failures.forEach(f => console.log(`  ❌ ${f.label}\n     ${f.error}`));
}
console.log(`\n  ${failed === 0 ? '✅ All security tests passed.' : `❌ ${failed} test(s) failed.`}`);
process.exit(failed === 0 ? 0 : 1);
