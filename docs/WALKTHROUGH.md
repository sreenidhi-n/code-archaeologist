# 🗺️ Code Walkthrough
### Code Archaeologist — How the Code Works
> For judges, contributors, and future developers.  
> Claude Code: update this whenever files are added or architecture changes.

---

## Project Structure Overview

```
code-archaeologist/
├── CLAUDE.md                    # Claude Code project context (auto-read)
├── CODE_ARCHAEOLOGIST.md        # Living project doc — architecture, plan, constraints
├── CLAUDE_CODE_PROMPTS.md       # Claude Code prompt reference
│
├── src/                         # Application source
│   ├── index.js                 # MCP server entry point
│   │                              Initializes the server, registers tools, starts stdio transport
│   ├── tools/                   # Agent implementations
│   │   ├── excavateRepo.js      # Orchestrator — chains all phases together
│   │   ├── gitHistorian.js      # Agent 1: Git history analysis
│   │   ├── dependencyGrapher.js # Agent 2: Dependency + CVE analysis
│   │   └── docsGenerator.js     # Agent 3: Documentation synthesis
│   └── utils/
│       └── watsonx.js           # WatsonX Granite API client (shared)
│
├── test/
│   └── manual-test.js           # Manual test runner for all tools
│
├── docs/                        # Development documentation
│   ├── IMPLEMENTATION_PLAN.md   # Task tracker with status
│   ├── BUILD_LOG.md             # What was done and why
│   ├── WALKTHROUGH.md           # This file — code guide
│   └── OPTIMIZATIONS.md         # Performance decisions
│
├── bob_sessions/                # Bob IDE session exports (for judging)
├── .env.example                 # Environment variable template
├── .gitignore                   # Git ignore rules
├── package.json                 # Node.js dependencies
└── README.md                    # Public-facing project documentation
```

---

## Data Flow

```
User triggers excavation in Bob IDE
        │
        ▼
Bob calls MCP tool: excavate_repo(repoPath)
        │
        ▼
excavateRepo.js orchestrates 5 phases:
        │
        ├─ Phase 1: Reconnaissance (built-in repo scan)
        │     └─ Count files, detect language, check for docs
        │
        ├─ Phase 2: gitHistorian.js
        │     └─ git log → contributors, timeline, bus factor
        │     └─ WatsonX Granite → narrative summary
        │
        ├─ Phase 3: semanticMapping() [in excavateRepo.js]
        │     └─ Walk repo for file sizes, LOC estimate, test ratio, directory depth
        │     └─ WatsonX Granite → structural observation from real metrics
        │
        ├─ Phase 4: dependencyGrapher.js
        │     └─ pom.xml/package.json parse → deps, versions, CVE matches
        │     └─ WatsonX Granite → risk narrative
        │
        └─ Phase 5: docsGenerator.js
              └─ Combines Phase 1-4 outputs
              └─ C5: crossRefCvesAndOrphans() — import-scans orphaned files for CVE package usage
              └─ WatsonX Granite → executive summary, where-to-start guide (parallel)
              └─ WatsonX Granite → reads actual high-churn source files (code analysis)
              └─ WatsonX Granite → urgent advisories for CVE-orphan intersection files
              └─ Auto-saves ONBOARDING.md + EXCAVATION_REPORT.md to repo root
              └─ Returns complete Excavation Report
        │
        ▼
Bob IDE displays results in panel
```

---

## Module Details

> Claude Code: fill in each section as the module is implemented.

### `src/index.js` — MCP Server Entry Point
**Status:** Implemented
**Purpose:** Initializes the MCP server, registers all 4 tools, starts stdio transport
**Key details:**
- Registers `excavate_repo`, `git_historian`, `dependency_grapher`, `docs_generator` with full input schemas
- Every tool call runs through `validateToolArguments()` before execution
- Responses use `createSuccessResponse()` / `createErrorResponse()` for a consistent MCP envelope
- `logger.toolStart` / `toolSuccess` / `toolError` wrap every call for structured timing logs

### `src/tools/excavateRepo.js` — Orchestrator
**Status:** Implemented
**Purpose:** Main entry point tool. Runs all 5 phases and coordinates parallel execution.
**Input:** `{ repoPath: string }`
**Output:** `{ phases: Phase[], report: ExcavationReport, status, totalDurationMs }`
**Key details:**
- Phase 1 (Reconnaissance) runs first — its results feed Phase 3
- Phase 2 (Git Historian) + Phase 4 (Dependency Grapher) run in parallel via `Promise.all`
- Phase 3 (Semantic Mapping) runs after 2+4 complete — walks repo for LOC, file sizes, test ratio, calls WatsonX for structural observation
- Phase 5 (Docs Generator) runs last — consumes all prior results
- Each phase is wrapped in `runPhase()` which tracks timing, handles errors gracefully, and emits `[Code Archaeologist]` progress lines to stderr

