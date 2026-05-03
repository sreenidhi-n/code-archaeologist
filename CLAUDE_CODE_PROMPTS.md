# 🤖 Claude Code — Build Prompts
### Code Archaeologist | IBM Bob Hackathon
> **How to use:** Copy-paste each prompt into Claude Code when you're ready for that phase.  
> **Rule:** Always point Claude Code at `CODE_ARCHAEOLOGIST.md` first for context.  
> **Bobcoin warning:** Bob IDE has 40 Bobcoins total. Claude Code is free. Do as much as possible here.

---

## 0. Context Loader (run this FIRST every session)

```
Read the file CODE_ARCHAEOLOGIST.md in this repo. This is the living project doc 
for a hackathon project called "Code Archaeologist." Understand the architecture, 
the 3 active agents (Git Historian, Dependency Grapher, Docs Generator), the 
5-phase excavation workflow, and the tech stack (Bob IDE + MCP Server + WatsonX 
Granite). All code you write should align with this doc. Confirm you understand 
the project before proceeding.
```

---

## Phase 1: MCP Server Scaffold

### 1A. Init the MCP server

```
Create a Node.js MCP server for the Code Archaeologist project. 

Requirements:
- Use the official @modelcontextprotocol/sdk package
- Server name: "code-archaeologist"  
- Transport: stdio (Bob IDE connects via stdio)
- Define 3 MCP tools with proper schemas:

1. `excavate_repo` — Main entry point. Takes a repo path as input.
   Returns a JSON object with fields: { repoPath, status, phases: [] }
   For now, return a hardcoded response showing all 5 phases with status "pending".

2. `git_historian` — Analyzes git history. Takes repo path as input.
   Returns: { topContributors: [], commitTimeline: [], lastActiveDate, 
   totalCommits, riskNarrative }
   For now, return hardcoded sample data for a legacy Java codebase.

3. `dependency_grapher` — Analyzes dependencies. Takes repo path and 
   build file path (pom.xml, package.json) as input.
   Returns: { dependencies: [], outdated: [], cveFlags: [], 
   circularDeps: [], riskScore, riskNarrative }
   For now, return hardcoded sample data.

4. `docs_generator` — Generates documentation. Takes repo path and 
   results from other agents as input.
   Returns: { readme: string, executiveSummary: string, 
   modernizationRoadmap: string, riskHeatmap: {} }
   For now, return hardcoded sample markdown.

Make sure each tool has clear descriptions and JSON schemas for inputs/outputs.
The server should be runnable with: node src/index.js

Project structure:
code-archaeologist/
├── src/
│   ├── index.js          (MCP server entry point)
│   ├── tools/
│   │   ├── excavateRepo.js
│   │   ├── gitHistorian.js
│   │   ├── dependencyGrapher.js
│   │   └── docsGenerator.js
│   └── utils/
│       └── watsonx.js    (placeholder for WatsonX API calls)
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

### 1B. Test the MCP server locally

```
Write a simple test script (test/manual-test.js) that:
1. Starts the MCP server
2. Calls each tool with sample inputs
3. Prints the responses
4. Verifies the JSON shapes are correct

This helps us verify the server works before connecting it to Bob IDE.
```

### 1C. Bob MCP configuration

```
Create the MCP configuration needed to connect this server to Bob IDE.
Output the JSON config block that goes into Bob's MCP settings 
(Settings > MCP > Project MCPs). The server runs via stdio with 
command: "node" and args: ["src/index.js"]. Include the working 
directory path. Also create a .bob/settings.json if that's how 
project-level MCP config works.
```

---

## Phase 2: Git Historian Goes Real

### 2A. Real git log parsing

```
Replace the hardcoded response in src/tools/gitHistorian.js with real 
git history analysis. The tool should:

1. Run `git log` commands on the provided repo path using child_process
2. Extract:
   - Total commit count
   - Top 10 contributors by commit count (name, email, count, % of total)
   - First and last commit dates (repo age)
   - Commit frequency timeline (commits per month for the last 24 months, 
     or full history if shorter)
   - Files with the most churn (most commits touching them)
   - The "bus factor" — how many contributors wrote >50% of the code
   - Last active date of top contributor (when did they stop committing?)

3. Format the output as structured JSON matching the existing schema

4. Include a `narrative` field that tells the human story:
   "This codebase is X years old. Y contributors have touched it, but 
   Z wrote N% of it and their last commit was [date]. The bus factor is [N]."

Use `git log --format` flags for efficient parsing. Don't load the 
entire log into memory — stream and aggregate.

