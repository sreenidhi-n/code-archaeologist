# 🏺 Code Archaeologist
### IBM Dev Day Bob Hackathon — Living Project Doc
> **Challenge:** Turn idea into impact faster  
> **Stack:** IBM Bob + WatsonX (Granite) + MCP  
> **Deadline:** May 3, 2026 — 10:00 AM ET / 7:30 PM IST  
> **Status:** 🟡 Building

---

## 1. The Pitch

> *A junior dev inherits a 10-year-old Java codebase. Without Code Archaeologist, they spend 2 weeks just getting oriented. With it? 90 seconds.*

**Code Archaeologist** is a Bob-powered VS Code tool that helps developers understand, navigate, and modernize legacy codebases through parallel AI agents — turning months of archaeological digging into an instant excavation report.

**One-liner:** *"Unearth the story of any codebase in 90 seconds."*

---

## 2. Challenge Alignment

| Challenge Criteria | How We Hit It |
|---|---|
| Get up to speed on existing code quickly | Core value prop — the entire excavation workflow |
| Generate documentation | Phase 4: Docs generation agent |
| Reduce repetitive tasks | 5 parallel agents doing the grunt work |
| Bob understands repository context | Multi-file AST + git history agents |
| Any skill level | Junior devs inheriting legacy code = primary persona |
| Powered by Bob | Bob orchestrates all agents via MCP |

### Judging Criteria (5pts each, 20pts total)

- **Completeness/Feasibility** — How feasible? How fully thought-out? How complete is the PoC? How clear is the IBM tech application?
- **Creativity/Innovation** — How unique/original is the AI approach? Is it differentiated in the market?
- **Design/Usability** — How good is the UX? How quickly could it be adopted in real-world scenarios?
- **Effectiveness/Efficiency** — High priority problem? Achieves goal efficiently? Measurable impact? Scales?

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VS Code + Bob                     │
│  ┌─────────────────────────────────────────────┐    │
│  │           Code Archaeologist Panel           │    │
│  │            (Bob Chat Interface)               │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │ MCP Tool Calls                 │
│  ┌──────────────────▼──────────────────────────┐    │
│  │              MCP Server Layer                │    │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │    │
│  │  │   Git    │ │   AST    │ │  Dependency │  │    │
│  │  │  Miner   │ │  Parser  │ │   Grapher   │  │    │
│  │  └────┬─────┘ └────┬─────┘ └──────┬──────┘  │    │
│  │  ┌────▼─────────────▼─────────────▼──────┐  │    │
│  │  │         WatsonX Granite API            │  │    │
│  │  │   (Code understanding + embeddings)    │  │    │
│  │  └────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### The 3 Active Agents (trimmed from 5 for feasibility)

| Agent | What It Does | WatsonX Role |
|---|---|---|
| 🔍 **Git Historian** | Streams git log, calculates bus factor, contributor patterns, high-churn files; builds 💀 Knowledge Obituaries for departed high-impact contributors | Writes human narrative + per-contributor obituary identifying orphaned files and lost institutional knowledge |
| 🕸️ **Dependency Grapher** | Parses pom.xml/package.json, detects CVEs via live OSV.dev API (falls back to offline list), calculates weighted risk score | Writes 3-4 sentence risk assessment from real CVE data |
| 📄 **Docs Generator** | Synthesizes all phase outputs into onboarding docs + roadmap | Executive summary, where-to-start guide, plus reads actual source code for high-risk file analysis |

### Tech Stack

```
Bob (VS Code Extension)     — Agentic orchestration, UI host
MCP Server (Node.js)        — Tool definitions, agent routing
WatsonX.ai API              — Granite code model inference
  └─ granite-3-8b-instruct  — Default: code explanation & narrative
  └─ granite-4-h-small      — Latest Granite 4 (if available)
Node.js File System         — Direct repo access via MCP server
Git CLI (child_process)     — History parsing via git log streaming
fast-xml-parser             — pom.xml dependency extraction
```

---

## 4. The 5-Phase Excavation Workflow

