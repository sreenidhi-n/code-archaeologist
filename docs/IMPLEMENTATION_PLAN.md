# 📋 Implementation Plan
### Code Archaeologist — Detailed Build Tracker
> **Last updated:** May 1, 2026  
> **Status:** Phase 1 — Not Started

---

## Phase 1: MCP Server Scaffold
> **Goal:** Full end-to-end flow with stubbed (hardcoded) data

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Init Node.js project, install MCP SDK | ✅ Done | Node 22, @modelcontextprotocol/sdk ^1.10.2 |
| 1.2 | Create MCP server entry point (stdio transport) | ✅ Done | `src/index.js` |
| 1.3 | Stub `excavate_repo` tool (orchestrator) | ✅ Done | Returns 5-phase response |
| 1.4 | Stub `git_historian` tool | ✅ Done | Realistic struts1 sample data |
| 1.5 | Stub `dependency_grapher` tool | ✅ Done | 4 real CVEs with CVSS scores |
| 1.6 | Stub `docs_generator` tool | ✅ Done | Full report + roadmap + heatmap |
| 1.7 | Create WatsonX utility placeholder | ✅ Done | Full impl, returns null without API key |
| 1.8 | Manual test script | ✅ Done | 23/23 tests passing |
| 1.9 | Bob MCP config | ✅ Done | `bob-mcp-config.json` — paste into Bob |
| 1.10 | Smoke test in Bob IDE | ⬜ Not started | Your turn — paste config, trigger excavate_repo |

**Phase 1 acceptance criteria:**
- [ ] Server starts and connects to Bob via stdio
- [x] All 4 tools callable and return valid JSON
- [x] Test script passes (23/23)
- [ ] Bob IDE can trigger excavation

---

## Phase 2: Git Historian Goes Real
> **Goal:** Real git history analysis on apache/struts1

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | `git log` parsing via child_process | ✅ Done | Streaming line-by-line |
| 2.2 | Top contributor extraction | ✅ Done | Name, count, % of total |
| 2.3 | Commit timeline (monthly frequency) | ✅ Done | Grouped into year-range periods |
| 2.4 | Bus factor calculation | ✅ Done | Correct: 4 for struts1 |
| 2.5 | "Engineer who left" detection | ✅ Done | lastActive date per contributor |
| 2.6 | High-churn file detection | ✅ Done | ActionServlet.java: 200 commits |
| 2.7 | Template narrative generation | ✅ Done | Fallback if no WatsonX |
| 2.8 | WatsonX narrative enhancement | ✅ Done | Granite 4 — 2.4s, dramatic prose |
| 2.9 | Test on apache/struts1 | ✅ Done | 5,272 commits, 29 contributors |

**Phase 2 acceptance criteria:**
- [ ] Returns real data from struts1 git history
- [ ] Bus factor and "who left" story are accurate
- [ ] Narrative reads well (template or AI)
- [ ] Completes in under 15 seconds

---

## Phase 3: Dependency Grapher Goes Real
> **Goal:** Real pom.xml analysis with CVE flagging

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Build system detection (Maven/Gradle/npm) | ✅ Done | Auto-detects pom.xml/build.gradle/package.json |
| 3.2 | pom.xml XML parsing | ✅ Done | Handles multi-module projects recursively |
| 3.3 | Dependency extraction (groupId, artifactId, version) | ✅ Done | 26 deps found in struts1 |
| 3.4 | Known CVE checklist (hardcoded) | ✅ Done | 8 entries covering major Java vulns |
| 3.5 | Version staleness heuristic | ✅ Done | isVersionBelow() semver comparison |
| 3.6 | Risk score calculation | ✅ Done | 10/10 for struts1 — accurate |
| 3.7 | Template risk narrative | ✅ Done | Fallback |
| 3.8 | WatsonX risk narrative | ✅ Done | Granite 4 — 1.5s |
| 3.9 | Test on apache/struts1 | ✅ Done | 7 CVEs flagged including 2x CVSS 9.8 |

**Phase 3 acceptance criteria:**
- [ ] Correctly parses struts1 pom.xml(s)
- [ ] Flags at least 2-3 real CVE-affected dependencies
- [ ] Risk score reflects actual state
- [ ] Completes in under 10 seconds

---

## Phase 4: Docs Generator + Report
> **Goal:** Synthesize all agent output into the excavation report

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Executive summary generation | ✅ Done | WatsonX — 3-5 sentences |
| 4.2 | Onboarding README generation | ✅ Done | Rich markdown template + real data |
| 4.3 | Modernization roadmap (prioritized) | ✅ Done | Built from actual CVE + churn data |
| 4.4 | Risk heatmap JSON | ✅ Done | Calculated from real scores |
| 4.5 | WatsonX prose generation | ✅ Done | Executive summary + where to start (parallel) |
| 4.6 | Template fallback prose | ✅ Done | Full fallbacks for all sections |
| 4.7 | Test end-to-end report | ✅ Done | All tests passing |

**Phase 4 acceptance criteria:**
- [ ] Report is comprehensive and reads professionally
- [ ] All sections populated with real data
- [ ] Works with and without WatsonX

---

## Phase 5: Integration + Polish
> **Goal:** Demo-ready, submission-ready

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Orchestrator chains all phases | ✅ Done | Phase 2+4 run in parallel |
| 5.2 | Error handling / graceful degradation | ✅ Done | Per-phase try/catch, status: 'error' |
| 5.3 | Performance: total excavation < 2 min | ✅ Done | 5.5s on struts1 |
| 5.4 | README.md for submission | ✅ Done | |
| 5.5 | Written problem/solution statement | ⬜ Not started | 500 words max |
| 5.6 | Written Bob+WatsonX usage statement | ⬜ Not started | |
| 5.7 | Export Bob session reports | ⬜ Not started | bob_sessions/ folder |
| 5.8 | Record demo video | ⬜ Not started | 3 min max |
| 5.9 | Final submission | ⬜ Not started | Before 10 AM ET May 3 |
| 5.10 | Live OSV CVE feed + offline fallback | ✅ Done | 13 CVEs on struts1 (vs 7 offline) |
| 5.11 | 💀 Knowledge Obituary feature | ✅ Done | Craig + Ted on struts1, 5 orphaned files each |
| 5.12 | 71-test suite | ✅ Done | Was 58, added 13 tests for OSV + obituary |
| 5.13 | Group A — Security hardening (A1-A3) | ✅ Done | escapeGitRegex, sanitizeFilename, XML entity hardening, test-security.js |
| 5.14 | Group B — Hygiene (B1-B5) | ✅ Done | OSV cache clear, input limits, no path leak, README fix, configurable timeouts |
| 5.15 | C5 — Blame analysis CVE cross-reference | ✅ Done | Import scanning + WatsonX advisories, 🚨 banner + report section |
| 5.16 | 91-test suite | ✅ Done | 79 comprehensive + 12 security |

---

## Dependency Chain
```
Phase 1 (scaffold) → Phase 2 (git historian)
                    → Phase 3 (dep grapher)    → Phase 4 (docs generator) → Phase 5 (polish)
                    
WatsonX API key ──────────────────────────────→ Unblocks all AI narratives
```

Phase 2 and 3 can run in parallel once Phase 1 is done. Phase 4 needs both 2 and 3 complete.
