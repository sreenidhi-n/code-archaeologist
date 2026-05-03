# 🏺 Code Archaeologist

> **Excavate legacy codebases in seconds. Understand 25 years of history before your first commit.**

Built for the **IBM Dev Day Bob Hackathon 2026** · Team: *git happens* (solo)

---

## The Problem

You've just been handed a 15-year-old Java codebase. The original authors are gone. The documentation is stale. The dependencies haven't been updated since 2011. Somewhere in this repo lives a CVE with a CVSS 9.8 score — you just don't know where yet.

This is the legacy code onboarding problem. It costs new developers **2–3 weeks** to understand a codebase well enough to make their first change safely. Most of that time is spent on questions a machine could answer in seconds.

---

## The Solution

**Code Archaeologist** is a Bob IDE tool that runs a 5-phase excavation on any repository and hands back a complete developer report — in under 10 seconds.

```
❯ excavate_repo("/path/to/legacy-app")

Phase 1 ✅ Reconnaissance         65ms  — 847 files · Java · Maven
Phase 2 ✅ Historical Excavation  2.1s  — 5,272 commits · bus factor 4 · top dev gone since 2006
Phase 3 ⏭ Semantic Mapping       skipped — coming in next release
Phase 4 ✅ Risk Assessment        2.7s  — 26 dependencies · 7 CVEs · risk score 10/10
Phase 5 ✅ Modernization Roadmap  2.7s  — executive summary · onboarding guide · roadmap

Total: 5.5 seconds
```

No more archaeology by hand.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                      Bob IDE                         │
│   "excavate_repo('/path/to/struts1')"                │
└─────────────────────┬────────────────────────────────┘
                      │  MCP / stdio
┌─────────────────────▼────────────────────────────────┐
│             Code Archaeologist MCP Server            │
│                   (Node.js)                          │
│                                                      │
│   ┌──────────────────────────────────────────────┐   │
│   │         excavateRepo  (Orchestrator)         │   │
│   └──────┬───────────────────────┬───────────────┘   │
│          │ parallel              │ parallel           │
│   ┌──────▼──────┐        ┌───────▼────────┐          │
│   │   Git       │        │  Dependency    │          │
│   │  Historian  │        │   Grapher      │          │
│   │             │        │                │          │
│   │ git log     │        │ pom.xml parse  │          │
│   │ bus factor  │        │ CVE checklist  │          │
│   │ churn files │        │ risk scoring   │          │
│   └──────┬──────┘        └───────┬────────┘          │
│          └──────────┬────────────┘                   │
│                ┌────▼───────────┐                    │
│                │ Docs Generator │                    │
│                │                │                    │
│                │ WatsonX        │                    │
│                │ Granite 4      │                    │
│                └────────────────┘                    │
└──────────────────────────────────────────────────────┘
```

---

## The 5 Phases

| Phase | Name | What It Does | Time |
|-------|------|-------------|------|
| 1 | **Reconnaissance** | File count by language, build system detection, docs/tests check | ~65ms |
| 2 | **Historical Excavation** | Streams `git log` → contributor patterns, bus factor, commit timeline, high-churn files | ~2s |
| 3 | **Semantic Mapping** | LOC estimates, largest files, test ratio, directory depth — WatsonX Granite structural observation | ~1.5s |
| 4 | **Risk Assessment** | Parses `pom.xml` across all submodules, flags known CVEs, calculates risk score 1–10 | ~2s |
| 5 | **Modernization Roadmap** | WatsonX Granite synthesizes everything into executive summary, onboarding README, prioritized roadmap | ~2.7s |

---

## Real Output — apache/struts1

Actual results from running Code Archaeologist on `apache/struts1` (26-year-old abandoned Java MVC framework):

**Git History (Phase 2):**
- 5,272 commits · 29 contributors · 26 years old
- Bus factor: **4** (4 engineers hold 50%+ of all knowledge)
- Top contributor: Craig R. McClanahan (18% of commits) — last active **May 2006**
- Highest-churn file: `ActionServlet.java` — modified 200 times

**Dependency Risk (Phase 4):**
- 26 Maven dependencies across 13 submodules
- **7 CVEs flagged**, including:
  - `CVE-2015-6420` — `commons-collections:2.1` — **CVSS 9.8** — Remote Code Execution
  - `CVE-2019-17571` — `log4j:1.2.17` — **CVSS 9.8** — Remote Code Execution
- Risk score: **10/10**

**WatsonX Narrative (Phase 5):**
> *"This Java web application is highly vulnerable due to unpatched critical security vulnerabilities in outdated third-party libraries; it has been dormant since 2010 with minimal maintenance by a small group of contributors led primarily by Craig R. McClanahan who stopped contributing over a decade ago. The sole focus must be immediately updating all dependencies to patched versions before any further development or deployment can safely occur."*

---

## Setup

### Prerequisites

- Node.js 18+
- Git
- IBM WatsonX account (AI narratives are optional — template fallbacks work without it)

### Install

```bash
git clone https://github.com/git-happens/code-archaeologist
cd code-archaeologist
npm install
```

### Configure WatsonX

```bash
cp .env.example .env
```

Edit `.env`:
```env
WATSONX_API_KEY=your-api-key
WATSONX_PROJECT_ID=your-project-id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL=ibm/granite-4-h-small
```

### Connect to Bob IDE

Bob auto-detects `.bob/mcp.json` — no manual setup needed. If configuring manually, go to **Settings → MCP → Project MCPs**:

```json
{
  "mcpServers": {
    "code-archaeologist": {
      "command": "node",
      "args": ["src/index.js"],
      "disabled": false,
      "alwaysAllow": ["excavate_repo", "git_historian", "dependency_grapher", "docs_generator"]
    }
  }
}
```

### Clone a Demo Target

```bash
git clone https://github.com/apache/struts1 ~/struts1
```

### Run

In Bob IDE:
```
excavate_repo("/Users/yourname/struts1")
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `excavate_repo` | Full 5-phase excavation — the main entry point |
| `git_historian` | Git history analysis only (contributors, bus factor, churn) |
| `dependency_grapher` | Dependency + CVE analysis only |
| `docs_generator` | Report generation from pre-computed agent results |