```
Phase 1: RECONNAISSANCE
  └─ MCP server walks repo file tree via Node.js fs
  └─ Detects primary language, counts files, identifies markers (README, tests, docs)
  └─ Output: "Site Survey" — high level codebase snapshot

Phase 2: HISTORICAL EXCAVATION
  └─ Git Historian agent streams git log output
  └─ Contributor analysis, bus factor, commit timeline, high-churn files
  └─ 💀 Knowledge Obituary: departed contributors (≥15% codebase, >6 months gone), orphaned files, WatsonX memorial
  └─ WatsonX Granite writes the human narrative of who built this and when they left
  └─ Output: "Stratigraphic Map" — contributor timeline, risk analysis, knowledge obituaries

Phase 3: SEMANTIC MAPPING
  └─ File metrics: LOC estimates, largest files, test ratio, directory depth
  └─ WatsonX Granite reads top 3 high-churn files and identifies implicit knowledge + risk
  └─ WatsonX Granite writes structural observation from real metrics
  └─ Output: "Artifact Catalog" — structural metrics + AI-powered code analysis

Phase 4: RISK ASSESSMENT
  └─ Dependency Grapher parses pom.xml (Maven) or package.json (npm)
  └─ CVE detection via live OSV.dev API (real-time, parallel queries, falls back to offline list of 18 CVEs)
  └─ Risk score calculated from CVSS severity weighting
  └─ WatsonX Granite writes risk narrative from real CVE data
  └─ Output: "Hazard Report" — CVE inventory, outdated deps, risk score

Phase 5: MODERNIZATION ROADMAP
  └─ Docs Generator synthesizes all phase outputs
  └─ WatsonX Granite generates executive summary and "where to start" guide
  └─ WatsonX Granite reads + analyzes actual high-churn source files
  └─ Auto-saves ONBOARDING.md and EXCAVATION_REPORT.md to analyzed repo root
  └─ Output: "Excavation Report" — the full deliverable
```

---

## 5. Demo Video Plan (3 minutes max)

> 🎯 **KEY INSIGHT:** "Judges will see lots of screen-sharing videos" — IBM is telling us to NOT just screen-record. Be creative. Stand out.

### Video Format: Narrated story, NOT a screen share

**Structure: Problem → Solution → Live Demo → Impact**

```
0:00–0:30 — THE PROBLEM (talking head or animated)
  "Every dev has inherited a mystery codebase. The engineer who 
  built it left. The docs don't exist. You're staring at 25 years 
  of Java and you have a sprint deadline next week."
  [Show the pain — maybe a quick montage of confusion]

0:30–0:45 — THE SOLUTION (quick concept explainer)
  "Code Archaeologist uses 3 parallel AI agents — powered by Bob 
  and WatsonX Granite — to excavate the full story of any codebase 
  in under 2 minutes."
  [Flash the architecture diagram, keep it fast]

0:45–2:15 — LIVE DEMO (the money shot — 90 seconds)
  [Switch to VS Code with Bob]
  - Open apache/struts1 — "This is a real 25-year-old Java codebase"
  - Trigger excavation
  - Phase 1: Reconnaissance lights up — 1424 files, Java codebase detected
  - Phase 2: Git Historian reveals Craig McClanahan wrote 18% and left in 2006
  - 💀 Knowledge Obituary drops: "2 knowledge gaps · orphaned files identified"
  - Phase 4: Risk Assessment — 7 CVEs via live OSV feed (2 CRITICAL, RCE gadget chain)
  - Phase 5: Docs Generator writes ONBOARDING.md + EXCAVATION_REPORT.md to repo root
  - Show the final report: risk heatmap, roadmap, obituaries
  "90 seconds. Full onboarding doc. Risk heatmap. Knowledge obituaries. Modernization roadmap."

2:15–2:45 — HOW WE BUILT IT (Bob + WatsonX flex)
  "Bob orchestrates the agents via MCP. WatsonX Granite powers 
  the code understanding. Every phase runs through Bob IDE."
  [Quick flash of Bob session, MCP config, WatsonX Prompt Lab]

2:45–3:00 — CLOSER
  "This is Code Archaeologist. By git happens.
  Turning months of archaeology into minutes."
```

### Video Production Notes
- Do NOT just screen-record and talk over it
- Options: talking head intro → screen demo → talking head close
- OR: animated explainer intro → screen demo → impact stats close  
- Add captions/subtitles — judges may watch on mute
- Background music (royalty-free, subtle)
- Make sure the video link is publicly accessible (YouTube unlisted or similar)

---

## 5b. Constraints & Budget

### Bobcoins: 40 total (no refills)
- Every Bob IDE interaction costs Bobcoins
- Plan prompts before sending — don't explore, execute
- Monitor usage: Bob IDE Settings → General → Budget

### IBM Cloud Credits: $80 total  
- Shared across all watsonx services
- Account SUSPENDED at 100% — alerts at 25/50/80% (hourly, may miss)
- Foundation model tokens: 1,000 tokens = 1 RU = $0.0001

### Banned WatsonX Models (will hurt judging)
- ❌ `llama-3-405b-instruct`
- ❌ `mistral-medium-2505`  
- ❌ `mistral-small-3-1-24b-instruct-2503`
- ✅ Use `granite-3-8b-instruct` (default, recommended)

### Security
- NEVER commit API keys to public repos — instant account suspension
- Use `.env` files + `.gitignore`

