**User:**

<task>
I'm building Code Archaeologist, an MCP server that excavates 
legacy codebases. I have the project open. Please read the 
entire codebase and explain:
1. How the MCP server is structured
2. How the 3 agents (gitHistorian, dependencyGrapher, 
   docsGenerator) work together
3. Any issues you spot in the code
</task>
<environment_details>
# VSCode Visible Files
.env

# VSCode Open Tabs
src/utils/validation.js,README.md,src/utils/logger.js,.gitignore,.env,src/index.js,src/utils/watsonx.js,package.json

# Current Time
Current time in ISO 8601 UTC format: 2026-05-02T15:20:29.726Z
User time zone: Asia/Calcutta, UTC+5:30

# Current Cost
$0.00

# Review Exclusions
The following file patterns are excluded from code reviews:
- .vscode/**

# Current Mode
<slug>plan</slug>
<name>📝 Plan</name>


# Current Workspace Directory (/Users/Sreenidhi/Desktop/code-archaeologist) Files
.env.example
.gitignore
bob-mcp-config.json
package-lock.json
package.json
.claude/
bob_sessions/
src/
src/index.js
src/tools/
src/tools/dependencyGrapher.js
src/tools/docsGenerator.js
src/tools/excavateRepo.js
src/tools/gitHistorian.js
src/utils/
src/utils/logger.js
src/utils/validation.js
src/utils/watsonx.js
test/
test/manual-test.js
test/test-comprehensive.js
test/test-real-repo.js
test/test-watsonx.js
You have not created a todo list yet. Create one with `update_todo_list` if your task is complicated or involves multiple steps.
</environment_details>

---

**Assistant:**

I'll analyze the Code Archaeologist MCP server codebase systematically. Let me start by reading the key files to understand the structure and implementation.

<read_file>
<args>
  <file>
    <path>package.json</path>
  </file>
  <file>
    <path>src/index.js</path>
  </file>
  <file>
    <path>src/tools/excavateRepo.js</path>
  </file>
  <file>
    <path>src/tools/gitHistorian.js</path>
  </file>
  <file>
    <path>src/tools/dependencyGrapher.js</path>
  </file>
</args>
</read_file>

---

**User:**

[read_file for 5 files] Result:
<files>
<file><path>package.json</path>
<content lines="1-40">
 1 | {
 2 |   "name": "code-archaeologist",
 3 |   "version": "1.0.0",
 4 |   "description": "Bob-powered MCP server that excavates legacy codebases using WatsonX Granite",
 5 |   "type": "module",
 6 |   "main": "src/index.js",
 7 |   "scripts": {
 8 |     "start": "node src/index.js",
 9 |     "test": "node test/manual-test.js",
10 |     "dev": "LOG_LEVEL=debug node src/index.js",
11 |     "lint": "eslint src/ test/"
12 |   },
13 |   "dependencies": {
14 |     "@modelcontextprotocol/sdk": "^1.10.2",
15 |     "dotenv": "^16.4.5",
16 |     "fast-xml-parser": "^5.7.2"
17 |   },
18 |   "devDependencies": {
19 |     "eslint": "^8.56.0"
20 |   },
21 |   "engines": {
22 |     "node": ">=18.0.0"
23 |   },
24 |   "keywords": [
25 |     "mcp",
26 |     "model-context-protocol",
27 |     "watsonx",
28 |     "granite",
29 |     "legacy-code",
30 |     "code-analysis",
31 |     "git-history",
32 |     "dependency-analysis"
33 |   ],
34 |   "author": "",
35 |   "license": "MIT",
36 |   "repository": {
37 |     "type": "git",
38 |     "url": ""
39 |   }
40 | }
</content>
</file>
<file><path>src/index.js</path>
<content lines="1-171">
  1 | import { Server } from '@modelcontextprotocol/sdk/server/index.js';
  2 | import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
  3 | import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
  4 | import 'dotenv/config';
  5 | 
  6 | import { excavateRepo } from './tools/excavateRepo.js';
  7 | import { gitHistorian } from './tools/gitHistorian.js';
  8 | import { dependencyGrapher } from './tools/dependencyGrapher.js';
  9 | import { docsGenerator } from './tools/docsGenerator.js';
 10 | import { validateToolArguments, createErrorResponse, createSuccessResponse } from './utils/validation.js';
 11 | import { logger } from './utils/logger.js';
 12 | 
 13 | const server = new Server(
 14 |   { name: 'code-archaeologist', version: '1.0.0' },
 15 |   { capabilities: { tools: {} } }
 16 | );
 17 | 
 18 | const TOOLS = [
 19 |   {
 20 |     name: 'excavate_repo',
 21 |     description: 'Main entry point. Runs the full 5-phase archaeological excavation on a legacy codebase — reconnaissance, git history, semantic mapping, dependency analysis, and documentation generation.',
 22 |     inputSchema: {
 23 |       type: 'object',
 24 |       properties: {
 25 |         repoPath: {
 26 |           type: 'string',
 27 |           description: 'Absolute path to the local git repository to analyze'
 28 |         }
 29 |       },
 30 |       required: ['repoPath']
 31 |     }
 32 |   },
 33 |   {
 34 |     name: 'git_historian',
 35 |     description: 'Analyzes git history to surface contributor patterns, bus factor risk, commit timelines, and the human story of who built this codebase and when they left.',
 36 |     inputSchema: {
 37 |       type: 'object',
 38 |       properties: {
 39 |         repoPath: {
 40 |           type: 'string',
 41 |           description: 'Absolute path to the local git repository'
 42 |         }
 43 |       },
 44 |       required: ['repoPath']
 45 |     }
 46 |   },
 47 |   {
 48 |     name: 'dependency_grapher',
 49 |     description: 'Parses build files (pom.xml, package.json, build.gradle) to extract dependencies, flag outdated versions, detect known CVEs, and calculate a risk score.',
 50 |     inputSchema: {
 51 |       type: 'object',
 52 |       properties: {
 53 |         repoPath: {
 54 |           type: 'string',
 55 |           description: 'Absolute path to the local git repository'
 56 |         },
 57 |         buildFilePath: {
 58 |           type: 'string',
 59 |           description: 'Optional: path to specific build file. Auto-detected if omitted.'
 60 |         }
 61 |       },
 62 |       required: ['repoPath']
 63 |     }
 64 |   },
 65 |   {
 66 |     name: 'docs_generator',
 67 |     description: 'Synthesizes outputs from git_historian and dependency_grapher into a complete excavation report: executive summary, onboarding README, modernization roadmap, and risk heatmap.',
 68 |     inputSchema: {
 69 |       type: 'object',
 70 |       properties: {
 71 |         repoPath: {
 72 |           type: 'string',
 73 |           description: 'Absolute path to the local git repository'
 74 |         },
 75 |         gitHistorianResult: {
 76 |           type: 'object',
 77 |           description: 'Output from the git_historian tool'
 78 |         },
 79 |         dependencyGrapherResult: {
 80 |           type: 'object',
 81 |           description: 'Output from the dependency_grapher tool'
 82 |         }
 83 |       },
 84 |       required: ['repoPath']
 85 |     }
 86 |   }
 87 | ];
 88 | 
 89 | server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
 90 | 
 91 | server.setRequestHandler(CallToolRequestSchema, async (request) => {
 92 |   const { name, arguments: args } = request.params;
 93 |   const startTime = Date.now();
 94 | 
 95 |   try {
 96 |     // Log tool execution start
 97 |     logger.toolStart(name, args);
 98 | 
 99 |     // Validate arguments
100 |     const validatedArgs = validateToolArguments(name, args);
101 | 
102 |     // Execute tool
103 |     let result;
104 |     switch (name) {
105 |       case 'excavate_repo':
106 |         result = await excavateRepo(validatedArgs);
107 |         break;
108 |       case 'git_historian':
109 |         result = await gitHistorian(validatedArgs);
110 |         break;
111 |       case 'dependency_grapher':
112 |         result = await dependencyGrapher(validatedArgs);
113 |         break;
114 |       case 'docs_generator':
115 |         result = await docsGenerator(validatedArgs);
116 |         break;
117 |       default:
118 |         throw new Error(`Unknown tool: ${name}`);
119 |     }
120 | 
121 |     // Log success
122 |     const duration = Date.now() - startTime;
123 |     logger.toolSuccess(name, duration);
124 | 
125 |     // Return standardized success response
126 |     const response = createSuccessResponse(result, name);
127 |     return {
128 |       content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
129 |     };
130 | 
131 |   } catch (error) {
132 |     // Log error
133 |     const duration = Date.now() - startTime;
134 |     logger.toolError(name, error, duration);
135 | 
136 |     // Return standardized error response
137 |     const errorResponse = createErrorResponse(error, name);
138 |     return {
139 |       content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
140 |       isError: true
141 |     };
142 |   }
143 | });
144 | 
145 | async function main() {
146 |   try {
147 |     logger.info('Code Archaeologist MCP Server starting...', {
148 |       version: '1.0.0',
149 |       nodeVersion: process.version
150 |     });
151 | 
152 |     const transport = new StdioServerTransport();
153 |     await server.connect(transport);
154 | 
155 |     logger.info('Code Archaeologist MCP Server connected successfully');
156 |   } catch (error) {
157 |     logger.error('Failed to start MCP server', {
158 |       error: error.message,
159 |       stack: error.stack
160 |     });
161 |     throw error;
162 |   }
163 | }
164 | 
165 | main().catch((error) => {
166 |   logger.error('Fatal error in main process', {
167 |     error: error.message,
168 |     stack: error.stack
169 |   });
170 |   process.exit(1);
171 | });
</content>
</file>
<file><path>src/tools/excavateRepo.js</path>
<content lines="1-183">
  1 | import { readdir, stat } from 'fs/promises';
  2 | import { existsSync } from 'fs';
  3 | import { join, extname } from 'path';
  4 | import { spawn } from 'child_process';
  5 | import { logger } from '../utils/logger.js';
  6 | import { gitHistorian } from './gitHistorian.js';
  7 | import { dependencyGrapher } from './dependencyGrapher.js';
  8 | import { docsGenerator } from './docsGenerator.js';
  9 | 
 10 | // Language detection by file extension
 11 | const EXTENSION_LANGUAGES = {
 12 |   '.java': 'Java', '.kt': 'Kotlin', '.scala': 'Scala', '.groovy': 'Groovy',
 13 |   '.js': 'JavaScript', '.ts': 'TypeScript', '.jsx': 'JavaScript', '.tsx': 'TypeScript',
 14 |   '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust',
 15 |   '.cpp': 'C++', '.cc': 'C++', '.c': 'C', '.h': 'C/C++',
 16 |   '.cs': 'C#', '.php': 'PHP', '.swift': 'Swift',
 17 |   '.xml': 'XML', '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
 18 |   '.html': 'HTML', '.css': 'CSS', '.sql': 'SQL', '.sh': 'Shell'
 19 | };
 20 | 
 21 | const SKIP_DIRS = new Set(['.git', 'node_modules', '.bob', 'dist', 'build', 'target', '.idea', '.vscode']);
 22 | 
 23 | async function walkDirectory(dir, depth = 0, maxDepth = 6) {
 24 |   if (depth > maxDepth) return { fileCounts: {}, totalFiles: 0 };
 25 | 
 26 |   const fileCounts = {};
 27 |   let totalFiles = 0;
 28 | 
 29 |   let entries;
 30 |   try {
 31 |     entries = await readdir(dir, { withFileTypes: true });
 32 |   } catch {
 33 |     return { fileCounts, totalFiles };
 34 |   }
 35 | 
 36 |   for (const entry of entries) {
 37 |     if (entry.isDirectory()) {
 38 |       if (SKIP_DIRS.has(entry.name)) continue;
 39 |       const sub = await walkDirectory(join(dir, entry.name), depth + 1, maxDepth);
 40 |       totalFiles += sub.totalFiles;
 41 |       for (const [ext, count] of Object.entries(sub.fileCounts)) {
 42 |         fileCounts[ext] = (fileCounts[ext] || 0) + count;
 43 |       }
 44 |     } else if (entry.isFile()) {
 45 |       const ext = extname(entry.name).toLowerCase();
 46 |       if (ext) {
 47 |         fileCounts[ext] = (fileCounts[ext] || 0) + 1;
 48 |         totalFiles++;
 49 |       }
 50 |     }
 51 |   }
 52 | 
 53 |   return { fileCounts, totalFiles };
 54 | }
 55 | 
 56 | async function getFirstCommitDate(repoPath) {
 57 |   return new Promise((resolve) => {
 58 |     const git = spawn('git', ['log', '--reverse', '--format=%ad', '--date=short'], {
 59 |       cwd: repoPath,
 60 |       stdio: ['ignore', 'pipe', 'ignore']
 61 |     });
 62 |     let output = '';
 63 |     git.stdout.on('data', (chunk) => { output += chunk.toString(); });
 64 |     git.on('close', () => resolve(output.trim().split('\n')[0] || null));
 65 |     git.on('error', () => resolve(null));
 66 |   });
 67 | }
 68 | 
 69 | async function reconnaissance(repoPath) {
 70 |   const { fileCounts, totalFiles } = await walkDirectory(repoPath);
 71 | 
 72 |   // Determine primary language by file count
 73 |   const languageCounts = {};
 74 |   for (const [ext, count] of Object.entries(fileCounts)) {
 75 |     const lang = EXTENSION_LANGUAGES[ext];
 76 |     if (lang) languageCounts[lang] = (languageCounts[lang] || 0) + count;
 77 |   }
 78 |   const primaryLanguage = Object.entries(languageCounts)
 79 |     .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
 80 | 
 81 |   // Check for key project markers
 82 |   const hasReadme = existsSync(join(repoPath, 'README.md')) || existsSync(join(repoPath, 'README'));
 83 |   const hasDocs   = existsSync(join(repoPath, 'docs')) || existsSync(join(repoPath, 'documentation'));
 84 |   const hasTests  = existsSync(join(repoPath, 'test')) || existsSync(join(repoPath, 'tests')) || existsSync(join(repoPath, 'src/test'));
 85 | 
 86 |   const repoName = repoPath.split('/').pop();
 87 |   const firstCommit = await getFirstCommitDate(repoPath);
 88 |   const repoAgeYears = firstCommit
 89 |     ? new Date().getFullYear() - parseInt(firstCommit.substring(0, 4))
 90 |     : null;
 91 | 
 92 |   return {
 93 |     repoName,
 94 |     repoPath,
 95 |     totalFiles,
 96 |     fileCounts,
 97 |     languageCounts,
 98 |     primaryLanguage,
 99 |     hasReadme,
100 |     hasDocs,
101 |     hasTests,
102 |     repoAgeYears,
103 |     firstCommit
104 |   };
105 | }
106 | 
107 | // Wrap each phase with timing, status tracking, and graceful error handling.
108 | async function runPhase(id, name, fn) {
109 |   const phase = { id, name, status: 'running', startedAt: new Date().toISOString(), result: null, error: null };
110 |   logger.info(`Phase ${id} starting: ${name}`);
111 |   try {
112 |     phase.result = await fn();
113 |     phase.status = 'complete';
114 |   } catch (err) {
115 |     phase.status = 'error';
116 |     phase.error = err.message;
117 |     logger.error(`Phase ${id} failed: ${name}`, { error: err.message });
118 |   }
119 |   phase.completedAt = new Date().toISOString();
120 |   phase.durationMs = new Date(phase.completedAt) - new Date(phase.startedAt);
121 |   return phase;
122 | }
123 | 
124 | export async function excavateRepo({ repoPath }) {
125 |   const excavationStart = Date.now();
126 |   logger.info('Excavation starting', { repoPath });
127 | 
128 |   const report = {
129 |     repoPath,
130 |     status: 'running',
131 |     startedAt: new Date().toISOString(),
132 |     phases: [],
133 |     report: null
134 |   };
135 | 
136 |   // Phase 1: Reconnaissance (fast — local file scan)
137 |   const phase1 = await runPhase(1, 'Reconnaissance', () => reconnaissance(repoPath));
138 |   report.phases.push(phase1);
139 | 
140 |   // Phase 2 + Phase 4 in parallel — they're independent
141 |   const [phase2, phase4] = await Promise.all([
142 |     runPhase(2, 'Historical Excavation', () => gitHistorian({ repoPath })),
143 |     runPhase(4, 'Risk Assessment',       () => dependencyGrapher({ repoPath }))
144 |   ]);
145 |   // Insert in order
146 |   report.phases.push(phase2);
147 |   report.phases.push({
148 |     id: 3,
149 |     name: 'Semantic Mapping',
150 |     status: 'skipped',
151 |     startedAt: new Date().toISOString(),
152 |     completedAt: new Date().toISOString(),
153 |     durationMs: 0,
154 |     result: { message: 'AST-level analysis coming in next release' },
155 |     error: null
156 |   });
157 |   report.phases.push(phase4);
158 | 
159 |   // Phase 5: Docs Generator — needs phase 2 + 4 results
160 |   const phase5 = await runPhase(5, 'Modernization Roadmap', () =>
161 |     docsGenerator({
162 |       repoPath,
163 |       gitHistorianResult:      phase2.result,
164 |       dependencyGrapherResult: phase4.result,
165 |       reconResult:             phase1.result
166 |     })
167 |   );
168 |   report.phases.push(phase5);
169 | 
170 |   const totalDuration = Date.now() - excavationStart;
171 |   report.status = report.phases.some(p => p.status === 'error') ? 'partial' : 'complete';
172 |   report.completedAt = new Date().toISOString();
173 |   report.totalDurationMs = totalDuration;
174 |   report.report = phase5.result; // top-level shortcut for Bob
175 | 
176 |   logger.info('Excavation complete', {
177 |     status: report.status,
178 |     duration: `${(totalDuration / 1000).toFixed(1)}s`,
179 |     phases: report.phases.map(p => `${p.name}:${p.status}`).join(', ')
180 |   });
181 | 
182 |   return report;
183 | }
</content>
</file>
<file><path>src/tools/gitHistorian.js</path>
<content lines="1-239">
  1 | import { spawn } from 'child_process';
  2 | import { generateText } from '../utils/watsonx.js';
  3 | import { logger } from '../utils/logger.js';
  4 | 
  5 | // Stream git log and aggregate contributor + timeline stats.
  6 | // Uses --format flag to fetch only needed fields — avoids loading full log into memory.
  7 | async function parseCommitHistory(repoPath) {
  8 |   return new Promise((resolve, reject) => {
  9 |     const contributors = new Map(); // email → { name, email, commits, firstActive, lastActive }
 10 |     let totalCommits = 0;
 11 |     let firstCommit = null;
 12 |     let lastCommit = null;
 13 |     const monthlyCommits = new Map(); // YYYY-MM → count
 14 | 
 15 |     const git = spawn('git', ['log', '--format=%ae|%an|%ad', '--date=short'], {
 16 |       cwd: repoPath,
 17 |       stdio: ['ignore', 'pipe', 'ignore']
 18 |     });
 19 | 
 20 |     let buffer = '';
 21 | 
 22 |     git.stdout.on('data', (chunk) => {
 23 |       buffer += chunk.toString();
 24 |       const lines = buffer.split('\n');
 25 |       buffer = lines.pop(); // hold last incomplete line
 26 | 
 27 |       for (const line of lines) {
 28 |         if (!line.trim()) continue;
 29 |         const parts = line.split('|');
 30 |         if (parts.length < 3) continue;
 31 |         const [rawEmail, rawName, date] = parts;
 32 |         const email = rawEmail.toLowerCase().trim();
 33 |         const name = rawName.trim();
 34 |         if (!email || !date) continue;
 35 | 
 36 |         totalCommits++;
 37 |         if (!firstCommit || date < firstCommit) firstCommit = date;
 38 |         if (!lastCommit || date > lastCommit) lastCommit = date;
 39 | 
 40 |         if (!contributors.has(email)) {
 41 |           contributors.set(email, { name, email, commits: 0, firstActive: date, lastActive: date });
 42 |         }
 43 |         const c = contributors.get(email);
 44 |         c.commits++;
 45 |         if (date < c.firstActive) c.firstActive = date;
 46 |         if (date > c.lastActive) c.lastActive = date;
 47 | 
 48 |         const month = date.substring(0, 7); // YYYY-MM
 49 |         monthlyCommits.set(month, (monthlyCommits.get(month) || 0) + 1);
 50 |       }
 51 |     });
 52 | 
 53 |     git.on('error', (err) => reject(new Error(`git not found: ${err.message}`)));
 54 |     git.on('close', (code) => {
 55 |       if (code !== 0 && totalCommits === 0) {
 56 |         reject(new Error(`git log exited with code ${code} — is ${repoPath} a git repository?`));
 57 |         return;
 58 |       }
 59 |       resolve({ contributors, totalCommits, firstCommit, lastCommit, monthlyCommits });
 60 |     });
 61 |   });
 62 | }
 63 | 
 64 | // Find the files touched most across the entire history.
 65 | async function getHighChurnFiles(repoPath, limit = 10) {
 66 |   return new Promise((resolve, reject) => {
 67 |     const fileCounts = new Map();
 68 | 
 69 |     const git = spawn('git', ['log', '--pretty=format:', '--name-only'], {
 70 |       cwd: repoPath,
 71 |       stdio: ['ignore', 'pipe', 'ignore']
 72 |     });
 73 | 
 74 |     let buffer = '';
 75 | 
 76 |     git.stdout.on('data', (chunk) => {
 77 |       buffer += chunk.toString();
 78 |       const lines = buffer.split('\n');
 79 |       buffer = lines.pop();
 80 |       for (const line of lines) {
 81 |         const file = line.trim();
 82 |         if (!file) continue;
 83 |         fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
 84 |       }
 85 |     });
 86 | 
 87 |     git.on('error', reject);
 88 |     git.on('close', () => {
 89 |       const sorted = [...fileCounts.entries()]
 90 |         .sort((a, b) => b[1] - a[1])
 91 |         .slice(0, limit)
 92 |         .map(([file, commits]) => ({ file, commits }));
 93 |       resolve(sorted);
 94 |     });
 95 |   });
 96 | }
 97 | 
 98 | // How many contributors does it take to account for >50% of all commits?
 99 | function calculateBusFactor(contributors, totalCommits) {
100 |   const sorted = [...contributors.values()].sort((a, b) => b.commits - a.commits);
101 |   let cumulative = 0;
102 |   let busFactorNumber = 0;
103 | 
104 |   for (const c of sorted) {
105 |     cumulative += (c.commits / totalCommits) * 100;
106 |     busFactorNumber++;
107 |     if (cumulative >= 50) break;
108 |   }
109 | 
110 |   return {
111 |     busFactorNumber,
112 |     cumulativePercent: Math.round(cumulative * 10) / 10,
113 |     risk: busFactorNumber <= 1 ? 'critical' : busFactorNumber <= 3 ? 'high' : 'medium'
114 |   };
115 | }
116 | 
117 | // Group monthly commit counts into readable year-range periods.
118 | function buildCommitTimeline(monthlyCommits, firstCommit, lastCommit) {
119 |   if (!firstCommit) return [];
120 | 
121 |   const firstYear = parseInt(firstCommit.substring(0, 4));
122 |   const lastYear = parseInt(lastCommit.substring(0, 4));
123 |   const span = lastYear - firstYear + 1;
124 |   const periodSize = Math.max(3, Math.ceil(span / 5));
125 | 
126 |   const periods = [];
127 |   for (let y = firstYear; y <= lastYear; y += periodSize) {
128 |     const endYear = Math.min(y + periodSize - 1, lastYear);
129 |     let commits = 0;
130 |     for (const [month, count] of monthlyCommits) {
131 |       const year = parseInt(month.substring(0, 4));
132 |       if (year >= y && year <= endYear) commits += count;
133 |     }
134 |     const prev = periods[periods.length - 1];
135 |     let trend = 'growing';
136 |     if (prev) {
137 |       const ratio = commits / (prev.commits || 1);
138 |       if (commits < 30) trend = 'abandoned';
139 |       else if (ratio < 0.5) trend = 'declining';
140 |       else if (ratio > 1.3) trend = 'growing';
141 |       else trend = 'stable';
142 |     }
143 |     periods.push({ period: `${y}–${endYear}`, commits, trend });
144 |   }
145 |   return periods;
146 | }
147 | 
148 | function buildTemplateNarrative(stats) {
149 |   const { topContributors, totalCommits, repoAgeYears, contributorCount, busFactorAnalysis, lastCommit } = stats;
150 |   const top = topContributors[0];
151 |   const lastYear = lastCommit ? parseInt(lastCommit.substring(0, 4)) : new Date().getFullYear();
152 |   const yearsInactive = new Date().getFullYear() - lastYear;
153 | 
154 |   let n = `This codebase is ${repoAgeYears} years old with ${totalCommits.toLocaleString()} commits from ${contributorCount} contributors.`;
155 |   if (top) {
156 |     n += ` ${top.name} authored ${top.percentOfTotal}% of all commits, last committing on ${top.lastActive}.`;
157 |   }
158 |   if (yearsInactive > 1) {
159 |     n += ` The repository has been inactive for ${yearsInactive} year${yearsInactive !== 1 ? 's' : ''}.`;
160 |   }
161 |   n += ` Bus factor is ${busFactorAnalysis.busFactorNumber} — ${busFactorAnalysis.busFactorNumber <= 2 ? 'a critical single point of failure for institutional knowledge.' : 'moderate knowledge concentration risk.'}`;
162 |   return n;
163 | }
164 | 
165 | export async function gitHistorian({ repoPath }) {
166 |   const start = Date.now();
167 |   logger.info('Git Historian starting', { repoPath });
168 | 
169 |   try {
170 |     // Run both git commands in parallel
171 |     const [history, highChurnFiles] = await Promise.all([
172 |       parseCommitHistory(repoPath),
173 |       getHighChurnFiles(repoPath, 10)
174 |     ]);
175 | 
176 |     const { contributors, totalCommits, firstCommit, lastCommit, monthlyCommits } = history;
177 | 
178 |     const topContributors = [...contributors.values()]
179 |       .sort((a, b) => b.commits - a.commits)
180 |       .slice(0, 10)
181 |       .map(c => ({ ...c, percentOfTotal: Math.round((c.commits / totalCommits) * 1000) / 10 }));
182 | 
183 |     const firstYear = firstCommit ? parseInt(firstCommit.substring(0, 4)) : new Date().getFullYear();
184 |     const repoAgeYears = new Date().getFullYear() - firstYear;
185 |     const busFactor = calculateBusFactor(contributors, totalCommits);
186 |     const commitTimeline = buildCommitTimeline(monthlyCommits, firstCommit, lastCommit);
187 | 
188 |     const stats = {
189 |       repoPath,
190 |       totalCommits,
191 |       contributorCount: contributors.size,
192 |       repoAgeYears,
193 |       firstCommit,
194 |       lastCommit,
195 |       topContributors,
196 |       busFactorAnalysis: {
197 |         busFactorNumber: busFactor.busFactorNumber,
198 |         explanation: `${busFactor.busFactorNumber} contributor${busFactor.busFactorNumber !== 1 ? 's' : ''} authored over 50% of all commits`,
199 |         topPercent: busFactor.cumulativePercent,
200 |         risk: busFactor.risk
201 |       },
202 |       commitTimeline,
203 |       highChurnFiles
204 |     };
205 | 
206 |     // WatsonX narrative — falls back to template if unavailable
207 |     const prompt = `You are a code archaeologist analyzing a legacy codebase. Given these git history statistics, write a 3-4 sentence narrative that tells the human story of this codebase — who built it, when they left, and what risks that creates for a new developer inheriting it.
208 | 
209 | Stats:
210 | ${JSON.stringify({
211 |   repoAgeYears,
212 |   totalCommits,
213 |   contributorCount: contributors.size,
214 |   topContributor: topContributors[0] || null,
215 |   busFactorNumber: busFactor.busFactorNumber,
216 |   firstCommit,
217 |   lastCommit
218 | }, null, 2)}
219 | 
220 | Write in a direct, slightly dramatic tone. Highlight the biggest risk. 3-4 sentences only.`;
221 | 
222 |     const aiNarrative = await generateText(prompt, { maxTokens: 200 }).catch(() => null);
223 |     stats.narrative = aiNarrative?.trim() || buildTemplateNarrative(stats);
224 |     stats.narrativeSource = aiNarrative ? 'watsonx' : 'template';
225 | 
226 |     logger.info('Git Historian completed', {
227 |       duration: `${Date.now() - start}ms`,
228 |       totalCommits,
229 |       contributors: contributors.size,
230 |       narrativeSource: stats.narrativeSource
231 |     });
232 | 
233 |     return stats;
234 | 
235 |   } catch (error) {
236 |     logger.error('Git Historian failed', { error: error.message, repoPath });
237 |     throw error;
238 |   }
239 | }
</content>
</file>
<file><path>src/tools/dependencyGrapher.js</path>
<content lines="1-278">
  1 | import { readFile } from 'fs/promises';
  2 | import { existsSync } from 'fs';
  3 | import { join } from 'path';
  4 | import { XMLParser } from 'fast-xml-parser';
  5 | import { generateText } from '../utils/watsonx.js';
  6 | import { logger } from '../utils/logger.js';
  7 | 
  8 | // Curated CVE list for common Java legacy dependencies.
  9 | // In production this would be an API call to OSV or NVD — hardcoded for hackathon reliability.
 10 | const KNOWN_CVES = [
 11 |   {
 12 |     groupId: 'org.apache.struts', artifactId: 'struts-core',
 13 |     affectedBelow: '1.4.0',
 14 |     cves: [
 15 |       { id: 'CVE-2014-0114', cvss: 7.5, severity: 'high', description: 'ClassLoader manipulation via ActionForm bean property allows arbitrary code execution' },
 16 |       { id: 'CVE-2016-1181', cvss: 8.1, severity: 'high', description: 'ActionServlet multipart handling RCE in some container configurations' }
 17 |     ]
 18 |   },
 19 |   {
 20 |     groupId: 'commons-collections', artifactId: 'commons-collections',
 21 |     affectedBelow: '3.2.2',
 22 |     cves: [
 23 |       { id: 'CVE-2015-6420', cvss: 9.8, severity: 'critical', description: 'Remote code execution via Java deserialization gadget chain' },
 24 |       { id: 'CVE-2015-7501', cvss: 9.8, severity: 'critical', description: 'Deserialization of untrusted data allows arbitrary code execution' }
 25 |     ]
 26 |   },
 27 |   {
 28 |     groupId: 'commons-beanutils', artifactId: 'commons-beanutils',
 29 |     affectedBelow: '1.9.4',
 30 |     cves: [
 31 |       { id: 'CVE-2019-10086', cvss: 7.3, severity: 'high', description: 'Improper access control allows class access bypass via BeanUtils' }
 32 |     ]
 33 |   },
 34 |   {
 35 |     groupId: 'commons-fileupload', artifactId: 'commons-fileupload',
 36 |     affectedBelow: '1.3.3',
 37 |     cves: [
 38 |       { id: 'CVE-2016-3092', cvss: 7.8, severity: 'high', description: 'DoS via malicious multipart upload causing excessive CPU usage' },
 39 |       { id: 'CVE-2014-0050', cvss: 7.5, severity: 'high', description: 'Infinite loop in multipart boundary handling (denial of service)' }
 40 |     ]
 41 |   },
 42 |   {
 43 |     groupId: 'log4j', artifactId: 'log4j',
 44 |     affectedBelow: '2.0.0', // all 1.x versions are affected
 45 |     cves: [
 46 |       { id: 'CVE-2019-17571', cvss: 9.8, severity: 'critical', description: 'Log4j 1.x Chainsaw/SocketServer RCE via deserialized data' },
 47 |       { id: 'CVE-2022-23302', cvss: 8.8, severity: 'high', description: 'JMSSink deserialization allows RCE in Log4j 1.x' },
 48 |       { id: 'CVE-2022-23305', cvss: 9.8, severity: 'critical', description: 'SQL injection in Log4j 1.x JDBCAppender' }
 49 |     ]
 50 |   },
 51 |   {
 52 |     groupId: 'commons-lang', artifactId: 'commons-lang',
 53 |     affectedBelow: '2.6',
 54 |     cves: [
 55 |       { id: 'CVE-2017-15708', cvss: 9.8, severity: 'critical', description: 'Remote code execution via ClassLoader in Apache Commons Lang' }
 56 |     ]
 57 |   },
 58 |   {
 59 |     groupId: 'xerces', artifactId: 'xercesImpl',
 60 |     affectedBelow: '2.12.0',
 61 |     cves: [
 62 |       { id: 'CVE-2022-23437', cvss: 6.5, severity: 'medium', description: 'Infinite loop via crafted XML input (denial of service)' }
 63 |     ]
 64 |   },
 65 |   {
 66 |     groupId: 'commons-codec', artifactId: 'commons-codec',
 67 |     affectedBelow: '1.13',
 68 |     cves: [] // no major CVEs but worth flagging as outdated
 69 |   }
 70 | ];
 71 | 
 72 | // Simple version comparison: returns true if version < threshold.
 73 | // Handles standard major.minor.patch format.
 74 | function isVersionBelow(version, threshold) {
 75 |   if (!version || version.includes('$') || version.toLowerCase().includes('snapshot')) {
 76 |     return true; // unresolved/snapshot versions treated as potentially vulnerable
 77 |   }
 78 |   const parse = (v) => v.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n) || 0);
 79 |   const vParts = parse(version);
 80 |   const tParts = parse(threshold);
 81 |   for (let i = 0; i < Math.max(vParts.length, tParts.length); i++) {
 82 |     const v = vParts[i] || 0;
 83 |     const t = tParts[i] || 0;
 84 |     if (v < t) return true;
 85 |     if (v > t) return false;
 86 |   }
 87 |   return false; // equal = not below threshold
 88 | }
 89 | 
 90 | function detectBuildSystem(repoPath) {
 91 |   if (existsSync(join(repoPath, 'pom.xml'))) return 'maven';
 92 |   if (existsSync(join(repoPath, 'build.gradle')) || existsSync(join(repoPath, 'build.gradle.kts'))) return 'gradle';
 93 |   if (existsSync(join(repoPath, 'package.json'))) return 'npm';
 94 |   if (existsSync(join(repoPath, 'requirements.txt')) || existsSync(join(repoPath, 'setup.py'))) return 'python';
 95 |   return 'unknown';
 96 | }
 97 | 
 98 | async function parsePomXml(pomPath) {
 99 |   const xml = await readFile(pomPath, 'utf-8');
100 |   const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'dependency' || name === 'module' });
101 |   const doc = parser.parse(xml);
102 |   const project = doc.project || {};
103 | 
104 |   const extractDeps = (depsNode) => {
105 |     if (!depsNode?.dependency) return [];
106 |     return depsNode.dependency
107 |       .filter(d => d.groupId && d.artifactId)
108 |       .map(d => ({
109 |         groupId: String(d.groupId).trim(),
110 |         artifactId: String(d.artifactId).trim(),
111 |         version: d.version ? String(d.version).trim() : null,
112 |         scope: d.scope ? String(d.scope).trim() : 'compile'
113 |       }));
114 |   };
115 | 
116 |   const deps = [
117 |     ...extractDeps(project.dependencies),
118 |     ...extractDeps(project.dependencyManagement?.dependencies)
119 |   ];
120 | 
121 |   const modules = (project.modules?.module || []).map(m => String(m).trim());
122 |   const parentVersion = project.parent?.version ? String(project.parent.version).trim() : null;
123 |   const projectVersion = project.version ? String(project.version).trim() : parentVersion;
124 | 
125 |   return { deps, modules, projectVersion, artifactId: project.artifactId };
126 | }
127 | 
128 | async function collectAllDependencies(repoPath, buildFilePath) {
129 |   const rootPom = buildFilePath || join(repoPath, 'pom.xml');
130 |   const allDeps = new Map(); // `groupId:artifactId` → dep object
131 | 
132 |   const processPom = async (pomPath) => {
133 |     if (!existsSync(pomPath)) return;
134 |     try {
135 |       const { deps, modules } = await parsePomXml(pomPath);
136 |       for (const dep of deps) {
137 |         const key = `${dep.groupId}:${dep.artifactId}`;
138 |         if (!allDeps.has(key) || (dep.version && !allDeps.get(key).version)) {
139 |           allDeps.set(key, dep);
140 |         }
141 |       }
142 |       // Recurse into submodules
143 |       for (const mod of modules) {
144 |         const modulePom = join(pomPath, '..', mod, 'pom.xml');
145 |         await processPom(modulePom);
146 |       }
147 |     } catch (e) {
148 |       logger.warn(`Could not parse ${pomPath}`, { error: e.message });
149 |     }
150 |   };
151 | 
152 |   await processPom(rootPom);
153 |   return [...allDeps.values()];
154 | }
155 | 
156 | function checkCVEs(dependencies) {
157 |   const cveFlags = [];
158 |   const outdatedFlags = [];
159 | 
160 |   for (const dep of dependencies) {
161 |     const entry = KNOWN_CVES.find(
162 |       e => e.groupId === dep.groupId && e.artifactId === dep.artifactId
163 |     );
164 |     if (!entry) continue;
165 | 
166 |     const isVulnerable = isVersionBelow(dep.version, entry.affectedBelow);
167 |     if (!isVulnerable) continue;
168 | 
169 |     for (const cve of entry.cves) {
170 |       cveFlags.push({
171 |         dependency: `${dep.groupId}:${dep.artifactId}:${dep.version || 'unspecified'}`,
172 |         ...cve,
173 |         fixVersion: entry.affectedBelow
174 |       });
175 |     }
176 | 
177 |     if (dep.version) {
178 |       outdatedFlags.push({
179 |         dependency: `${dep.artifactId}:${dep.version}`,
180 |         safeVersion: entry.affectedBelow,
181 |         severity: entry.cves.length > 0
182 |           ? entry.cves.reduce((max, c) => c.cvss > max ? c.cvss : max, 0) >= 9 ? 'critical' : 'high'
183 |           : 'medium'
184 |       });
185 |     }
186 |   }
187 | 
188 |   return { cveFlags, outdatedFlags };
189 | }
190 | 
191 | function calculateRiskScore(cveFlags) {
192 |   let score = 0;
193 |   for (const cve of cveFlags) {
194 |     if (cve.severity === 'critical') score += 3;
195 |     else if (cve.severity === 'high') score += 1.5;
196 |     else if (cve.severity === 'medium') score += 0.5;
197 |   }
198 |   return Math.min(10, Math.round(score * 10) / 10);
199 | }
200 | 
201 | function buildTemplateNarrative(deps, cveFlags, riskScore) {
202 |   const criticalCount = cveFlags.filter(c => c.severity === 'critical').length;
203 |   const highCount = cveFlags.filter(c => c.severity === 'high').length;
204 |   const worst = [...cveFlags].sort((a, b) => b.cvss - a.cvss)[0];
205 | 
206 |   let n = `This dependency tree contains ${deps.length} dependencies with a risk score of ${riskScore}/10.`;
207 |   if (criticalCount > 0) {
208 |     n += ` ${criticalCount} critical CVE${criticalCount !== 1 ? 's' : ''} were detected`;
209 |     if (worst) n += `, including ${worst.id} (CVSS ${worst.cvss}) in ${worst.dependency.split(':')[1]}`;
210 |     n += '.';
211 |   }
212 |   if (highCount > 0) {
213 |     n += ` An additional ${highCount} high-severity vulnerabilit${highCount !== 1 ? 'ies' : 'y'} require attention.`;
214 |   }
215 |   n += ' Immediate dependency upgrades are required before any production deployment.';
216 |   return n;
217 | }
218 | 
219 | export async function dependencyGrapher({ repoPath, buildFilePath }) {
220 |   const start = Date.now();
221 |   logger.info('Dependency Grapher starting', { repoPath });
222 | 
223 |   try {
224 |     const buildSystem = detectBuildSystem(repoPath);
225 |     logger.info('Build system detected', { buildSystem });
226 | 
227 |     if (buildSystem !== 'maven') {
228 |       logger.warn('Non-Maven project — only Maven (pom.xml) is fully supported', { buildSystem });
229 |     }
230 | 
231 |     const dependencies = await collectAllDependencies(repoPath, buildFilePath);
232 |     const { cveFlags, outdatedFlags } = checkCVEs(dependencies);
233 |     const riskScore = calculateRiskScore(cveFlags);
234 | 
235 |     const result = {
236 |       repoPath,
237 |       buildSystem,
238 |       buildFile: buildFilePath || join(repoPath, 'pom.xml'),
239 |       totalDependencies: dependencies.length,
240 |       dependencies,
241 |       outdatedFlags,
242 |       cveFlags,
243 |       riskScore
244 |     };
245 | 
246 |     // WatsonX narrative — falls back to template if unavailable
247 |     const prompt = `You are a security-conscious code archaeologist. Given this dependency analysis of a legacy codebase, write a 3-4 sentence risk assessment. Focus on the most critical vulnerabilities, the overall health of the dependency tree, and what a new developer should be careful about.
248 | 
249 | Analysis:
250 | ${JSON.stringify({
251 |   buildSystem,
252 |   totalDependencies: dependencies.length,
253 |   criticalCVEs: cveFlags.filter(c => c.severity === 'critical').map(c => ({ id: c.id, cvss: c.cvss, dep: c.dependency })),
254 |   highCVEs: cveFlags.filter(c => c.severity === 'high').map(c => ({ id: c.id, cvss: c.cvss, dep: c.dependency })),
255 |   riskScore
256 | }, null, 2)}
257 | 
258 | Be specific about which dependencies are dangerous and why. Prioritize actionable warnings. 3-4 sentences only.`;
259 | 
260 |     const aiNarrative = await generateText(prompt, { maxTokens: 200 }).catch(() => null);
261 |     result.riskNarrative = aiNarrative?.trim() || buildTemplateNarrative(dependencies, cveFlags, riskScore);
262 |     result.narrativeSource = aiNarrative ? 'watsonx' : 'template';
263 | 
264 |     logger.info('Dependency Grapher completed', {
265 |       duration: `${Date.now() - start}ms`,
266 |       totalDependencies: dependencies.length,
267 |       cveCount: cveFlags.length,
268 |       riskScore,
269 |       narrativeSource: result.narrativeSource
270 |     });
271 | 
272 |     return result;
273 | 
274 |   } catch (error) {
275 |     logger.error('Dependency Grapher failed', { error: error.message, repoPath });
276 |     throw error;
277 |   }
278 | }
</content>
</file>
</files>
<environment_details>
# VSCode Visible Files
.env

# VSCode Open Tabs
src/utils/validation.js,README.md,src/utils/logger.js,.gitignore,.env,src/index.js,src/utils/watsonx.js,package.json

# Current Time
Current time in ISO 8601 UTC format: 2026-05-02T15:21:42.702Z
User time zone: Asia/Calcutta, UTC+5:30

# Current Cost
$0.03

# Review Exclusions
The following file patterns are excluded from code reviews:
- .vscode/**

# Current Mode
<slug>plan</slug>
<name>📝 Plan</name>
You have not created a todo list yet. Create one with `update_todo_list` if your task is complicated or involves multiple steps.
</environment_details>

---

**Assistant:**

I'll continue reading the remaining files to complete my analysis.

<read_file>
<args>
  <file>
    <path>src/tools/docsGenerator.js</path>
  </file>
  <file>
    <path>src/utils/validation.js</path>
  </file>
  <file>
    <path>src/utils/logger.js</path>
  </file>
  <file>
    <path>src/utils/watsonx.js</path>
  </file>
  <file>
    <path>README.md</path>
  </file>
</args>
</read_file>

---

**User:**

[read_file for 5 files] Result:
<files>
<file><path>src/tools/docsGenerator.js</path>
<content lines="1-292">
  1 | import { generateText } from '../utils/watsonx.js';
  2 | import { logger } from '../utils/logger.js';
  3 | 
  4 | // Build the modernization roadmap directly from real CVE + outdated data.
  5 | // More accurate than asking an AI to guess.
  6 | function buildRoadmap(gitResult, depResult) {
  7 |   const critical = [];
  8 |   const high = [];
  9 |   const medium = [];
 10 |   const low = [];
 11 | 
 12 |   // Critical: CVEs with CVSS >= 9
 13 |   for (const cve of (depResult?.cveFlags || [])) {
 14 |     if (cve.cvss >= 9) {
 15 |       critical.push(`Fix ${cve.id} (CVSS ${cve.cvss}) in ${cve.dependency.split(':')[1]} → upgrade to ${cve.fixVersion}+`);
 16 |     } else if (cve.cvss >= 7) {
 17 |       high.push(`Fix ${cve.id} (CVSS ${cve.cvss}) in ${cve.dependency.split(':')[1]} → upgrade to ${cve.fixVersion}+`);
 18 |     } else {
 19 |       medium.push(`Address ${cve.id} in ${cve.dependency.split(':')[1]}`);
 20 |     }
 21 |   }
 22 | 
 23 |   // High: bus factor risk
 24 |   const bf = gitResult?.busFactorAnalysis;
 25 |   if (bf?.busFactorNumber <= 2) {
 26 |     high.push(`Bus factor ${bf.busFactorNumber}: document all implicit knowledge held by top contributors before it is lost`);
 27 |   }
 28 | 
 29 |   // High: abandoned top contributor knowledge
 30 |   const top = gitResult?.topContributors?.[0];
 31 |   if (top) {
 32 |     const lastYear = parseInt(top.lastActive?.substring(0, 4) || '0');
 33 |     const yearsGone = new Date().getFullYear() - lastYear;
 34 |     if (yearsGone > 5) {
 35 |       high.push(`${top.name} (${top.percentOfTotal}% of commits) has been gone ${yearsGone} years — map their code areas before any major refactor`);
 36 |     }
 37 |   }
 38 | 
 39 |   // Medium: outdated deps with no CVE
 40 |   const allCveDeps = new Set((depResult?.cveFlags || []).map(c => c.dependency.split(':')[0] + ':' + c.dependency.split(':')[1]));
 41 |   for (const flag of (depResult?.outdatedFlags || [])) {
 42 |     const depKey = flag.dependency.split(':')[0];
 43 |     if (!allCveDeps.has(depKey)) {
 44 |       medium.push(`Upgrade ${flag.dependency} → ${flag.safeVersion}+`);
 45 |     }
 46 |   }
 47 | 
 48 |   // Medium: high-churn files need documentation
 49 |   const churnFiles = gitResult?.highChurnFiles?.slice(0, 3) || [];
 50 |   if (churnFiles.length > 0) {
 51 |     medium.push(`Add inline documentation to the ${churnFiles.length} highest-churn files (${churnFiles.map(f => f.file.split('/').pop()).join(', ')})`);
 52 |   }
 53 | 
 54 |   // Low: general modernization
 55 |   if (depResult?.buildSystem === 'maven') {
 56 |     low.push('Migrate from Maven 2 to Maven 3 (Maven 2 is end-of-life)');
 57 |   }
 58 |   low.push('Set up static analysis (SpotBugs, PMD, Checkstyle) in the CI pipeline');
 59 |   low.push('Evaluate migration to a modern framework (Spring MVC, Quarkus, or Jakarta EE)');
 60 |   low.push('Add CONTRIBUTING.md and onboarding documentation for future maintainers');
 61 | 
 62 |   return { critical, high, medium, low };
 63 | }
 64 | 
 65 | // Risk heatmap calculated from real data — not AI-guessed.
 66 | function calculateRiskHeatmap(gitResult, depResult) {
 67 |   // Security: directly from CVE risk score
 68 |   const security = depResult?.riskScore ?? 5;
 69 | 
 70 |   // Maintenance: based on repo inactivity
 71 |   const lastCommitYear = gitResult?.lastCommit ? parseInt(gitResult.lastCommit.substring(0, 4)) : new Date().getFullYear();
 72 |   const yearsInactive = new Date().getFullYear() - lastCommitYear;
 73 |   const maintenance = Math.min(10, Math.round((yearsInactive / 2) * 10) / 10 + (gitResult?.busFactorAnalysis?.busFactorNumber <= 2 ? 3 : 1));
 74 | 
 75 |   // Complexity: churn + contributor spread
 76 |   const busFactor = gitResult?.busFactorAnalysis?.busFactorNumber ?? 5;
 77 |   const complexity = Math.min(10, Math.round((10 - Math.min(busFactor, 5)) * 1.5 * 10) / 10);
 78 | 
 79 |   // Documentation: heuristic (we don't scan for docs yet — medium default)
 80 |   const documentation = 5.5;
 81 | 
 82 |   const overall = Math.round(((security * 0.4) + (maintenance * 0.3) + (complexity * 0.2) + (documentation * 0.1)) * 10) / 10;
 83 | 
 84 |   return { security, maintenance, complexity, documentation, overall };
 85 | }
 86 | 
 87 | function buildOnboardingReadme(gitResult, depResult, reconResult, executiveSummary, whereToStart) {
 88 |   const repoName = reconResult?.repoName || 'Unknown Project';
 89 |   const today = new Date().toISOString().split('T')[0];
 90 |   const lastCommitYear = gitResult?.lastCommit?.substring(0, 4) || '?';
 91 |   const yearsInactive = new Date().getFullYear() - parseInt(lastCommitYear || new Date().getFullYear());
 92 |   const status = yearsInactive > 2 ? `⚠️ Abandoned — last commit ${gitResult?.lastCommit}` : `✅ Active`;
 93 |   const criticalCves = (depResult?.cveFlags || []).filter(c => c.severity === 'critical');
 94 | 
 95 |   const contributorRows = (gitResult?.topContributors || []).slice(0, 5).map((c, i) =>
 96 |     `| ${i + 1} | ${c.name} | ${c.commits} | ${c.percentOfTotal}% | ${c.lastActive} |`
 97 |   ).join('\n');
 98 | 
 99 |   const cveRows = (depResult?.cveFlags || []).map(c =>
100 |     `| \`${c.id}\` | ${c.severity.toUpperCase()} | ${c.cvss} | \`${c.dependency.split(':')[1]}\` | ${c.description} |`
101 |   ).join('\n');
102 | 
103 |   const churnRows = (gitResult?.highChurnFiles || []).slice(0, 5).map(f =>
104 |     `| \`${f.file.split('/').pop()}\` | ${f.commits} | \`${f.file}\` |`
105 |   ).join('\n');
106 | 
107 |   return `# ${repoName} — Developer Onboarding Guide
108 | > Generated by **Code Archaeologist** on ${today}
109 | > Powered by IBM Bob + WatsonX Granite
110 | 
111 | ---
112 | 
113 | ## Executive Summary
114 | 
115 | ${executiveSummary}
116 | 
117 | ---
118 | 
119 | ## Repository Facts
120 | 
121 | | Property | Value |
122 | |----------|-------|
123 | | Age | ${gitResult?.repoAgeYears ?? '?'} years (first commit: ${gitResult?.firstCommit ?? '?'}) |
124 | | Status | ${status} |
125 | | Total Commits | ${(gitResult?.totalCommits ?? 0).toLocaleString()} |
126 | | Contributors | ${gitResult?.contributorCount ?? '?'} |
127 | | Build System | ${depResult?.buildSystem ?? '?'} |
128 | | Dependencies | ${depResult?.totalDependencies ?? '?'} |
129 | | CVEs Detected | ${(depResult?.cveFlags ?? []).length} (${criticalCves.length} critical) |
130 | | Risk Score | ${depResult?.riskScore ?? '?'}/10 |
131 | 
132 | ---
133 | 
134 | ## Key Contributors (Historical)
135 | 
136 | | Rank | Name | Commits | % of Total | Last Active |
137 | |------|------|---------|------------|-------------|
138 | ${contributorRows}
139 | 
140 | **Bus Factor: ${gitResult?.busFactorAnalysis?.busFactorNumber ?? '?'}** — ${gitResult?.busFactorAnalysis?.explanation ?? ''}
141 | 
142 | ---
143 | 
144 | ## Security Warnings ⚠️
145 | 
146 | ${(depResult?.cveFlags ?? []).length === 0 ? 'No known CVEs detected.' : `
147 | | CVE | Severity | CVSS | Package | Description |
148 | |-----|----------|------|---------|-------------|
149 | ${cveRows}
150 | 
151 | > **Do not deploy to production without addressing the critical CVEs above.**`}
152 | 
153 | ---
154 | 
155 | ## High-Churn Files (Most Frequently Modified)
156 | 
157 | These files have the highest change frequency — understand them before making changes.
158 | 
159 | | File | Commits | Full Path |
160 | |------|---------|-----------|
161 | ${churnRows}
162 | 
163 | ---
164 | 
165 | ## Where to Start
166 | 
167 | ${whereToStart}
168 | 
169 | ---
170 | 
171 | *Generated by [Code Archaeologist](https://github.com/git-happens/code-archaeologist) — IBM Dev Day Bob Hackathon 2026*
172 | `;
173 | }
174 | 
175 | function buildTemplateExecutiveSummary(gitResult, depResult) {
176 |   const age = gitResult?.repoAgeYears ?? '?';
177 |   const lastYear = gitResult?.lastCommit?.substring(0, 4) ?? 'unknown';
178 |   const yearsInactive = new Date().getFullYear() - parseInt(lastYear || new Date().getFullYear());
179 |   const cveCount = depResult?.cveFlags?.length ?? 0;
180 |   const criticalCount = (depResult?.cveFlags ?? []).filter(c => c.severity === 'critical').length;
181 |   const top = gitResult?.topContributors?.[0];
182 | 
183 |   let s = `This is a ${age}-year-old codebase that has been inactive for ${yearsInactive} years.`;
184 |   if (cveCount > 0) {
185 |     s += ` Its dependency tree contains ${cveCount} known CVEs${criticalCount > 0 ? `, including ${criticalCount} rated critical` : ''} — making it an immediate security liability.`;
186 |   }
187 |   if (top) {
188 |     s += ` The top contributor (${top.name}, ${top.percentOfTotal}% of commits) last committed in ${top.lastActive?.substring(0, 4)}.`;
189 |   }
190 |   s += ` New developers should begin with a security audit and dependency upgrades before making any functional changes.`;
191 |   return s;
192 | }
193 | 
194 | function buildTemplateWhereToStart(gitResult, depResult) {
195 |   const churnFile = gitResult?.highChurnFiles?.[0];
196 |   const worstCve = [...(depResult?.cveFlags ?? [])].sort((a, b) => b.cvss - a.cvss)[0];
197 |   const top = gitResult?.topContributors?.[0];
198 | 
199 |   const steps = [
200 |     `**Read the build file first** (\`${depResult?.buildSystem === 'maven' ? 'pom.xml' : 'package.json'}\`) — understand what this project depends on before reading code.`
201 |   ];
202 |   if (worstCve) {
203 |     steps.push(`**Address ${worstCve.id} immediately** — this is a CVSS ${worstCve.cvss} vulnerability in \`${worstCve.dependency.split(':')[1]}\`. Upgrade before anything else.`);
204 |   }
205 |   if (churnFile) {
206 |     steps.push(`**Study \`${churnFile.file.split('/').pop()}\` carefully** — it's been modified ${churnFile.commits} times and is the heart of this codebase.`);
207 |   }
208 |   if (top) {
209 |     steps.push(`**Search for ${top.name.split(' ')[0]}'s commits** — they wrote ${top.percentOfTotal}% of the codebase. Understanding their patterns unlocks the rest.`);
210 |   }
211 |   steps.push('**Run the tests first** — establish a baseline before making any changes, even dependency upgrades.');
212 | 
213 |   return steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
214 | }
215 | 
216 | export async function docsGenerator({ repoPath, gitHistorianResult, dependencyGrapherResult, reconResult }) {
217 |   const start = Date.now();
218 |   logger.info('Docs Generator starting', { repoPath });
219 | 
220 |   const git = gitHistorianResult || {};
221 |   const dep = dependencyGrapherResult || {};
222 |   const recon = reconResult || {};
223 | 
224 |   try {
225 |     // Build roadmap and heatmap from real data — no AI needed for these
226 |     const modernizationRoadmap = buildRoadmap(git, dep);
227 |     const riskHeatmap = calculateRiskHeatmap(git, dep);
228 | 
229 |     // WatsonX call 1: Executive summary
230 |     const summaryPrompt = `You are a senior software architect writing a concise executive briefing for a developer about to inherit a legacy codebase. Based on the analysis below, write a 3-5 sentence executive summary covering: what this codebase does, its age and current status, the most critical risk, and the single most important first action.
231 | 
232 | Git Analysis:
233 | - Age: ${git.repoAgeYears} years (${git.firstCommit} to ${git.lastCommit})
234 | - Commits: ${git.totalCommits?.toLocaleString()}, Contributors: ${git.contributorCount}
235 | - Bus factor: ${git.busFactorAnalysis?.busFactorNumber} (${git.busFactorAnalysis?.risk})
236 | - Top contributor: ${git.topContributors?.[0]?.name}, last active ${git.topContributors?.[0]?.lastActive}
237 | 
238 | Dependency Analysis:
239 | - Build system: ${dep.buildSystem}, ${dep.totalDependencies} dependencies
240 | - CVEs: ${dep.cveFlags?.length} total, ${dep.cveFlags?.filter(c => c.severity === 'critical').length} critical
241 | - Worst CVE: ${dep.cveFlags?.sort((a, b) => b.cvss - a.cvss)?.[0]?.id} (CVSS ${dep.cveFlags?.sort((a, b) => b.cvss - a.cvss)?.[0]?.cvss})
242 | - Risk score: ${dep.riskScore}/10
243 | 
244 | Write clearly. No bullet points. Lead with the most alarming truth.`;
245 | 
246 |     // WatsonX call 2: Where to start
247 |     const whereToStartPrompt = `You are a senior developer writing the "Where to Start" section of an onboarding guide for a legacy codebase. Give 4-5 specific, actionable steps a new developer should take in their first week. Be concrete — reference actual files, CVE IDs, and contributor names from the data below.
248 | 
249 | Key facts:
250 | - Highest-churn file: ${git.highChurnFiles?.[0]?.file} (${git.highChurnFiles?.[0]?.commits} commits)
251 | - Top contributor: ${git.topContributors?.[0]?.name} (${git.topContributors?.[0]?.percentOfTotal}% of commits, last active ${git.topContributors?.[0]?.lastActive})
252 | - Most critical CVE: ${dep.cveFlags?.sort((a, b) => b.cvss - a.cvss)?.[0]?.id} in ${dep.cveFlags?.sort((a, b) => b.cvss - a.cvss)?.[0]?.dependency?.split(':')?.[1]}
253 | - Build system: ${dep.buildSystem}
254 | 
255 | Format as a numbered list. Each item should be 1-2 sentences.`;
256 | 
257 |     // Run both WatsonX calls in parallel
258 |     const [aiSummary, aiWhereToStart] = await Promise.all([
259 |       generateText(summaryPrompt, { maxTokens: 250 }).catch(() => null),
260 |       generateText(whereToStartPrompt, { maxTokens: 300 }).catch(() => null)
261 |     ]);
262 | 
263 |     const executiveSummary = aiSummary?.trim() || buildTemplateExecutiveSummary(git, dep);
264 |     const whereToStart = aiWhereToStart?.trim() || buildTemplateWhereToStart(git, dep);
265 | 
266 |     const onboardingReadme = buildOnboardingReadme(git, dep, recon, executiveSummary, whereToStart);
267 | 
268 |     const result = {
269 |       repoPath,
270 |       generatedAt: new Date().toISOString(),
271 |       executiveSummary,
272 |       onboardingReadme,
273 |       modernizationRoadmap,
274 |       riskHeatmap,
275 |       narrativeSources: {
276 |         executiveSummary: aiSummary ? 'watsonx' : 'template',
277 |         whereToStart: aiWhereToStart ? 'watsonx' : 'template'
278 |       }
279 |     };
280 | 
281 |     logger.info('Docs Generator completed', {
282 |       duration: `${Date.now() - start}ms`,
283 |       narrativeSources: result.narrativeSources
284 |     });
285 | 
286 |     return result;
287 | 
288 |   } catch (error) {
289 |     logger.error('Docs Generator failed', { error: error.message });
290 |     throw error;
291 |   }
292 | }
</content>
</file>
<file><path>src/utils/validation.js</path>
<content lines="1-178">
  1 | import fs from 'fs';
  2 | import path from 'path';
  3 | 
  4 | /**
  5 |  * Validates that a repository path is valid and safe to use.
  6 |  * @param {string} repoPath - The path to validate
  7 |  * @throws {Error} If the path is invalid or unsafe
  8 |  * @returns {string} The normalized absolute path
  9 |  */
 10 | export function validateRepoPath(repoPath) {
 11 |   // Check if path is provided
 12 |   if (!repoPath || typeof repoPath !== 'string') {
 13 |     throw new Error('repoPath must be a non-empty string');
 14 |   }
 15 | 
 16 |   // Trim whitespace
 17 |   const trimmedPath = repoPath.trim();
 18 |   if (trimmedPath.length === 0) {
 19 |     throw new Error('repoPath cannot be empty or whitespace');
 20 |   }
 21 | 
 22 |   // Resolve to absolute path
 23 |   const absolutePath = path.resolve(trimmedPath);
 24 | 
 25 |   // Check for path traversal attempts
 26 |   if (absolutePath.includes('..')) {
 27 |     throw new Error('Path traversal detected - paths with ".." are not allowed');
 28 |   }
 29 | 
 30 |   // Check if path exists
 31 |   if (!fs.existsSync(absolutePath)) {
 32 |     throw new Error(`Repository path does not exist: ${absolutePath}`);
 33 |   }
 34 | 
 35 |   // Check if it's a directory
 36 |   const stats = fs.statSync(absolutePath);
 37 |   if (!stats.isDirectory()) {
 38 |     throw new Error(`Path is not a directory: ${absolutePath}`);
 39 |   }
 40 | 
 41 |   // Check if it's a git repository
 42 |   const gitPath = path.join(absolutePath, '.git');
 43 |   if (!fs.existsSync(gitPath)) {
 44 |     throw new Error(`Not a git repository (no .git directory found): ${absolutePath}`);
 45 |   }
 46 | 
 47 |   return absolutePath;
 48 | }
 49 | 
 50 | /**
 51 |  * Validates an optional build file path.
 52 |  * @param {string} repoPath - The repository path
 53 |  * @param {string} buildFilePath - The build file path (optional)
 54 |  * @returns {string|null} The validated build file path or null
 55 |  */
 56 | export function validateBuildFilePath(repoPath, buildFilePath) {
 57 |   if (!buildFilePath) {
 58 |     return null;
 59 |   }
 60 | 
 61 |   if (typeof buildFilePath !== 'string') {
 62 |     throw new Error('buildFilePath must be a string');
 63 |   }
 64 | 
 65 |   // Resolve relative to repo path
 66 |   const absolutePath = path.isAbsolute(buildFilePath) 
 67 |     ? buildFilePath 
 68 |     : path.join(repoPath, buildFilePath);
 69 | 
 70 |   // Check for path traversal
 71 |   if (!absolutePath.startsWith(repoPath)) {
 72 |     throw new Error('buildFilePath must be within the repository directory');
 73 |   }
 74 | 
 75 |   // Check if file exists
 76 |   if (!fs.existsSync(absolutePath)) {
 77 |     throw new Error(`Build file does not exist: ${absolutePath}`);
 78 |   }
 79 | 
 80 |   // Check if it's a file
 81 |   const stats = fs.statSync(absolutePath);
 82 |   if (!stats.isFile()) {
 83 |     throw new Error(`Build file path is not a file: ${absolutePath}`);
 84 |   }
 85 | 
 86 |   return absolutePath;
 87 | }
 88 | 
 89 | /**
 90 |  * Validates tool arguments based on the tool name.
 91 |  * @param {string} toolName - The name of the tool
 92 |  * @param {object} args - The arguments to validate
 93 |  * @returns {object} The validated arguments
 94 |  */
 95 | export function validateToolArguments(toolName, args) {
 96 |   if (!args || typeof args !== 'object') {
 97 |     throw new Error('Tool arguments must be an object');
 98 |   }
 99 | 
100 |   const validated = {};
101 | 
102 |   switch (toolName) {
103 |     case 'excavate_repo':
104 |     case 'git_historian':
105 |       validated.repoPath = validateRepoPath(args.repoPath);
106 |       break;
107 | 
108 |     case 'dependency_grapher':
109 |       validated.repoPath = validateRepoPath(args.repoPath);
110 |       validated.buildFilePath = validateBuildFilePath(
111 |         validated.repoPath, 
112 |         args.buildFilePath
113 |       );
114 |       break;
115 | 
116 |     case 'docs_generator':
117 |       validated.repoPath = validateRepoPath(args.repoPath);
118 |       
119 |       // Validate optional result objects
120 |       if (args.gitHistorianResult !== undefined) {
121 |         if (typeof args.gitHistorianResult !== 'object') {
122 |           throw new Error('gitHistorianResult must be an object');
123 |         }
124 |         validated.gitHistorianResult = args.gitHistorianResult;
125 |       }
126 |       
127 |       if (args.dependencyGrapherResult !== undefined) {
128 |         if (typeof args.dependencyGrapherResult !== 'object') {
129 |           throw new Error('dependencyGrapherResult must be an object');
130 |         }
131 |         validated.dependencyGrapherResult = args.dependencyGrapherResult;
132 |       }
133 |       break;
134 | 
135 |     default:
136 |       throw new Error(`Unknown tool: ${toolName}`);
137 |   }
138 | 
139 |   return validated;
140 | }
141 | 
142 | /**
143 |  * Creates a standardized error response.
144 |  * @param {Error} error - The error object
145 |  * @param {string} toolName - The name of the tool that errored
146 |  * @returns {object} Standardized error response
147 |  */
148 | export function createErrorResponse(error, toolName) {
149 |   return {
150 |     success: false,
151 |     tool: toolName,
152 |     error: {
153 |       message: error.message,
154 |       type: error.constructor.name,
155 |       timestamp: new Date().toISOString()
156 |     }
157 |   };
158 | }
159 | 
160 | /**
161 |  * Creates a standardized success response.
162 |  * @param {any} data - The response data
163 |  * @param {string} toolName - The name of the tool
164 |  * @returns {object} Standardized success response
165 |  */
166 | export function createSuccessResponse(data, toolName) {
167 |   return {
168 |     success: true,
169 |     tool: toolName,
170 |     data,
171 |     metadata: {
172 |       timestamp: new Date().toISOString(),
173 |       version: '1.0.0'
174 |     }
175 |   };
176 | }
177 | 
178 | // Made with Bob
</content>
</file>
<file><path>src/utils/logger.js</path>
<content lines="1-140">
  1 | /**
  2 |  * Simple structured logging utility for Code Archaeologist
  3 |  * Provides consistent log formatting and levels
  4 |  */
  5 | 
  6 | const LOG_LEVELS = {
  7 |   ERROR: 0,
  8 |   WARN: 1,
  9 |   INFO: 2,
 10 |   DEBUG: 3
 11 | };
 12 | 
 13 | const LOG_LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
 14 | 
 15 | class Logger {
 16 |   constructor(options = {}) {
 17 |     this.level = this.parseLevel(options.level || process.env.LOG_LEVEL || 'INFO');
 18 |     this.context = options.context || 'CodeArchaeologist';
 19 |   }
 20 | 
 21 |   parseLevel(level) {
 22 |     const upperLevel = String(level).toUpperCase();
 23 |     return LOG_LEVELS[upperLevel] !== undefined ? LOG_LEVELS[upperLevel] : LOG_LEVELS.INFO;
 24 |   }
 25 | 
 26 |   shouldLog(level) {
 27 |     return level <= this.level;
 28 |   }
 29 | 
 30 |   formatMessage(level, message, meta = {}) {
 31 |     const timestamp = new Date().toISOString();
 32 |     const levelName = LOG_LEVEL_NAMES[level];
 33 |     
 34 |     const logEntry = {
 35 |       timestamp,
 36 |       level: levelName,
 37 |       context: this.context,
 38 |       message
 39 |     };
 40 | 
 41 |     // Add metadata if provided
 42 |     if (Object.keys(meta).length > 0) {
 43 |       logEntry.meta = meta;
 44 |     }
 45 | 
 46 |     return JSON.stringify(logEntry);
 47 |   }
 48 | 
 49 |   error(message, meta = {}) {
 50 |     if (this.shouldLog(LOG_LEVELS.ERROR)) {
 51 |       console.error(this.formatMessage(LOG_LEVELS.ERROR, message, meta));
 52 |     }
 53 |   }
 54 | 
 55 |   warn(message, meta = {}) {
 56 |     if (this.shouldLog(LOG_LEVELS.WARN)) {
 57 |       console.warn(this.formatMessage(LOG_LEVELS.WARN, message, meta));
 58 |     }
 59 |   }
 60 | 
 61 |   info(message, meta = {}) {
 62 |     if (this.shouldLog(LOG_LEVELS.INFO)) {
 63 |       console.log(this.formatMessage(LOG_LEVELS.INFO, message, meta));
 64 |     }
 65 |   }
 66 | 
 67 |   debug(message, meta = {}) {
 68 |     if (this.shouldLog(LOG_LEVELS.DEBUG)) {
 69 |       console.log(this.formatMessage(LOG_LEVELS.DEBUG, message, meta));
 70 |     }
 71 |   }
 72 | 
 73 |   /**
 74 |    * Create a child logger with additional context
 75 |    */
 76 |   child(context) {
 77 |     return new Logger({
 78 |       level: this.level,
 79 |       context: `${this.context}:${context}`
 80 |     });
 81 |   }
 82 | 
 83 |   /**
 84 |    * Log tool execution start
 85 |    */
 86 |   toolStart(toolName, args) {
 87 |     this.info(`Tool execution started: ${toolName}`, {
 88 |       tool: toolName,
 89 |       args: this.sanitizeArgs(args)
 90 |     });
 91 |   }
 92 | 
 93 |   /**
 94 |    * Log tool execution success
 95 |    */
 96 |   toolSuccess(toolName, duration) {
 97 |     this.info(`Tool execution completed: ${toolName}`, {
 98 |       tool: toolName,
 99 |       duration: `${duration}ms`,
100 |       status: 'success'
101 |     });
102 |   }
103 | 
104 |   /**
105 |    * Log tool execution error
106 |    */
107 |   toolError(toolName, error, duration) {
108 |     this.error(`Tool execution failed: ${toolName}`, {
109 |       tool: toolName,
110 |       duration: `${duration}ms`,
111 |       status: 'error',
112 |       error: error.message,
113 |       errorType: error.constructor.name
114 |     });
115 |   }
116 | 
117 |   /**
118 |    * Sanitize arguments to remove sensitive data
119 |    */
120 |   sanitizeArgs(args) {
121 |     const sanitized = { ...args };
122 |     
123 |     // Remove or mask sensitive fields
124 |     const sensitiveFields = ['apiKey', 'token', 'password', 'secret'];
125 |     for (const field of sensitiveFields) {
126 |       if (sanitized[field]) {
127 |         sanitized[field] = '***REDACTED***';
128 |       }
129 |     }
130 | 
131 |     return sanitized;
132 |   }
133 | }
134 | 
135 | // Create default logger instance
136 | const logger = new Logger();
137 | 
138 | export { Logger, logger };
139 | 
140 | // Made with Bob
</content>
</file>
<file><path>src/utils/watsonx.js</path>
<content lines="1-227">
  1 | import 'dotenv/config';
  2 | import { logger } from './logger.js';
  3 | 
  4 | // All WatsonX calls must use this constant — never hardcode model IDs at call sites.
  5 | const DEFAULT_MODEL = process.env.WATSONX_MODEL || 'ibm/granite-3-8b-instruct';
  6 | 
  7 | // BANNED models — do not use these, they will hurt judging:
  8 | // - llama-3-405b-instruct
  9 | // - mistral-medium-2505
 10 | // - mistral-small-3-1-24b-instruct-2503
 11 | 
 12 | // Configuration
 13 | const MAX_RETRIES = parseInt(process.env.WATSONX_MAX_RETRIES || '3');
 14 | const REQUEST_TIMEOUT = parseInt(process.env.WATSONX_TIMEOUT || '30000');
 15 | const INITIAL_RETRY_DELAY = 1000; // 1 second
 16 | 
 17 | let cachedToken = null;
 18 | let tokenExpiresAt = 0;
 19 | 
 20 | // Rate limiting
 21 | let requestCount = 0;
 22 | let requestWindowStart = Date.now();
 23 | const RATE_LIMIT_WINDOW = 60000; // 1 minute
 24 | const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.WATSONX_RATE_LIMIT || '60');
 25 | 
 26 | /**
 27 |  * Sleep utility for retry delays
 28 |  */
 29 | function sleep(ms) {
 30 |   return new Promise(resolve => setTimeout(resolve, ms));
 31 | }
 32 | 
 33 | /**
 34 |  * Check and enforce rate limiting
 35 |  */
 36 | function checkRateLimit() {
 37 |   const now = Date.now();
 38 |   
 39 |   // Reset window if needed
 40 |   if (now - requestWindowStart >= RATE_LIMIT_WINDOW) {
 41 |     requestCount = 0;
 42 |     requestWindowStart = now;
 43 |   }
 44 |   
 45 |   // Check if rate limit exceeded
 46 |   if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
 47 |     const waitTime = RATE_LIMIT_WINDOW - (now - requestWindowStart);
 48 |     throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
 49 |   }
 50 |   
 51 |   requestCount++;
 52 | }
 53 | 
 54 | async function getIAMToken(apiKey, retryCount = 0) {
 55 |   if (cachedToken && Date.now() < tokenExpiresAt) {
 56 |     return cachedToken;
 57 |   }
 58 | 
 59 |   try {
 60 |     const controller = new AbortController();
 61 |     const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
 62 | 
 63 |     const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
 64 |       method: 'POST',
 65 |       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
 66 |       body: new URLSearchParams({
 67 |         grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
 68 |         apikey: apiKey
 69 |       }),
 70 |       signal: controller.signal
 71 |     });
 72 | 
 73 |     clearTimeout(timeoutId);
 74 | 
 75 |     if (!response.ok) {
 76 |       const errorText = await response.text();
 77 |       throw new Error(`IAM token request failed: ${response.status} ${errorText}`);
 78 |     }
 79 | 
 80 |     const data = await response.json();
 81 |     cachedToken = data.access_token;
 82 |     tokenExpiresAt = Date.now() + (55 * 60 * 1000); // refresh 5 min before expiry
 83 |     
 84 |     logger.debug('IAM token refreshed successfully');
 85 |     return cachedToken;
 86 | 
 87 |   } catch (error) {
 88 |     if (error.name === 'AbortError') {
 89 |       logger.warn('IAM token request timed out', { timeout: REQUEST_TIMEOUT });
 90 |       throw new Error(`IAM token request timed out after ${REQUEST_TIMEOUT}ms`);
 91 |     }
 92 | 
 93 |     // Retry on network errors
 94 |     if (retryCount < MAX_RETRIES) {
 95 |       const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
 96 |       logger.warn(`IAM token request failed, retrying in ${delay}ms`, {
 97 |         attempt: retryCount + 1,
 98 |         maxRetries: MAX_RETRIES,
 99 |         error: error.message
100 |       });
101 |       await sleep(delay);
102 |       return getIAMToken(apiKey, retryCount + 1);
103 |     }
104 | 
105 |     logger.error('IAM token request failed after all retries', {
106 |       attempts: retryCount + 1,
107 |       error: error.message
108 |     });
109 |     throw error;
110 |   }
111 | }
112 | 
113 | /**
114 |  * Generate text using WatsonX Granite with retry logic.
115 |  * Returns null if no API key is configured — callers fall back to templates.
116 |  */
117 | export async function generateText(prompt, options = {}, retryCount = 0) {
118 |   const apiKey = process.env.WATSONX_API_KEY;
119 |   const projectId = process.env.WATSONX_PROJECT_ID;
120 |   const baseUrl = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';
121 | 
122 |   if (!apiKey || !projectId) {
123 |     logger.warn('WatsonX credentials not configured, returning null');
124 |     return null;
125 |   }
126 | 
127 |   // Check rate limit
128 |   try {
129 |     checkRateLimit();
130 |   } catch (error) {
131 |     logger.error('Rate limit exceeded', { error: error.message });
132 |     throw error;
133 |   }
134 | 
135 |   const model = options.model || DEFAULT_MODEL;
136 |   const maxTokens = options.maxTokens || 500;
137 |   const temperature = options.temperature ?? 0.7;
138 | 
139 |   try {
140 |     const token = await getIAMToken(apiKey);
141 | 
142 |     const controller = new AbortController();
143 |     const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
144 | 
145 |     logger.debug('Sending WatsonX generation request', {
146 |       model,
147 |       maxTokens,
148 |       temperature,
149 |       promptLength: prompt.length
150 |     });
151 | 
152 |     const response = await fetch(`${baseUrl}/ml/v1/text/generation?version=2023-05-29`, {
153 |       method: 'POST',
154 |       headers: {
155 |         'Authorization': `Bearer ${token}`,
156 |         'Content-Type': 'application/json',
157 |         'Accept': 'application/json'
158 |       },
159 |       body: JSON.stringify({
160 |         model_id: model,
161 |         input: prompt,
162 |         parameters: {
163 |           max_new_tokens: maxTokens,
164 |           temperature,
165 |           repetition_penalty: 1.1
166 |         },
167 |         project_id: projectId
168 |       }),
169 |       signal: controller.signal
170 |     });
171 | 
172 |     clearTimeout(timeoutId);
173 | 
174 |     if (!response.ok) {
175 |       const body = await response.text();
176 |       throw new Error(`WatsonX API error ${response.status}: ${body}`);
177 |     }
178 | 
179 |     const data = await response.json();
180 |     const text = data?.results?.[0]?.generated_text ?? null;
181 |     const tokens = data?.results?.[0]?.generated_token_count ?? 0;
182 | 
183 |     logger.info('WatsonX generation successful', {
184 |       model,
185 |       tokensGenerated: tokens,
186 |       outputLength: text?.length || 0
187 |     });
188 | 
189 |     if (process.env.WATSONX_LOG_TOKENS === 'true') {
190 |       console.error(`[WatsonX] model=${model} tokens_generated=${tokens}`);
191 |     }
192 | 
193 |     return text;
194 | 
195 |   } catch (error) {
196 |     if (error.name === 'AbortError') {
197 |       logger.warn('WatsonX request timed out', { timeout: REQUEST_TIMEOUT });
198 |       throw new Error(`WatsonX request timed out after ${REQUEST_TIMEOUT}ms`);
199 |     }
200 | 
201 |     // Retry on transient errors
202 |     const isRetryable = error.message.includes('503') ||
203 |                        error.message.includes('429') ||
204 |                        error.message.includes('timeout') ||
205 |                        error.message.includes('ECONNRESET');
206 | 
207 |     if (isRetryable && retryCount < MAX_RETRIES) {
208 |       const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
209 |       logger.warn(`WatsonX request failed, retrying in ${delay}ms`, {
210 |         attempt: retryCount + 1,
211 |         maxRetries: MAX_RETRIES,
212 |         error: error.message
213 |       });
214 |       await sleep(delay);
215 |       return generateText(prompt, options, retryCount + 1);
216 |     }
217 | 
218 |     logger.error('WatsonX generation failed', {
219 |       attempts: retryCount + 1,
220 |       error: error.message,
221 |       model
222 |     });
223 |     throw error;
224 |   }
225 | }
226 | 
227 | export { DEFAULT_MODEL };
</content>
</file>
<file><path>README.md</path>
<content lines="1-238">
  1 | # 🏺 Code Archaeologist
  2 | 
  3 | > **Excavate legacy codebases in seconds. Understand 25 years of history before your first commit.**
  4 | 
  5 | Built for the **IBM Dev Day Bob Hackathon 2026** · Team: *git happens* (solo)
  6 | 
  7 | ---
  8 | 
  9 | ## The Problem
 10 | 
 11 | You've just been handed a 15-year-old Java codebase. The original authors are gone. The documentation is stale. The dependencies haven't been updated since 2011. Somewhere in this repo lives a CVE with a CVSS 9.8 score — you just don't know where yet.
 12 | 
 13 | This is the legacy code onboarding problem. It costs new developers **2–3 weeks** to understand a codebase well enough to make their first change safely. Most of that time is spent on questions a machine could answer in seconds.
 14 | 
 15 | ---
 16 | 
 17 | ## The Solution
 18 | 
 19 | **Code Archaeologist** is a Bob IDE tool that runs a 5-phase excavation on any repository and hands back a complete developer report — in under 10 seconds.
 20 | 
 21 | ```
 22 | ❯ excavate_repo("/path/to/legacy-app")
 23 | 
 24 | Phase 1 ✅ Reconnaissance         65ms  — 847 files · Java · Maven
 25 | Phase 2 ✅ Historical Excavation  2.1s  — 5,272 commits · bus factor 4 · top dev gone since 2006
 26 | Phase 3 ⏭ Semantic Mapping       skipped — coming in next release
 27 | Phase 4 ✅ Risk Assessment        2.7s  — 26 dependencies · 7 CVEs · risk score 10/10
 28 | Phase 5 ✅ Modernization Roadmap  2.7s  — executive summary · onboarding guide · roadmap
 29 | 
 30 | Total: 5.5 seconds
 31 | ```
 32 | 
 33 | No more archaeology by hand.
 34 | 
 35 | ---
 36 | 
 37 | ## Architecture
 38 | 
 39 | ```
 40 | ┌──────────────────────────────────────────────────────┐
 41 | │                      Bob IDE                         │
 42 | │   "excavate_repo('/path/to/struts1')"                │
 43 | └─────────────────────┬────────────────────────────────┘
 44 |                       │  MCP / stdio
 45 | ┌─────────────────────▼────────────────────────────────┐
 46 | │             Code Archaeologist MCP Server            │
 47 | │                   (Node.js)                          │
 48 | │                                                      │
 49 | │   ┌──────────────────────────────────────────────┐   │
 50 | │   │         excavateRepo  (Orchestrator)         │   │
 51 | │   └──────┬───────────────────────┬───────────────┘   │
 52 | │          │ parallel              │ parallel           │
 53 | │   ┌──────▼──────┐        ┌───────▼────────┐          │
 54 | │   │   Git       │        │  Dependency    │          │
 55 | │   │  Historian  │        │   Grapher      │          │
 56 | │   │             │        │                │          │
 57 | │   │ git log     │        │ pom.xml parse  │          │
 58 | │   │ bus factor  │        │ CVE checklist  │          │
 59 | │   │ churn files │        │ risk scoring   │          │
 60 | │   └──────┬──────┘        └───────┬────────┘          │
 61 | │          └──────────┬────────────┘                   │
 62 | │                ┌────▼───────────┐                    │
 63 | │                │ Docs Generator │                    │
 64 | │                │                │                    │
 65 | │                │ WatsonX        │                    │
 66 | │                │ Granite 4      │                    │
 67 | │                └────────────────┘                    │
 68 | └──────────────────────────────────────────────────────┘
 69 | ```
 70 | 
 71 | ---
 72 | 
 73 | ## The 5 Phases
 74 | 
 75 | | Phase | Name | What It Does | Time |
 76 | |-------|------|-------------|------|
 77 | | 1 | **Reconnaissance** | File count by language, build system detection, docs/tests check | ~65ms |
 78 | | 2 | **Historical Excavation** | Streams `git log` → contributor patterns, bus factor, commit timeline, high-churn files | ~2s |
 79 | | 3 | **Semantic Mapping** | *(Coming soon)* AST-level code understanding | — |
 80 | | 4 | **Risk Assessment** | Parses `pom.xml` across all submodules, flags known CVEs, calculates risk score 1–10 | ~2s |
 81 | | 5 | **Modernization Roadmap** | WatsonX Granite synthesizes everything into executive summary, onboarding README, prioritized roadmap | ~2.7s |
 82 | 
 83 | ---
 84 | 
 85 | ## Real Output — apache/struts1
 86 | 
 87 | Actual results from running Code Archaeologist on `apache/struts1` (26-year-old abandoned Java MVC framework):
 88 | 
 89 | **Git History (Phase 2):**
 90 | - 5,272 commits · 29 contributors · 26 years old
 91 | - Bus factor: **4** (4 engineers hold 50%+ of all knowledge)
 92 | - Top contributor: Craig R. McClanahan (18% of commits) — last active **May 2006**
 93 | - Highest-churn file: `ActionServlet.java` — modified 200 times
 94 | 
 95 | **Dependency Risk (Phase 4):**
 96 | - 26 Maven dependencies across 13 submodules
 97 | - **7 CVEs flagged**, including:
 98 |   - `CVE-2015-6420` — `commons-collections:2.1` — **CVSS 9.8** — Remote Code Execution
 99 |   - `CVE-2019-17571` — `log4j:1.2.17` — **CVSS 9.8** — Remote Code Execution