### `src/tools/gitHistorian.js` — Git History Agent
**Status:** Implemented
**Purpose:** Mines git history to surface contributor patterns, bus factor, the "who left" story, and Knowledge Obituaries
**Input:** `{ repoPath: string }`
**Output:** `{ topContributors, commitTimeline, busFactorAnalysis, highChurnFiles, narrative, knowledgeObituaries }`
**Key details:**
- Streams `git log --format=%ae|%an|%ad --date=short` line-by-line — memory-safe on any repo size
- `getHighChurnFiles()` streams `git log --pretty=format: --name-only` to count modifications per file
- Both git processes have 60-second SIGTERM timeouts to prevent hangs
- Bus factor = minimum contributors to account for >50% of all commits
- `buildCommitTimeline()` groups monthly counts into readable periods (auto-scales period size)
- **💀 Knowledge Obituary:** `buildKnowledgeObituaries()` identifies contributors with ≥15% of commits who have been inactive >6 months; `getTopFilesByContributor()` finds their most-touched files; `hasFileBeenTouchedSince()` checks which are orphaned (zero commits since departure); WatsonX writes a 2-3 sentence obituary per contributor
- WatsonX narrative + Knowledge Obituary run in parallel via `Promise.all`

### `src/tools/dependencyGrapher.js` — Dependency Agent
**Status:** Implemented
**Purpose:** Parses build files, detects CVEs via live OSV API, calculates weighted risk score
**Input:** `{ repoPath: string, buildFilePath?: string }`
**Output:** `{ dependencies, cveFlags, outdatedFlags, riskScore, riskNarrative, cveSource }`
**Key details:**
- Auto-detects build system: Maven (`pom.xml`), Gradle, npm (`package.json`), Python
- Maven: recursively parses multi-module POMs via `fast-xml-parser`, resolves submodule paths
- npm: parses `package.json` dependencies + devDependencies, strips semver range prefixes
- **Live OSV feed:** `checkOSVCVEs()` queries `https://api.osv.dev/v1/query` in parallel for all deps (5s per-request timeout, 10s overall timeout, in-memory cache). Falls back to hardcoded list (18 CVEs) on network failure. Result includes `cveSource: 'osv'|'offline'`
- Risk score: critical CVE = +3 pts, high = +1.5, medium = +0.5, capped at 10
- WatsonX narrative falls back to template string if API unavailable

### `src/tools/docsGenerator.js` — Documentation Agent
**Status:** Implemented
**Purpose:** Synthesizes all phase outputs into the final deliverable — onboarding docs, roadmap, risk heatmap, and Knowledge Obituaries
**Input:** `{ repoPath, gitHistorianResult, dependencyGrapherResult, reconResult }`
**Output:** `{ executiveSummary, onboardingReadme, excavationReport, modernizationRoadmap, riskHeatmap, highRiskFiles, savedFiles, impactBanner }`
**Key details:**
- Runs 3 WatsonX calls in parallel: executive summary, where-to-start guide, + high-risk file code analysis
- High-risk file analysis: reads actual source of top 3 high-churn files (capped at 150 lines), asks Granite what each file does, what implicit knowledge is needed, and what's highest risk
- `buildRoadmap()` derives the modernization roadmap from real CVE data + git stats — no AI guessing
- `calculateRiskHeatmap()` computes 4-dimension risk matrix (security, maintenance, complexity, documentation) from real scores
- Auto-saves `ONBOARDING.md` and `EXCAVATION_REPORT.md` to the analyzed repo root
- Impact metrics banner: `files analyzed · commits parsed · CVEs detected · contributors mapped · age · [CVEs via live OSV feed] · [💀 N knowledge gaps]`
- **💀 Knowledge Obituaries section** in EXCAVATION_REPORT.md: lists each departed contributor with their orphaned files and WatsonX obituary

### `src/utils/watsonx.js` — WatsonX Client
**Status:** Implemented
**Purpose:** Shared WatsonX Granite API client with IAM token management, retry logic, and rate limiting
**Key details:**
- IAM tokens cached with 55-minute expiration; `tokenFetchPromise` deduplicates concurrent refresh requests
- Retry with exponential backoff on 503, 429, timeout, ECONNRESET errors (configurable via env vars)
- Rate limiting: 60 requests/minute sliding window (configurable via `WATSONX_RATE_LIMIT`)
- Default model: `ibm/granite-3-8b-instruct` (overridable via `WATSONX_MODEL` env var)
- Returns `null` (never throws) when credentials are missing — callers fall back to templates

---

## Quick Start (No Deployment Needed!)

**You DON'T need to deploy anything or find a gateway URL to use Code Archaeologist.**