---

## 6. Build Status

### Guiding principle: *Get the demo working first, polish second.*

#### Core Implementation — COMPLETE
- [x] MCP server (Node.js, stdio transport, 4 registered tools)
- [x] Phase 1: Reconnaissance — file walk, language detection, project markers
- [x] Phase 2: Git Historian — streaming git log, bus factor, contributor analysis, high-churn files, 💀 Knowledge Obituaries
- [x] Phase 3: Semantic Mapping — LOC estimates, largest files, test ratio, WatsonX structural observation
- [x] Phase 4: Dependency Grapher — pom.xml + package.json parsing, live OSV CVE feed + offline fallback (18 CVEs), risk scoring
- [x] Phase 5: Docs Generator — 3 parallel WatsonX calls, reads actual source files, saves ONBOARDING.md + EXCAVATION_REPORT.md
- [x] WatsonX Granite integration — IAM token caching, retry/backoff, rate limiting, template fallbacks
- [x] Input validation + structured error responses
- [x] Real-time stderr progress streaming for Bob IDE

#### Tested Against
- [x] apache/struts1 — 25-year-old Java codebase, 5,272 commits, 29 contributors, 7 CVEs, full excavation in ~7s
- [x] Unit + integration test suite (manual-test.js)

#### Submission
- [ ] Demo video recording
- [ ] Written problem/solution statement
- [ ] Bob session exports

---

## 7. WatsonX Integration Notes

> ✅ **Friend consulted — key intel confirmed (May 1, 2026)**

### Confirmed Answers:
1. **Model:** No specific Granite model for code explanation — it's a general foundation model. Use `granite-3-8b-instruct` (default) or `granite-4-h-small` if available on the platform. Granite-4 series is latest.
2. **Auth:** IAM token expires on fixed interval (~60 min). Use API key to auto-regenerate. Common errors: wrong endpoint, token expiry, bad payload — nothing scary.
3. **WatsonX Orchestrate:** NOT needed for MCP. Bob acts as the "brain" for the agent. Concept > implementation.
4. **🏆 Judge tip:** *"Stats is what they eye the most — cost and number of effort hours."* → Our demo MUST show concrete before/after metrics prominently.
5. **Model Gateway:** WatsonX team exploring it. If integrated with Bob, judges will notice. Bonus feature if time permits.

### API Pattern (confirmed)
```javascript
// WatsonX.ai inference endpoint
const response = await fetch(
  `https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${IAM_TOKEN}`, // NOT the API key directly — need IAM token
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model_id: process.env.WATSONX_MODEL || 'ibm/granite-3-8b-instruct',
      input: prompt,
      parameters: { max_new_tokens: 1000 }
    })
  }
);

// IAM token generation
const tokenResponse = await fetch('https://iam.cloud.ibm.com/identity/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_API_KEY}`
});
// Token expires in 3600s — refresh at 55 min
```

---

## 8. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| WatsonX API setup takes too long | Medium | Build with stub LLM first, swap late |
| 5 agents too ambitious for 72hrs | Medium | Stub 3, fully implement 2 for demo |
| Good demo repo hard to find | Low | Pick one now — good candidates: Apache Struts, Spring PetClinic, any old Node monolith |
| Bob MCP integration has weird gotchas | Medium | Start MCP scaffold Day 1, surface issues early |

---

## 9. Demo Repo — LOCKED IN

**Apache Struts 1** — `https://github.com/apache/struts1`
- 25-year-old frozen Java codebase (donated to Apache in 2000)
- Perfect "mystery codebase" narrative
- Real CVE history for dependency grapher to flag
- Judges will immediately recognize it as genuine legacy

---

## 10. Submission Checklist

### Required Deliverables
- [ ] **Video demo** — 3 min max, publicly accessible URL (YouTube unlisted etc)
- [ ] **Written problem & solution statement** — 500 words or less
- [ ] **Written statement: how IBM Bob + WatsonX were used** — be specific
- [ ] **Code repo** — public GitHub/GitLab link
- [ ] **Bob task session reports** — `bob_sessions/` folder in repo with screenshots + exported markdown
- [ ] **Exported IBM Bob report** — include in repo

### Quality Checks
- [ ] Video is NOT just a screen recording — has narrative, energy, stands out
- [ ] All 4 judging dimensions explicitly addressed in write-up
- [ ] Bob + WatsonX integration clearly demonstrated (not just mentioned)
- [ ] The "before/after" story lands in the demo
- [ ] No API keys or credentials in the public repo
- [ ] Video link works in incognito/private browser

---

*Last updated: May 2, 2026*
*Built for: IBM Dev Day Bob Hackathon*