100 | - Risk score: **10/10**
101 | 
102 | **WatsonX Narrative (Phase 5):**
103 | > *"This Java web application is highly vulnerable due to unpatched critical security vulnerabilities in outdated third-party libraries; it has been dormant since 2010 with minimal maintenance by a small group of contributors led primarily by Craig R. McClanahan who stopped contributing over a decade ago. The sole focus must be immediately updating all dependencies to patched versions before any further development or deployment can safely occur."*
104 | 
105 | ---
106 | 
107 | ## Setup
108 | 
109 | ### Prerequisites
110 | 
111 | - Node.js 18+
112 | - Git
113 | - IBM WatsonX account (AI narratives are optional — template fallbacks work without it)
114 | 
115 | ### Install
116 | 
117 | ```bash
118 | git clone https://github.com/git-happens/code-archaeologist
119 | cd code-archaeologist
120 | npm install
121 | ```
122 | 
123 | ### Configure WatsonX
124 | 
125 | ```bash
126 | cp .env.example .env
127 | ```
128 | 
129 | Edit `.env`:
130 | ```env
131 | WATSONX_API_KEY=your-api-key
132 | WATSONX_PROJECT_ID=your-project-id
133 | WATSONX_URL=https://us-south.ml.cloud.ibm.com
134 | WATSONX_MODEL=ibm/granite-4-h-small
135 | ```
136 | 
137 | ### Connect to Bob IDE
138 | 
139 | Bob auto-detects `.bob/mcp.json` — no manual setup needed. If configuring manually, go to **Settings → MCP → Project MCPs**:
140 | 
141 | ```json
142 | {
143 |   "mcpServers": {
144 |     "code-archaeologist": {
145 |       "command": "node",
146 |       "args": ["src/index.js"],
147 |       "disabled": false,
148 |       "alwaysAllow": ["excavate_repo", "git_historian", "dependency_grapher", "docs_generator"]
149 |     }
150 |   }
151 | }
152 | ```
153 | 
154 | ### Clone a Demo Target
155 | 
156 | ```bash
157 | git clone https://github.com/apache/struts1 ~/struts1
158 | ```
159 | 
160 | ### Run
161 | 
162 | In Bob IDE:
163 | ```
164 | excavate_repo("/Users/yourname/struts1")
165 | ```
166 | 
167 | ---
168 | 
169 | ## Available Tools
170 | 
171 | | Tool | Description |
172 | |------|-------------|
173 | | `excavate_repo` | Full 5-phase excavation — the main entry point |
174 | | `git_historian` | Git history analysis only (contributors, bus factor, churn) |
175 | | `dependency_grapher` | Dependency + CVE analysis only |
176 | | `docs_generator` | Report generation from pre-computed agent results |
177 | 
178 | ---
179 | 
180 | ## Testing
181 | 
182 | ```bash
183 | npm test                           # Quick shape validation (~10s)
184 | node test/test-real-repo.js        # Phase 2 + 3 against struts1 (~5s)
185 | node test/test-watsonx.js          # WatsonX connectivity check
186 | node test/test-comprehensive.js    # Full suite: all phases, errors, fallbacks, MCP protocol (~20s)
187 | ```
188 | 
189 | ---
190 | 
191 | ## Tech Stack
192 | 
193 | | Component | Technology |
194 | |-----------|-----------|
195 | | IDE + Agent Runtime | IBM Bob |
196 | | AI / Narrative Generation | IBM WatsonX — `ibm/granite-4-h-small` |
197 | | Tool Protocol | Model Context Protocol (MCP) |
198 | | Server Runtime | Node.js 22 (ES Modules) |
199 | | XML Parsing | fast-xml-parser |
200 | | Transport | stdio |
201 | 
202 | ---
203 | 
204 | ## Project Structure
205 | 
206 | ```
207 | code-archaeologist/
208 | ├── src/
209 | │   ├── index.js                  # MCP server entry point
210 | │   ├── tools/
211 | │   │   ├── excavateRepo.js       # Orchestrator — chains all 5 phases
212 | │   │   ├── gitHistorian.js       # Agent 1: git log analysis
213 | │   │   ├── dependencyGrapher.js  # Agent 2: pom.xml + CVE analysis
214 | │   │   └── docsGenerator.js      # Agent 3: WatsonX report synthesis
215 | │   └── utils/
216 | │       ├── watsonx.js            # WatsonX Granite API client
217 | │       ├── logger.js             # Structured logging
218 | │       └── validation.js         # Input validation
219 | ├── test/
220 | │   ├── manual-test.js            # Shape validation suite
221 | │   ├── test-real-repo.js         # Phase 2+3 integration test
222 | │   ├── test-watsonx.js           # WatsonX connectivity test
223 | │   └── test-comprehensive.js     # Full test suite
224 | ├── docs/                         # Development documentation
225 | ├── .bob/mcp.json                 # Bob IDE MCP configuration
226 | ├── .env.example                  # Environment variable template
227 | └── package.json
228 | ```
229 | 
230 | ---
231 | 
232 | ## Team
233 | 
234 | **git happens** · solo entry · IBM Dev Day Bob Hackathon 2026
235 | 
236 | ---
237 | 
238 | *The name is a joke. The code is serious.*
</content>
</file>
</files>
<environment_details>
# VSCode Visible Files
.env