Test it against the apache/struts1 repo cloned locally.
```

### 2B. WatsonX narrative enhancement (after API is ready)

```
Update src/tools/gitHistorian.js to optionally call WatsonX Granite 
to enhance the narrative field.

Take the raw stats (top contributors, dates, bus factor) and send 
them to WatsonX with this prompt template:

"You are a code archaeologist analyzing a legacy codebase. Given these 
git history statistics, write a 3-4 sentence narrative that tells the 
human story of this codebase — who built it, when they left, and what 
risks that creates for a new developer inheriting it.

Stats:
{stats_json}

Write in a direct, slightly dramatic tone. Highlight the biggest risk."

Use the WatsonX utility in src/utils/watsonx.js. If WatsonX is not 
configured (no API key), fall back to the template-based narrative.
```

---

## Phase 3: Dependency Grapher Goes Real

### 3A. Real pom.xml / build file parsing

```
Replace the hardcoded response in src/tools/dependencyGrapher.js with 
real dependency analysis.

The tool should:

1. Detect build system: look for pom.xml (Maven), build.gradle (Gradle), 
   package.json (Node), or requirements.txt (Python) in the repo root
   
2. For pom.xml (our demo target — apache/struts1):
   - Parse all <dependency> elements
   - Extract: groupId, artifactId, version
   - Flag dependencies with no version specified
   - Detect parent POM inheritance
   - Find all modules in multi-module projects

3. Version analysis:
   - Flag dependencies where the version is very old (heuristic: 
     version < 2.0 for well-known libs, or published before 2015)
   - List all dependencies without pinned versions

4. Known CVE check (lightweight):
   - Maintain a small hardcoded list of known-vulnerable packages 
     (struts itself, commons-collections < 3.2.2, log4j < 2.17, 
     commons-beanutils < 1.9.4, etc.)
   - Flag any matches

5. Output structured JSON:
   { 
     buildSystem: "maven",
     totalDependencies: N,
     dependencies: [...],
     outdatedFlags: [...],
     cveFlags: [...],
     riskScore: 1-10,
     riskNarrative: "..."
   }

Test against apache/struts1.
```

### 3B. WatsonX risk narrative (after API is ready)

```
Update src/tools/dependencyGrapher.js to call WatsonX Granite for 
risk narrative generation.

Send the dependency analysis results to WatsonX with this prompt:

"You are a security-conscious code archaeologist. Given this dependency 
analysis of a legacy codebase, write a 3-4 sentence risk assessment. 
Focus on the most critical vulnerabilities, the overall health of the 
dependency tree, and what a new developer should be careful about.

Analysis:
{analysis_json}

Be specific about which dependencies are dangerous and why. 
Prioritize actionable warnings."

Fall back to template narrative if WatsonX is unavailable.
```

---

## Phase 4: Docs Generator + Excavation Report

### 4A. Docs generator implementation

```
Replace the hardcoded response in src/tools/docsGenerator.js with real 
documentation generation.

The tool takes the combined output from gitHistorian and 
dependencyGrapher as input and produces:

1. **Executive Summary** (3-5 sentences):
   - What this codebase is
   - How old it is  
   - Key risk factors
   - Recommended first steps for a new developer

2. **Onboarding README** (structured markdown):
   - Project overview (from repo structure analysis)
   - Key contributors and their status
   - Architecture notes (top-level directory guide)
   - Dependency health summary
   - Known risks and CVEs
   - "Where to start" recommendations

3. **Modernization Roadmap** (prioritized list):
   - Critical: CVE fixes needed
   - High: Outdated dependencies to upgrade  
   - Medium: Code areas with high bus factor risk
   - Low: Nice-to-have improvements

4. **Risk Heatmap** (JSON for UI rendering):
   - Map of risk areas: { security: 1-10, maintenance: 1-10, 
     complexity: 1-10, documentation: 1-10 }

This MUST call WatsonX Granite for the prose generation parts. 
Use the raw data from git + deps as grounding context.

If WatsonX is unavailable, generate the structured data but use 
template strings instead of AI-generated prose.
```

---

## Phase 5: Integration + Polish

### 5A. Orchestrated excavation flow

```
Update src/tools/excavateRepo.js to be the real orchestrator.

When called, it should:
1. Set phase 1 to "running" — do basic repo reconnaissance:
   - Count files by extension
   - Detect primary language
   - Check for README, docs/, tests/
   - Calculate repo age from git
   