Just set these 2 required environment variables in your `.env` file:

```bash
WATSONX_API_KEY=your-ibm-cloud-api-key
WATSONX_PROJECT_ID=your-watsonx-project-id
```

That's it! The tool will automatically:
- Use the default IBM watsonx endpoint
- Connect to Granite 3.8B model
- Work immediately without any deployment

**Where to get these values:**
1. **WATSONX_API_KEY**: IBM Cloud Console → Manage → Access (IAM) → API keys → Create
2. **WATSONX_PROJECT_ID**: watsonx.ai → Your Project → Settings → General → Project ID

---

## Advanced: Model Gateway Setup (Optional)

**Want to test the gateway feature?** Here's how to set it up:

### Option 1: Using watsonx.ai Deployments

1. **Go to watsonx.ai**: https://dataplatform.cloud.ibm.com/wx/home
2. **Select your project**
3. **Navigate to Deployments**:
   - Click "Deployments" in the left sidebar
   - Click "New deployment" → "Online"
4. **Deploy a Foundation Model**:
   - Select "Foundation model" as deployment type
   - Choose a Granite model (e.g., `ibm/granite-3-8b-instruct`)
   - Give it a name (e.g., "granite-gateway")
   - Click "Create"
5. **Get the Endpoint URL**:
   - Once deployed, click on your deployment
   - Copy the "Endpoint" URL
   - Format: `https://us-south.ml.cloud.ibm.com/ml/v1/deployments/{deployment-id}`
   - This is your `WATSONX_GATEWAY_URL`!

### Option 2: Using Watson Orchestrate

If you're using Watson Orchestrate for model routing:

1. **Access Watson Orchestrate**: https://orchestrate.ibm.com
2. **Create a Model Gateway**:
   - Go to "AI Models" or "Model Management"
   - Set up a gateway configuration
   - Configure routing rules for Granite models
3. **Get Gateway Endpoint**:
   - Copy the gateway endpoint URL from your configuration
   - Format: `https://orchestrate.ibm.com/api/v1/gateway/{gateway-id}`
   - Use this as your `WATSONX_GATEWAY_URL`

### Option 3: Direct Deployment Endpoint (Simplest for Testing)

The easiest way to test gateway mode is to use a deployment endpoint:

1. **In watsonx.ai**, go to your project
2. **Deployments** → Find any deployed Granite model
3. **Copy the endpoint URL** - this acts as a "gateway" to that specific model
4. **Set in .env**:
   ```bash
   WATSONX_GATEWAY_URL=https://us-south.ml.cloud.ibm.com/ml/v1/deployments/your-deployment-id
   ```

### Testing Gateway Mode

Once you have the URL:

```bash
# In your .env file
WATSONX_GATEWAY_URL=https://us-south.ml.cloud.ibm.com/ml/v1/deployments/abc123
WATSONX_API_KEY=your-key
WATSONX_PROJECT_ID=your-project
```

When you start Code Archaeologist, you'll see:
```
[INFO] WatsonX routing: Gateway mode (model-agnostic) {"gatewayUrl":"https://..."}
```

This confirms gateway routing is active!

### Why Use Gateway Mode?

- **Model Flexibility**: Change models by updating gateway config, not code
- **A/B Testing**: Route different requests to different models
- **Load Balancing**: Distribute load across model instances
- **Centralized Control**: Manage model routing in one place

**Configuration Examples:**

```bash
# Option 1: Gateway Mode (model-agnostic)
WATSONX_GATEWAY_URL=https://us-south.ml.cloud.ibm.com/ml/v1/deployments/abc123
WATSONX_API_KEY=your-ibm-cloud-api-key
WATSONX_PROJECT_ID=your-project-id

# Option 2: Direct Mode (traditional - works without gateway)
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_API_KEY=your-ibm-cloud-api-key
WATSONX_PROJECT_ID=your-project-id
WATSONX_MODEL=ibm/granite-3-8b-instruct

# Option 3: Default Mode (minimal config)
WATSONX_API_KEY=your-ibm-cloud-api-key
WATSONX_PROJECT_ID=your-project-id
# Uses default endpoint and model
```

**Base URL Priority:**
1. `WATSONX_GATEWAY_URL` (if set) → Gateway mode
2. `WATSONX_URL` (if set) → Direct mode with custom endpoint
3. `https://us-south.ml.cloud.ibm.com` → Default direct mode

**Gateway Benefits:**
- Switch Granite model variants without code changes
- A/B test different models via gateway configuration
- Centralized model routing and load balancing
- Zero-downtime model updates

**Note:** Gateway setup is **optional**. The tool works in Direct Mode by default, which is perfect for most use cases. Gateway Mode is primarily for enterprise deployments requiring dynamic model switching.

---

*Claude Code: keep this document current. It's a submission asset.*