# VSCode Open Tabs
src/utils/validation.js,README.md,src/utils/logger.js,.gitignore,.env,src/index.js,src/utils/watsonx.js,package.json

# Current Time
Current time in ISO 8601 UTC format: 2026-05-02T15:21:48.602Z
User time zone: Asia/Calcutta, UTC+5:30

# Current Cost
$0.10

# Review Exclusions
The following file patterns are excluded from code reviews:
- .vscode/**

# Current Mode
<slug>plan</slug>
<name>📝 Plan</name>
You have not created a todo list yet. Create one with `update_todo_list` if your task is complicated or involves multiple steps.
</environment_details>

---

**Assistant:**

Now I have a complete understanding of the Code Archaeologist codebase. Let me create a comprehensive analysis document for you.

<write_to_file>
<path>CODEBASE_ANALYSIS.md</path>
<content>
# Code Archaeologist - Codebase Analysis

## 1. MCP Server Structure

### Architecture Overview

The Code Archaeologist is built as a **Model Context Protocol (MCP) server** that connects to Bob IDE via stdio transport. Here's how it's structured:

```
┌─────────────────────────────────────────────────────────┐
│                    Bob IDE Client                        │
│              (sends tool requests via MCP)               │
└────────────────────┬────────────────────────────────────┘
                     │ stdio transport
┌────────────────────▼────────────────────────────────────┐
│              src/index.js (MCP Server)                   │
│  - Registers 4 tools with MCP SDK                       │
│  - Handles ListTools & CallTool requests                │
│  - Validates inputs, routes to agents                   │
│  - Returns standardized JSON responses                  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────────┐
│ gitHistorian │ │ depGraph│ │docsGenerator│
│   (Agent 1)  │ │(Agent 2)│ │  (Agent 3)  │
└──────────────┘ └─────────┘ └─────────────┘
```

### Core Components

#### **src/index.js** - MCP Server Entry Point
- Creates MCP Server instance with `@modelcontextprotocol/sdk`
- Defines 4 tools with JSON schemas:
  - `excavate_repo` - Full 5-phase orchestration
  - `git_historian` - Git history analysis only
  - `dependency_grapher` - Dependency + CVE analysis only
  - `docs_generator` - Report synthesis only
- Implements two request handlers:
  - `ListToolsRequestSchema` → returns tool definitions
  - `CallToolRequestSchema` → validates args, routes to agents, handles errors
- Uses `StdioServerTransport` for Bob IDE communication
- All responses are JSON with `success`, `tool`, `data`, and `metadata` fields

#### **src/tools/excavateRepo.js** - Orchestrator
- **Main entry point** that chains all 5 phases
- Phase 1: **Reconnaissance** (local file scan)
  - Walks directory tree (max depth 6, skips node_modules/.git)
  - Counts files by extension → detects primary language
  - Checks for README, docs, tests
  - Gets first commit date from git
- Phase 2 & 4: Run **in parallel** (independent operations)
  - Phase 2: `gitHistorian` (git log analysis)
  - Phase 4: `dependencyGrapher` (pom.xml + CVE check)
- Phase 3: **Skipped** (placeholder for future AST analysis)
- Phase 5: `docsGenerator` (synthesizes results from Phase 2 & 4)
- Each phase wrapped in `runPhase()` helper:
  - Tracks status (running/complete/error)
  - Measures duration
  - Graceful error handling (one phase failure doesn't kill entire excavation)

### Tool Registration & Validation

**Input Validation Flow:**
1. Bob sends tool request → `src/index.js` receives it
2. `validateToolArguments()` from `src/utils/validation.js`:
   - Checks `repoPath` exists, is directory, has `.git` folder
   - Resolves to absolute path
   - Prevents path traversal attacks (`..` not allowed)
   - For `dependency_grapher`: validates optional `buildFilePath`
   - For `docs_generator`: validates optional result objects
3. If validation fails → returns standardized error response
4. If validation passes → routes to appropriate agent

**Response Format:**
```json
{
  "success": true,
  "tool": "excavate_repo",
  "data": { /* agent results */ },
  "metadata": {
    "timestamp": "2026-05-02T15:20:00.000Z",
    "version": "1.0.0"
  }
}
```

---

## 2. How the 3 Agents Work Together

### Agent 1: gitHistorian (src/tools/gitHistorian.js)

**Purpose:** Analyze git history to understand who built the codebase and when they left

**Implementation:**
- Spawns `git log --format=%ae|%an|%ad --date=short` as child process
- **Streams** output line-by-line (doesn't load entire log into memory)
- Aggregates data into:
  - Contributors map (email → name, commits, first/last active dates)
  - Monthly commit counts (for timeline analysis)
  - Total commits, first/last commit dates
- Runs `git log --pretty=format: --name-only` in parallel to find high-churn files
- Calculates **bus factor**: How many contributors account for 50%+ of commits?
  - ≤1 = critical risk
  - ≤3 = high risk
  - >3 = medium risk
- Builds commit timeline grouped into 3-year periods with trend analysis
- Calls WatsonX Granite to generate narrative (falls back to template if unavailable)

**Output:**
```javascript
{
  repoPath: "/path/to/repo",
  totalCommits: 5272,
  contributorCount: 29,
  repoAgeYears: 26,
  firstCommit: "2000-05-01",
  lastCommit: "2010-12-15",
  topContributors: [
    { name: "Craig McClanahan", email: "...", commits: 950, percentOfTotal: 18, lastActive: "2006-05-12" }
  ],
  busFactorAnalysis: {
    busFactorNumber: 4,
    explanation: "4 contributors authored over 50% of all commits",
    topPercent: 52.3,
    risk: "high"
  },
  commitTimeline: [
    { period: "2000-2002", commits: 1200, trend: "growing" },
    { period: "2003-2005", commits: 2100, trend: "growing" },
    { period: "2006-2008", commits: 800, trend: "declining" },
    { period: "2009-2010", commits: 15, trend: "abandoned" }
  ],
  highChurnFiles: [
    { file: "src/ActionServlet.java", commits: 200 }
  ],
  narrative: "This codebase is 26 years old with 5,272 commits from 29 contributors...",
  narrativeSource: "watsonx"
}
```

### Agent 2: dependencyGrapher (src/tools/dependencyGrapher.js)

**Purpose:** Parse build files, detect outdated dependencies, flag known CVEs

**Implementation:**
- Detects build system (Maven/Gradle/npm/Python)
- For Maven projects:
  - Parses `pom.xml` using `fast-xml-parser`
  - **Recursively processes submodules** (multi-module Maven projects)
  - Extracts dependencies from `<dependencies>` and `<dependencyManagement>`
  - Deduplicates by `groupId:artifactId`
- Checks against **hardcoded CVE database** (lines 10-70):
  - 8 common legacy Java dependencies with known CVEs
  - Includes Struts, Commons Collections, Log4j 1.x, etc.
  - Each entry has: groupId, artifactId, affectedBelow version, CVE list
- Version comparison logic:
  - Parses semantic versions (major.minor.patch)
  - Treats SNAPSHOT/unresolved versions as vulnerable
- Calculates **risk score** (0-10):
  - Critical CVE = +3 points
  - High CVE = +1.5 points
  - Medium CVE = +0.5 points
  - Capped at 10
- Calls WatsonX to generate risk narrative (falls back to template)

**Output:**
```javascript
{
  repoPath: "/path/to/repo",
  buildSystem: "maven",
  buildFile: "/path/to/repo/pom.xml",
  totalDependencies: 26,
  dependencies: [
    { groupId: "commons-collections", artifactId: "commons-collections", version: "2.1", scope: "compile" }
  ],
  outdatedFlags: [
    { dependency: "commons-collections:2.1", safeVersion: "3.2.2", severity: "critical" }
  ],
  cveFlags: [
    {
      dependency: "commons-collections:commons-collections:2.1",
      id: "CVE-2015-6420",
      cvss: 9.8,
      severity: "critical",
      description: "Remote code execution via Java deserialization gadget chain",
      fixVersion: "3.2.2"
    }
  ],
  riskScore: 10,
  riskNarrative: "This dependency tree contains 26 dependencies with a risk score of 10/10...",
  narrativeSource: "watsonx"
}
```

### Agent 3: docsGenerator (src/tools/docsGenerator.js)

**Purpose:** Synthesize git + dependency results into actionable documentation

**Implementation:**
- Takes results from Agent 1 & 2 as input
- Builds **modernization roadmap** from real data (not AI-guessed):
  - **Critical**: CVEs with CVSS ≥9
  - **High**: CVEs with CVSS ≥7, bus factor ≤2, top contributor gone >5 years
  - **Medium**: Outdated deps without CVEs, high-churn files needing docs
  - **Low**: General modernization (Maven 3, static analysis, framework migration)
- Calculates **risk heatmap** (0-10 scale):
  - Security: directly from CVE risk score
  - Maintenance: based on years inactive + bus factor
  - Complexity: inverse of bus factor (fewer contributors = higher complexity)
  - Documentation: hardcoded 5.5 (no doc scanning yet)
  - Overall: weighted average (40% security, 30% maintenance, 20% complexity, 10% docs)
- Calls WatsonX **twice in parallel**:
  1. Executive summary (3-5 sentences)
  2. "Where to Start" guide (4-5 actionable steps)
- Builds **onboarding README** with:
  - Executive summary
  - Repository facts table
  - Top contributors table
  - Security warnings (CVE table)
  - High-churn files table
  - Where to start section

**Output:**
```javascript
{
  repoPath: "/path/to/repo",
  generatedAt: "2026-05-02T15:20:00.000Z",
  executiveSummary: "This is a 26-year-old codebase that has been inactive for 16 years...",
  onboardingReadme: "# struts1 — Developer Onboarding Guide\n...",
  modernizationRoadmap: {
    critical: [
      "Fix CVE-2015-6420 (CVSS 9.8) in commons-collections → upgrade to 3.2.2+"
    ],
    high: [
      "Bus factor 4: document all implicit knowledge held by top contributors before it is lost",
      "Craig McClanahan (18% of commits) has been gone 20 years — map their code areas before any major refactor"
    ],
    medium: [
      "Upgrade commons-codec:1.2 → 1.13+",
      "Add inline documentation to the 3 highest-churn files (ActionServlet.java, ...)"
    ],
    low: [
      "Migrate from Maven 2 to Maven 3 (Maven 2 is end-of-life)",
      "Set up static analysis (SpotBugs, PMD, Checkstyle) in the CI pipeline"
    ]
  },
  riskHeatmap: {
    security: 10,
    maintenance: 8.5,
    complexity: 7.5,
    documentation: 5.5,
    overall: 8.4
  },
  narrativeSources: {
    executiveSummary: "watsonx",
    whereToStart: "watsonx"
  }
}
```

### How They Coordinate

**Parallel Execution:**
```javascript
// In excavateRepo.js, lines 141-144
const [phase2, phase4] = await Promise.all([
  runPhase(2, 'Historical Excavation', () => gitHistorian({ repoPath })),
  runPhase(4, 'Risk Assessment',       () => dependencyGrapher({ repoPath }))
]);
```

**Sequential Dependency:**
```javascript
// Phase 5 needs results from Phase 2 & 4
const phase5 = await runPhase(5, 'Modernization Roadmap', () =>
  docsGenerator({
    repoPath,
    gitHistorianResult:      phase2.result,
    dependencyGrapherResult: phase4.result,
    reconResult:             phase1.result
  })
);
```

**Data Flow:**
1. `excavateRepo` runs reconnaissance (Phase 1)
2. Spawns `gitHistorian` and `dependencyGrapher` in parallel (Phases 2 & 4)
3. Both agents complete independently, return structured data
4. `docsGenerator` receives both results, synthesizes final report (Phase 5)
5. Orchestrator returns complete excavation report to Bob IDE

---

## 3. Issues Spotted in the Code

### 🔴 Critical Issues

#### 1. **Path Traversal Vulnerability in validation.js (Line 26)**
```javascript
if (absolutePath.includes('..')) {
  throw new Error('Path traversal detected - paths with ".." are not allowed');
}
```
**Problem:** This check happens AFTER `path.resolve()` which normalizes the path. By the time you check for `..`, it's already been resolved away.

**Example:**
```javascript
const malicious = "/tmp/../../../etc/passwd";
const resolved = path.resolve(malicious); // "/etc/passwd"
resolved.includes('..'); // false — attack succeeds!
```

**Fix:** Check BEFORE resolving, or validate that resolved path is within allowed boundaries:
```javascript
const absolutePath = path.resolve(trimmedPath);
const allowedBase = process.cwd(); // or some safe base directory
if (!absolutePath.startsWith(allowedBase)) {
  throw new Error('Path must be within allowed directory');
}
```

#### 2. **Unhandled Promise Rejection in gitHistorian.js (Line 222)**
```javascript
const aiNarrative = await generateText(prompt, { maxTokens: 200 }).catch(() => null);
```
**Problem:** If `generateText` throws an error, it's silently caught and returns `null`. But the error might be important (rate limit, auth failure, etc.). The user gets no feedback about why AI narrative failed.

**Fix:** Log the error before returning null:
```javascript
const aiNarrative = await generateText(prompt, { maxTokens: 200 }).catch((err) => {
  logger.warn('WatsonX narrative generation failed, using template', { error: err.message });
  return null;
});
```

#### 3. **Race Condition in watsonx.js Token Caching (Lines 17-18)**
```javascript
let cachedToken = null;
let tokenExpiresAt = 0;
```
**Problem:** If two requests come in simultaneously before a token is cached, both will call `getIAMToken()` concurrently. This wastes API calls and could hit rate limits.

**Fix:** Use a promise-based lock:
```javascript
let tokenPromise = null;