2. Set phase 2 to "running" — call gitHistorian tool internally
3. Set phase 3 to "running" — mark as "coming soon" (AST parser stub)
4. Set phase 4 to "running" — call dependencyGrapher tool internally  
5. Set phase 5 to "running" — call docsGenerator with combined results

Return the complete excavation report with all phase results nested.

Each phase should have: { name, status, startedAt, completedAt, result }

Handle errors gracefully — if one agent fails, the others should 
still complete. Mark failed phases as "error" with the error message.
```

### 5B. WatsonX utility module

```
Implement src/utils/watsonx.js as the shared WatsonX API client.

Requirements:
- Read WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_URL, WATSONX_MODEL from .env
- Handle IAM token generation (API key → bearer token via https://iam.cloud.ibm.com/identity/token)
  - IMPORTANT: The Authorization header needs an IAM bearer token, NOT the API key directly
  - POST to https://iam.cloud.ibm.com/identity/token with:
    Content-Type: application/x-www-form-urlencoded
    Body: grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${API_KEY}
  - Response includes access_token (use as Bearer token) and expires_in (3600s)
- Token caching with 55-minute refresh (tokens expire at 60 min)
- Single function: generateText(prompt, options) 
  - options: { maxTokens, temperature, model }
  - Default model from env: process.env.WATSONX_MODEL || 'ibm/granite-3-8b-instruct'
  - NEVER hardcode model IDs at call sites — always use the constant/env var
  - Default maxTokens: 1000
  - Default temperature: 0.7
- BANNED MODELS (never use, will hurt judging):
  - llama-3-405b-instruct
  - mistral-medium-2505
  - mistral-small-3-1-24b-instruct-2503
- Graceful fallback: if no API key configured, return null 
  (callers handle the fallback)
- Rate limiting: basic delay between calls to not blow through credits
- Log token usage for budget tracking
- Common WatsonX errors (from insider): wrong endpoint URL, expired IAM token, 
  incorrect input payload parameters. Handle all three gracefully with clear error messages.

.env.example should have:
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL=ibm/granite-3-8b-instruct
# Alternative: ibm/granite-4-h-small (if available on platform — Granite 4 is latest series)
```

---

## Submission Prep

### README generation

```
Generate a polished README.md for the code-archaeologist repo.

Sections:
1. Hero section with project name, one-liner, and a badge/screenshot
2. The Problem — why legacy code onboarding is painful
3. The Solution — what Code Archaeologist does
4. Architecture diagram (ASCII or mermaid)
5. How it works — the 5-phase excavation workflow
6. Setup instructions:
   - Prerequisites (Node.js, Bob IDE)
   - Clone repo
   - npm install
   - Configure MCP in Bob IDE (include the config JSON)
   - Set up WatsonX credentials in .env
   - Run on a target repo
7. Demo — link to video
8. Tech stack
9. Team: "git happens" — solo dev hackathon entry
10. Built for IBM Dev Day Bob Hackathon 2026

Tone: professional but with personality. Not corporate-speak.
```

### Written submission statements

```
Help me write the two required submission texts:

1. **Problem and solution statement** (500 words max):
   Frame the problem of legacy code onboarding, introduce Code 
   Archaeologist as the solution, explain how it works (3 agents, 
   5 phases), and emphasize the before/after impact (2 weeks → 
   90 seconds). Hit all 4 judging criteria naturally.

2. **How IBM Bob and WatsonX were used** (specific and technical):
   - Bob IDE: agentic orchestration layer, MCP tool host, 
     repository context understanding, development partner
   - WatsonX Granite: code understanding, narrative generation, 
     risk assessment prose, documentation generation
   - MCP: tool protocol connecting Bob to our 3 agents
   Be specific about WHAT each technology does, not just that 
   we used it.
```

---

## Emergency Fallbacks

### If WatsonX never works

```
Create a standalone mode where all AI-generated prose uses 
well-crafted template strings instead of WatsonX calls.

The templates should be good enough for a demo — use string 
interpolation with the real data from git/deps analysis to 
generate convincing narratives. Example:

"This codebase was first committed on ${firstCommit} and has 
${totalCommits} commits from ${contributorCount} contributors. 
${topContributor} authored ${topPercent}% of all commits, with 
their last contribution on ${lastActive}. This represents a 
significant bus factor risk."

Make the templates detailed enough that a judge watching a demo 
would believe they're AI-generated.
```

---

*Last updated: May 1, 2026*  
*Companion to: CODE_ARCHAEOLOGIST.md*
