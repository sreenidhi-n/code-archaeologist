# CLAUDE.md — Project Context for Claude Code
> Claude Code reads this file automatically. It is the source of truth for this project.

## Project: Code Archaeologist 🏺
**Hackathon:** IBM Dev Day Bob Hackathon  
**Team:** git happens (solo dev)  
**Deadline:** May 3, 2026 — 10:00 AM ET / 7:30 PM IST  
**Stack:** IBM Bob IDE + WatsonX (Granite) + MCP Server (Node.js)

## What This Is
A Bob-powered VS Code tool that helps developers understand and modernize legacy codebases through 3 parallel AI agents. It runs a 5-phase "excavation" workflow on any repo and produces an onboarding report, risk assessment, and modernization roadmap.

**Demo repo:** apache/struts1 (25-year-old frozen Java codebase)

## Key Documents — READ THESE
- `CODE_ARCHAEOLOGIST.md` — Living project doc (architecture, phases, constraints, submission requirements)
- `docs/IMPLEMENTATION_PLAN.md` — Detailed implementation plan (update after every phase)
- `docs/BUILD_LOG.md` — Running log of what was built, why, and how (append after every task)
- `docs/WALKTHROUGH.md` — Code walkthrough for judges and future developers
- `docs/OPTIMIZATIONS.md` — Performance decisions and tradeoffs
- `CLAUDE_CODE_PROMPTS.md` — Prompt reference (the human uses this to instruct you)

## Architecture (quick ref)
```
Bob IDE → MCP Server (stdio) → 3 Agent Tools → WatsonX Granite API
```

### 3 Active Agents
1. **Git Historian** — `git log` parsing, contributor analysis, bus factor
2. **Dependency Grapher** — `pom.xml` parsing, CVE flagging, risk scoring
3. **Docs Generator** — Synthesizes agent outputs into onboarding docs

### 5 Excavation Phases
1. Reconnaissance → repo structure scan
2. Historical Excavation → git historian runs
3. Semantic Mapping → (stubbed — "coming soon")
4. Risk Assessment → dependency grapher runs
5. Modernization Roadmap → docs generator synthesizes everything

## Constraints
- **Bobcoins:** 40 total for Bob IDE (no refills). Do NOT waste.
- **IBM Cloud credits:** $80 total. Account suspended at 100%.
- **NEVER** commit API keys. Use `.env` + `.gitignore`.

### WatsonX Model Rules (STRICT — confirmed by WatsonX team contact)
When writing ANY code that calls WatsonX, you MUST use:
- ✅ `ibm/granite-3-8b-instruct` — DEFAULT, confirmed working
- ✅ `ibm/granite-4-h-small` — Use if available on the platform (Granite 4 series is latest)
- ✅ Any other `granite` variant if explicitly told by the developer

**NEVER use these models — they are BANNED and will hurt judging:**
- ❌ `llama-3-405b-instruct`
- ❌ `mistral-medium-2505`
- ❌ `mistral-small-3-1-24b-instruct-2503`

**In code, always reference the model via an env variable or constant:**
```javascript
const DEFAULT_MODEL = process.env.WATSONX_MODEL || 'ibm/granite-3-8b-instruct';
```
Never hardcode a model ID directly in API call sites — always use the constant so it's easy to swap if the developer's WatsonX contact recommends a different Granite variant.

## Code Standards
- **Language:** Node.js (ES modules, modern syntax)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Transport:** stdio (Bob connects via stdio)
- **Style:** Clean, readable, well-commented — judges will read this code
- **Error handling:** Graceful fallbacks everywhere. If WatsonX is down, template strings take over.
- **Testing:** Manual test scripts in `test/`

## Git Rules
- **Do NOT add co-author trailers to commits.** No `Co-authored-by`, no `Signed-off-by` lines referencing Claude, Anthropic, or any AI. Commits should appear as solely authored by the developer.
- Write clear, concise commit messages in conventional commit style (e.g., `feat: add git historian agent`, `fix: handle missing pom.xml`)
- Commit frequently — small, logical commits over large dumps

## Claude Code Model Usage
Use the right model for the right task. Switch with `/model` in Claude Code.

### Quick commands
| Command | What it does |
|---|---|
| `/model` | Opens interactive model picker |
| `/model sonnet` | Switch to Sonnet (fast, everyday coding) |
| `/model opus` | Switch to Opus (complex reasoning) |
| `/model opusplan` | Opus plans, Sonnet executes — best of both |
| `Shift+Tab` | Toggle between Normal → Auto-Accept → Plan modes |
| `/cost` | Check token spend so far |
| `/compact` | Compress long chat to save context window |

### Which model when
- **Sonnet** — DEFAULT for most work. Scaffolding, boilerplate, file creation, test scripts, docs, simple edits. Fast and cheap.
- **Opus** — Complex tasks only. Tricky parsing logic, WatsonX integration, debugging weird issues, architecture decisions.
- **`opusplan`** — The sweet spot for this hackathon. Opus does the thinking/planning, then auto-switches to Sonnet for the actual code generation. Use this for anything multi-step.

### Recommended hackathon workflow
1. Start session: `/model opusplan`
2. Paste the Phase prompt from `CLAUDE_CODE_PROMPTS.md`
3. Let Opus plan, Sonnet build
4. For simple follow-up edits or doc updates: `/model sonnet`
5. Check spend periodically: `/cost`
6. Long session getting messy: `/compact` to compress context

## Documentation Requirements
After completing any task, you MUST:
1. **Append to `docs/BUILD_LOG.md`** — What you did, why, key decisions made
2. **Update `docs/IMPLEMENTATION_PLAN.md`** — Check off completed items, add notes
3. **Update `docs/WALKTHROUGH.md`** if you added new files or changed architecture
4. **Update `docs/OPTIMIZATIONS.md`** if you made any performance-related decisions

Use this format for BUILD_LOG entries:
```markdown
### [YYYY-MM-DD HH:MM] — Task Title
**What:** Brief description of what was done
**Why:** Rationale and context  
**How:** Key implementation details
**Files changed:** List of files created/modified
**Decisions:** Any design decisions and why
**Next:** What should be done next
```

## Project Structure
```
code-archaeologist/
├── CLAUDE.md                    ← You are here
├── CODE_ARCHAEOLOGIST.md        ← Living project doc
├── CLAUDE_CODE_PROMPTS.md       ← Prompt reference
├── src/
│   ├── index.js                 ← MCP server entry point
│   ├── tools/
│   │   ├── excavateRepo.js      ← Orchestrator
│   │   ├── gitHistorian.js      ← Agent 1
│   │   ├── dependencyGrapher.js ← Agent 2
│   │   └── docsGenerator.js     ← Agent 3
│   └── utils/
│       └── watsonx.js           ← WatsonX API client
├── test/
│   └── manual-test.js           ← Test runner
├── docs/
│   ├── IMPLEMENTATION_PLAN.md   ← Detailed plan (keep updated)
│   ├── BUILD_LOG.md             ← Running build diary
│   ├── WALKTHROUGH.md           ← Code walkthrough
│   └── OPTIMIZATIONS.md         ← Performance notes
├── bob_sessions/                ← Bob IDE session exports (for judging)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Working Style
- **Stub first, real later.** Get the shape right with hardcoded data, then swap in real logic.
- **Demo-driven.** Every decision should serve the 90-second demo moment.
- **Fail gracefully.** WatsonX might not be ready — always have a template fallback.
- **Document as you go.** The docs/ directory is a submission asset, not an afterthought.