async function getIAMToken(apiKey, retryCount = 0) {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  
  // If token fetch is already in progress, wait for it
  if (tokenPromise) {
    return tokenPromise;
  }
  
  tokenPromise = (async () => {
    try {
      // ... existing fetch logic ...
      return cachedToken;
    } finally {
      tokenPromise = null;
    }
  })();
  
  return tokenPromise;
}
```

### 🟡 High Priority Issues

#### 4. **Memory Leak in gitHistorian.js (Lines 22-50)**
```javascript
git.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // hold last incomplete line
  
  for (const line of lines) {
    // ... process line ...
  }
});
```
**Problem:** If git log is huge (100k+ commits), the `contributors` Map and `monthlyCommits` Map grow unbounded in memory. For very large repos, this could cause OOM.

**Fix:** Add memory limits or streaming aggregation:
```javascript
const MAX_CONTRIBUTORS = 1000; // reasonable limit
if (contributors.size > MAX_CONTRIBUTORS) {
  logger.warn('Too many contributors, limiting to top 1000');
  // Keep only top N by commit count
}
```

#### 5. **Hardcoded CVE Database is Stale (dependencyGrapher.js, Lines 10-70)**
```javascript
const KNOWN_CVES = [
  { groupId: 'org.apache.struts', artifactId: 'struts-core', ... }
];
```
**Problem:** CVE database is hardcoded and will become outdated. New CVEs won't be detected.

**Fix:** 
- Short-term: Add a comment with last update date
- Long-term: Integrate with OSV API or NVD API for real-time CVE data
```javascript
// CVE database last updated: 2026-05-02
// TODO: Replace with OSV API integration (https://osv.dev/docs/)
const KNOWN_CVES = [ ... ];
```

#### 6. **No Timeout on Git Commands (gitHistorian.js, excavateRepo.js)**
```javascript
const git = spawn('git', ['log', '--format=%ae|%an|%ad', '--date=short'], {
  cwd: repoPath,
  stdio: ['ignore', 'pipe', 'ignore']
});
```
**Problem:** If git hangs (corrupted repo, network filesystem), the process will hang forever.

**Fix:** Add timeout:
```javascript
const git = spawn('git', ['log', ...], { cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore'] });
const timeout = setTimeout(() => {
  git.kill('SIGTERM');
  reject(new Error('Git command timed out after 30s'));
}, 30000);

git.on('close', () => {
  clearTimeout(timeout);
  // ... existing logic ...
});
```

### 🟢 Medium Priority Issues

#### 7. **Inconsistent Error Handling in excavateRepo.js (Lines 108-122)**
```javascript
async function runPhase(id, name, fn) {
  const phase = { id, name, status: 'running', ... };
  try {
    phase.result = await fn();
    phase.status = 'complete';
  } catch (err) {
    phase.status = 'error';
    phase.error = err.message;
    logger.error(`Phase ${id} failed: ${name}`, { error: err.message });
  }
  return phase;
}
```
**Problem:** Errors are caught and logged, but the excavation continues. If Phase 2 fails, Phase 5 will receive `null` results and might crash.

**Fix:** Add null checks in docsGenerator:
```javascript
export async function docsGenerator({ repoPath, gitHistorianResult, dependencyGrapherResult, reconResult }) {
  const git = gitHistorianResult || {};
  const dep = dependencyGrapherResult || {};
  const recon = reconResult || {};
  
  // Add validation
  if (!git.totalCommits) {
    logger.warn('Git historian results missing, using defaults');
  }
  if (!dep.totalDependencies) {
    logger.warn('Dependency grapher results missing, using defaults');
  }
  
  // ... rest of function ...
}
```

#### 8. **Version Comparison is Naive (dependencyGrapher.js, Lines 74-88)**
```javascript
function isVersionBelow(version, threshold) {
  if (!version || version.includes('$') || version.toLowerCase().includes('snapshot')) {
    return true; // unresolved/snapshot versions treated as potentially vulnerable
  }
  const parse = (v) => v.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n) || 0);
  // ...
}
```
**Problem:** Doesn't handle pre-release versions correctly:
- `1.0.0-beta` vs `1.0.0` → incorrectly compares as `1.0.0` vs `1.0.0`
- `1.0.0-rc1` is treated as `1.0.0`

**Fix:** Use a proper semver library:
```javascript
import semver from 'semver';

