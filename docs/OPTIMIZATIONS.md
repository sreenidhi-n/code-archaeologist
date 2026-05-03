# ⚡ Optimizations & Performance Notes
### Code Archaeologist — Technical Decisions & Tradeoffs
> Claude Code: update this whenever you make a performance-related decision.

---

## Performance Budget

The full excavation must complete in **under 2 minutes** on a standard laptop.
This is both a UX requirement (demo is 90 seconds) and a judging requirement (effectiveness/efficiency).

| Phase | Target Time | Notes |
|-------|-------------|-------|
| 1. Reconnaissance | < 5 seconds | Just file system scan |
| 2. Git Historian | < 30 seconds | Depends on repo size / git history |
| 3. Semantic Mapping | < 5 seconds | File walk + LOC sample + 1 WatsonX call |
| 4. Dependency Grapher | < 10 seconds | XML parsing + lookup |
| 5. Docs Generator | < 30 seconds | WatsonX API call |
| **Total** | **< 90 seconds** | |

---

## Decisions Log

### Git History: Stream vs Load-All
**Decision:** Streaming via `child_process.spawn` with line-by-line aggregation
**Tradeoff:** Loading full git log into memory is simpler but fails on large repos (struts1 has 25 years / 5,272 commits). Streaming processes each commit as it arrives and discards it, keeping memory flat regardless of repo size.
**Implementation:** `git log --format=%ae|%an|%ad --date=short` piped through a `data` event handler that accumulates a line buffer, splits on `\n`, and updates contributor + timeline maps in-place. 60-second SIGTERM timeout guards against hung git processes.

### WatsonX: Parallel vs Sequential Calls
**Decision:** Mixed — independent narratives run in parallel, synthesis runs after
**Tradeoff:** Making all WatsonX calls in parallel is fastest but Docs Generator needs both Phase 2 and Phase 4 results before it can run.
**Implementation:** Phase 2 (git narrative) and Phase 4 (dependency narrative) each call WatsonX independently and concurrently. Phase 5 (Docs Generator) waits for both, then fires 4 parallel operations: executive summary, where-to-start guide, high-risk file analysis, and C5 cross-reference (import scan + WatsonX advisories). Total: up to 6 WatsonX calls, structured to minimize wall-clock time.

### CVE Detection: Live OSV Feed with Offline Fallback
**Decision:** Live OSV feed (osv.dev) with offline fallback  
**Tradeoff:** OSV is free, no auth, returns 13 CVEs for struts1 vs 7 offline. Added 0.7s to Phase 4 (struts1). If OSV is unreachable, falls back to offline list instantly.  
**Implementation:** 26 parallel HTTP requests (one per dep), 5s per-request timeout, 10s overall timeout, in-memory cache (cleared between excavations). Parallel queries keep total OSV time under 2s even for large dependency trees.

### C5 CVE-Orphan Cross-Reference: Import Scanning Strategy
**Decision:** Two-stage matching — path matching first (fast), then import scanning (accurate)
**Tradeoff:** For third-party CVEs (commons-collections, log4j), source is never in the repo, so path matching produces zero results. Import scanning reads the first 80 lines of each orphaned file (import block only) and checks for `import {package}.*`. This catches real intersections (ActionServlet.java imports org.apache.commons.beanutils) without reading the whole file.
**Limits:** Top 5 orphaned files per obituary, first 80 lines per file. For struts1 with 2 obituaries (Craig, Ted) × 5 files × findFileByName fallback = <1s added to Phase 5. Files that can't be found on disk (pre-restructuring paths) are silently skipped.

### Template Fallback Strategy
**Decision:** Always implemented alongside WatsonX  
**Tradeoff:** Writing good templates takes time, but ensures the demo works even if WatsonX has issues. This is non-negotiable for a hackathon.  
**Recommendation:** Write templates first, WatsonX second. Templates are the floor, AI is the ceiling.

---

## Bobcoin Efficiency

Budget: 40 Bobcoins total. Every Bob IDE interaction costs coins.

**Strategy:**
- Do as much development as possible in Claude Code (free) before touching Bob
- Batch Bob interactions: don't ask Bob to "try this" — have tested code ready first
- Use Bob primarily for: MCP integration testing, final demo runs, session report exports
- Estimated Bob usage:
  - MCP setup/testing: ~8 coins
  - Demo dry runs: ~5 coins  
  - Polish/debugging: ~12 coins
  - Session exports: ~5 coins
  - Buffer: ~10 coins

---

## WatsonX Token Efficiency

Budget: $80 IBM Cloud credits. 1,000 tokens = 1 RU = $0.0001.

**Strategy:**
- Use `granite-3-8b-instruct` (smaller, cheaper, faster than larger variants)
- Keep prompts concise — under 500 tokens input where possible
- Set `max_new_tokens` to reasonable limits (200-500, not 1000+)
- Cache responses during development — don't re-call WatsonX for the same test data
- Build a "dry run" mode that uses templates instead of API calls for development

---

---

## OSV CVE Feed — Caching Strategy

OSV queries are cached in a module-level `Map` keyed by `name@version:ecosystem`.

**Why in-memory (not filesystem):** Each excavation run is a fresh process. Caching on disk would add I/O, cleanup concerns, and stale-data risks. In-memory is sufficient because the same package+version pair appears in both parent and submodule pom.xml files — the second hit is instant from cache.

**Two-tier timeout:** 5s per-request (`AbortController`) + 10s overall (`Promise.race`). The 5s per-request prevents any single slow OSV response from holding up the pool. The 10s overall ensures we fall back cleanly rather than waiting 5s × N in the worst case.

**Parallel queries:** 26 deps in struts1 → 26 concurrent HTTP requests → total OSV phase ~1.3s on good network. If OSV is unavailable, fallback to offline list adds ~0ms.

---

## Knowledge Obituary — Parallelism

All orphan-file checks for a contributor's top files run in `Promise.all` (~10 concurrent `git log` processes). Multiple departed contributors are also processed in parallel. For struts1 (2 contributors × 10 files = 20 concurrent git processes), total time: ~0.5s.

The WatsonX obituary calls run in the outer `Promise.all` alongside the narrative `generateText` call in `gitHistorian()`. Net latency added to Phase 2: near-zero, since the git log work overlaps with the WatsonX narrative call.

*Claude Code: add entries as you make performance-relevant decisions.*