---

## Testing

```bash
npm test                           # Quick shape validation (~10s)
node test/test-real-repo.js        # Phase 2 + 3 against struts1 (~5s)
node test/test-watsonx.js          # WatsonX connectivity check
node test/test-comprehensive.js    # Full suite: all phases, errors, fallbacks, MCP protocol (~20s)
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| IDE + Agent Runtime | IBM Bob |
| AI / Narrative Generation | IBM WatsonX — `ibm/granite-3-8b-instruct` (default) · `ibm/granite-4-h-small` (Granite 4, set via `WATSONX_MODEL`) |
| Tool Protocol | Model Context Protocol (MCP) |
| Server Runtime | Node.js 22 (ES Modules) |
| XML Parsing | fast-xml-parser |
| Transport | stdio |

---

## Project Structure

```
code-archaeologist/
├── src/
│   ├── index.js                  # MCP server entry point
│   ├── tools/
│   │   ├── excavateRepo.js       # Orchestrator — chains all 5 phases
│   │   ├── gitHistorian.js       # Agent 1: git log analysis
│   │   ├── dependencyGrapher.js  # Agent 2: pom.xml + CVE analysis
│   │   └── docsGenerator.js      # Agent 3: WatsonX report synthesis
│   └── utils/
│       ├── watsonx.js            # WatsonX Granite API client
│       ├── logger.js             # Structured logging
│       └── validation.js         # Input validation
├── test/
│   ├── manual-test.js            # Shape validation suite
│   ├── test-real-repo.js         # Phase 2+3 integration test
│   ├── test-watsonx.js           # WatsonX connectivity test
│   └── test-comprehensive.js     # Full test suite
├── docs/                         # Development documentation
├── .bob/mcp.json                 # Bob IDE MCP configuration
├── .env.example                  # Environment variable template
└── package.json
```

---

## Team

**git happens** · solo entry · IBM Dev Day Bob Hackathon 2026

---

*The name is a joke. The code is serious.*
