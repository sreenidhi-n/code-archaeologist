# Code Archaeologist — Problem & Solution Statement
**IBM Dev Day Bob Hackathon 2026 | Team: git happens (solo)**

---

## The Problem

Every software team eventually inherits a mystery codebase. The original authors have moved on. The documentation is years out of date. Dependencies haven't been updated since a different era of the industry. And somewhere in that repo — almost certainly — lives a critical security vulnerability that nobody knows about, because nobody knows the codebase well enough to look.

This is the legacy code onboarding problem, and it is universal. Industry studies consistently put the ramp-up time for a new developer on an unfamiliar codebase at **2–3 weeks** before they can make their first safe change. Most of that time isn't spent writing code — it's spent on archaeology: reading git history, chasing down CVE advisories, reverse-engineering the intentions of engineers who left years ago.

The worst part is that most of the answers already exist. They're in git log, in pom.xml, in commit author timestamps. The problem isn't that the information is gone — it's that nobody has automated the excavation.

---

## The Solution

**Code Archaeologist** is an IBM Bob IDE tool that runs a 5-phase automated excavation on any repository and returns a complete developer report in under 10 seconds.

**Phase 1 — Reconnaissance:** Scans the file tree to determine language, build system, file count, and project age. Runs in ~65ms.

**Phase 2 — Historical Excavation:** Streams `git log` to identify every contributor, calculate bus factor (how many engineers hold 50%+ of codebase knowledge), surface high-churn files, and detect departed contributors. Generates "Knowledge Obituaries" for key engineers who left — identifying the specific files they owned that have had zero commits since their departure.

**Phase 3 — Semantic Mapping:** Walks the repo to measure LOC distribution, test coverage ratio, directory depth, and largest files. Feeds real metrics to WatsonX Granite for a structural risk observation.

**Phase 4 — Risk Assessment:** Parses every pom.xml across all Maven submodules, queries the live OSV.dev CVE feed for each dependency in parallel, and calculates a 1–10 risk score. On the demo target (apache/struts1), it surfaces 13 CVEs — including two CVSS 9.8 remote code execution vulnerabilities.

**Phase 5 — Modernization Roadmap:** Synthesizes all prior results into a prioritized action plan. WatsonX Granite reads the actual source code of the highest-churn files to assess implicit knowledge risk. The C5 cross-reference engine finds files that are simultaneously CVE-affected and orphaned by departed contributors — the "perfect storm" of legacy debt — and generates urgent WatsonX advisories for each.

Output: two Markdown files written directly to the analyzed repo — `ONBOARDING.md` for new developers, and `EXCAVATION_REPORT.md` for security and architectural review.

---

## Real Results — apache/struts1

Running Code Archaeologist on a real 26-year-old abandoned Java codebase:

- **5,272 commits** parsed in 2.1 seconds
- **Bus factor: 4** — Craig R. McClanahan (18% of all commits) last active May 2006
- **13 CVEs** surfaced via live OSV feed, including CVE-2015-6420 (CVSS 9.8, RCE via deserialization) in `commons-collections:2.1`
- **C5 intersection found:** `ActionServlet.java` — orphaned by McClanahan, imports `org.apache.commons.beanutils`, CVE-flagged — WatsonX advisory generated automatically
- **Total excavation time: 8.4 seconds**

What used to take a developer 2–3 weeks now takes a single command.