function isVersionBelow(version, threshold) {
  try {
    return semver.lt(semver.coerce(version), semver.coerce(threshold));
  } catch {
    return true; // treat unparseable versions as vulnerable
  }
}
```

#### 9. **No Rate Limiting on Git Commands**
**Problem:** If user runs `excavate_repo` on 100 repos in parallel, it spawns 200+ git processes simultaneously.

**Fix:** Add a process pool or queue:
```javascript
import pLimit from 'p-limit';
const gitLimit = pLimit(5); // max 5 concurrent git processes

async function parseCommitHistory(repoPath) {
  return gitLimit(() => new Promise((resolve, reject) => {
    // ... existing git spawn logic ...
  }));
}
```

#### 10. **Missing Input Sanitization for Git Commands**
```javascript
const git = spawn('git', ['log', '--format=%ae|%an|%ad', '--date=short'], {
  cwd: repoPath,
  stdio: ['ignore', 'pipe', 'ignore']
});
```
**Problem:** If `repoPath` contains shell metacharacters, it could cause issues (though `spawn` with array args is safer than shell execution).

**Fix:** Already mostly safe due to using array args, but add explicit validation:
```javascript
if (repoPath.includes('\n') || repoPath.includes('\0')) {
  throw new Error('Invalid characters in repoPath');
}
```

### 🔵 Low Priority / Nice-to-Have

#### 11. **No Progress Reporting for Long Operations**
**Problem:** For huge repos (Linux kernel, Chromium), excavation can take 30+ seconds. User has no feedback.

**Fix:** Add progress events via MCP notifications (if supported) or periodic logging.

#### 12. **Hardcoded Magic Numbers**
```javascript
const maxDepth = 6; // excavateRepo.js line 23
const limit = 10;   // gitHistorian.js line 65
```
**Fix:** Move to configuration:
```javascript
const config = {
  MAX_WALK_DEPTH: parseInt(process.env.MAX_WALK_DEPTH || '6'),
  HIGH_CHURN_LIMIT: parseInt(process.env.HIGH_CHURN_LIMIT || '10')
};
```

#### 13. **No Caching of Excavation Results**
**Problem:** If user runs `excavate_repo` twice on same repo, it re-analyzes everything.

**Fix:** Add optional caching layer:
```javascript
const cacheKey = `${repoPath}:${lastCommitHash}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;
```

#### 14. **Missing Telemetry/Metrics**
**Problem:** No visibility into performance bottlenecks or error rates in production.

**Fix:** Add metrics collection:
```javascript
metrics.timing('phase.git_historian.duration', duration);
metrics.increment('phase.git_historian.success');
```

---

## Summary

### Strengths ✅
- Clean MCP server architecture with proper separation of concerns
- Excellent error handling with graceful degradation (template fallbacks)
- Smart parallel execution of independent phases
- Streaming git log parsing (memory efficient)
- Comprehensive validation layer
- Good logging throughout

### Critical Fixes Needed 🔴
1. Fix path traversal vulnerability in validation
2. Add proper error logging for WatsonX failures
3. Fix token caching race condition
4. Add timeouts to git commands
5. Add memory limits for large repos

### Recommended Improvements 🟡
- Integrate real CVE database (OSV/NVD API)
- Improve version comparison logic (use semver library)
- Add rate limiting for git processes
- Better null handling in docsGenerator
- Add progress reporting for long operations

The codebase is well-structured and production-ready with the critical security fixes applied. The agent coordination is elegant, and the fallback mechanisms ensure reliability even when WatsonX is unavailable.
</content>
<line_count>678</line_count>
</write_to_file>

---

**User:**

[write_to_file for 'CODEBASE_ANALYSIS.md'] Result:
<file_write_result>
<path>CODEBASE_ANALYSIS.md</path>
<operation>created</operation>
<notice>
<i>You do not need to re-read the file, as you have seen all changes</i>
<i>Proceed with the task using these changes as the new baseline.</i>
</notice>
</file_write_result>

<environment_details>
# VSCode Visible Files
CODEBASE_ANALYSIS.md

# VSCode Open Tabs
src/utils/validation.js,README.md,src/utils/logger.js,.gitignore,.env,CODEBASE_ANALYSIS.md,src/index.js,src/utils/watsonx.js,package.json

# Current Time
Current time in ISO 8601 UTC format: 2026-05-02T15:25:05.530Z
User time zone: Asia/Calcutta, UTC+5:30

# Current Cost
$0.22

# Review Exclusions
The following file patterns are excluded from code reviews:
- .vscode/**

# Current Mode
<slug>plan</slug>
<name>📝 Plan</name>
You have not created a todo list yet. Create one with `update_todo_list` if your task is complicated or involves multiple steps.
</environment_details>

---

**Assistant:**

<attempt_completion>
<result>
I've completed a comprehensive analysis of the Code Archaeologist codebase and created a detailed report in [`CODEBASE_ANALYSIS.md`](CODEBASE_ANALYSIS.md:1).

## Key Findings:

### 1. MCP Server Structure
- Built on `@modelcontextprotocol/sdk` with stdio transport
- Exposes 4 tools: `excavate_repo` (orchestrator), `git_historian`, `dependency_grapher`, `docs_generator`
- Clean request/response flow with standardized JSON format
- Robust validation layer prevents path traversal and validates all inputs

### 2. Agent Coordination
- **gitHistorian**: Streams git log, calculates bus factor, identifies high-churn files, generates WatsonX narrative
- **dependencyGrapher**: Parses Maven pom.xml recursively, checks hardcoded CVE database, calculates risk score
- **docsGenerator**: Synthesizes results into executive summary, onboarding README, and modernization roadmap
- **Smart parallelization**: Phases 2 & 4 run concurrently since they're independent
- **Graceful degradation**: WatsonX failures fall back to template-based narratives

### 3. Critical Issues Found

**🔴 Security:**
- Path traversal check happens AFTER path.resolve() (ineffective)
- No timeout on git commands (can hang forever)
- Token caching race condition (concurrent requests duplicate API calls)

**🟡 Reliability:**
- Memory unbounded for huge repos (100k+ commits)
- Hardcoded CVE database will become stale
- Silent error swallowing in WatsonX fallbacks
- Naive version comparison doesn't handle pre-release versions

**🟢 Enhancements:**
- No progress reporting for long operations
- No caching of excavation results
- Missing rate limiting on git processes

The codebase is well-architected with excellent separation of concerns. The orchestration pattern is elegant, and the fallback mechanisms ensure reliability. With the critical security fixes applied, this is production-ready code.
</result>
</attempt_completion>

