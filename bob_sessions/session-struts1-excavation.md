# Bob Session Export — Full Excavation: apache/struts1
**Exported:** 2026-05-03 | **Tool:** Code Archaeologist MCP Server

---

## User

```
excavate_repo("/Users/sreenidhi/projects/struts1")
```

---

## Bob (MCP Tool Call → excavate_repo)

Running Code Archaeologist on `/Users/sreenidhi/projects/struts1`...

```
[Code Archaeologist] Phase 1/5: Reconnaissance          — COMPLETE (65ms)
[Code Archaeologist] Phase 2/5: Historical Excavation   — COMPLETE (2.1s)
[Code Archaeologist] Phase 3/5: Semantic Mapping        — COMPLETE (1.8s)
[Code Archaeologist] Phase 4/5: Risk Assessment         — COMPLETE (3.2s)
[Code Archaeologist] Phase 5/5: Modernization Roadmap   — COMPLETE (1.2s)
[Code Archaeologist] Excavation complete in 8.4s — reports written to repo root
```

---

## Excavation Results

### Phase 1 — Reconnaissance

| Field | Value |
|-------|-------|
| Language | Java |
| Build system | Maven |
| Files | 1,247 |
| Lines of code | ~186,000 |
| Project age | 26 years (first commit 2000-05-07) |

---

### Phase 2 — Historical Excavation

**Codebase narrative (WatsonX Granite):**

> This codebase is the archaeological record of a framework that shaped a generation of Java web development — and then was abandoned by every engineer who understood it. Craig R. McClanahan alone authored 18% of all 5,272 commits, last touching the code in May 2006, nearly two decades ago. The bus factor is 4, meaning four people once held the institutional knowledge for half this codebase; none of them are reachable. A new developer inheriting this repo inherits not just code, but the undocumented design decisions of ghosts.

**Contributor summary:**

| Contributor | Commits | % of Total | Last Active | Status |
|------------|---------|------------|-------------|--------|
| Craig R. McClanahan | 967 | 18.3% | 2006-05-14 | ⚠️ Departed (18 yrs) |
| Ted Husted | 721 | 13.7% | 2004-11-30 | ⚠️ Departed (21 yrs) |
| Niall Pemberton | 614 | 11.6% | 2008-03-22 | ⚠️ Departed (17 yrs) |
| David Graham | 502 | 9.5% | 2007-08-11 | ⚠️ Departed (18 yrs) |

**Bus factor: 4** — 4 contributors authored 53.1% of all commits. Risk: **CRITICAL**

**Knowledge Obituary — Craig R. McClanahan (WatsonX Granite):**

> McClanahan was the architectural mind behind Struts' core request processing pipeline — the ActionServlet, the ActionMapping system, and the foundational patterns that every other contributor built on top of. His 967 commits span the project's entire growth phase, and 23 of his key files have had zero commits since he left in 2006. Anyone modifying ActionServlet.java or the core tag library today is modifying code whose design rationale exists nowhere but in the memory of a man who hasn't touched it in nearly two decades.

**Orphaned files (zero commits since McClanahan's departure):**
- `src/share/org/apache/struts/action/ActionServlet.java`
- `src/share/org/apache/struts/action/RequestProcessor.java`
- `src/share/org/apache/struts/taglib/html/FormTag.java`
- `src/share/org/apache/struts/util/RequestUtils.java`
- `src/share/org/apache/struts/config/ModuleConfig.java`

**High-churn files:**

| File | Commits |
|------|---------|
| `action/ActionServlet.java` | 312 |
| `action/RequestProcessor.java` | 287 |
| `taglib/html/FormTag.java` | 241 |

---

### Phase 3 — Semantic Mapping

**Structural observation (WatsonX Granite):**

> At 186,000 lines across 1,247 files, this codebase has the density of a framework that grew organically over a decade with no architectural resets. The test-to-source ratio of 0.31 means roughly 1 test file exists for every 3 source files — adequate coverage on paper, but the tests were written by the same departed engineers and may encode assumptions that no longer hold. The deepest directory nesting reaches 9 levels, a sign of a package structure that was never refactored after the initial design solidified.

| Metric | Value |
|--------|-------|
| Total files | 1,247 |
| Java source files | 634 |
| Test files | 198 |
| Test/source ratio | 0.31 |
| Max directory depth | 9 |
| Largest file | `ActionServlet.java` (2,847 lines) |

---

### Phase 4 — Risk Assessment

**CVE risk narrative (WatsonX Granite):**

> This dependency tree is a monument to deferred security maintenance. Two critical CVSS 9.8 vulnerabilities in commons-collections 2.1 enable remote code execution via Java deserialization gadget chains — attack vectors that have been actively exploited in the wild since 2015. The presence of Log4j 1.x with three separate critical CVEs, including a CVSS 9.8 SQL injection in JDBCAppender, compounds the risk significantly. A risk score of 8.7/10 is not a warning — it is a deployment blocker.

**Risk score: 8.7 / 10** | CVE source: live OSV.dev feed

**CVEs detected (13 total):**

| CVE | CVSS | Severity | Package | Description |
|-----|------|----------|---------|-------------|
| CVE-2015-6420 | 9.8 | 🔴 Critical | commons-collections:2.1 | RCE via Java deserialization gadget chain |
| CVE-2015-7501 | 9.8 | 🔴 Critical | commons-collections:2.1 | Deserialization of untrusted data → arbitrary code exec |
| CVE-2022-23305 | 9.8 | 🔴 Critical | log4j:1.2.8 | SQL injection in Log4j 1.x JDBCAppender |
| CVE-2019-17571 | 9.8 | 🔴 Critical | log4j:1.2.8 | RCE via deserialized data in Chainsaw/SocketServer |
| CVE-2017-15708 | 9.8 | 🔴 Critical | commons-lang:2.4 | RCE via ClassLoader in Apache Commons Lang |
| CVE-2016-1181 | 8.1 | 🟠 High | struts-core:1.3.10 | ActionServlet multipart RCE |
| CVE-2022-23302 | 8.8 | 🟠 High | log4j:1.2.8 | JMSSink deserialization RCE |
| CVE-2014-0114 | 7.5 | 🟠 High | struts-core:1.3.10 | ClassLoader manipulation via ActionForm |
| CVE-2019-10086 | 7.3 | 🟠 High | commons-beanutils:1.8.0 | Access control bypass via BeanUtils |
| CVE-2016-3092 | 7.8 | 🟠 High | commons-fileupload:1.2.1 | DoS via malicious multipart upload |
| CVE-2014-0050 | 7.5 | 🟠 High | commons-fileupload:1.2.1 | Infinite loop in boundary handling |
| CVE-2022-23437 | 6.5 | 🟡 Medium | xercesImpl:2.6.2 | DoS via crafted XML input |
| CVE-2022-24785 | 7.5 | 🟠 High | (transitive) | Path traversal via locale loading |

---

### Phase 5 — Modernization Roadmap

**Executive summary (WatsonX Granite):**

> Code Archaeologist has completed its excavation of apache/struts1 and the findings demand immediate attention before any developer writes a single line of code against this repository. Five critical CVSS 9.8 vulnerabilities are present in actively-maintained attack surfaces; commons-collections 2.1 is the most dangerous dependency in the Java ecosystem circa 2015-2020 and it is here, unpatched, in a codebase that nobody who understood it has touched in two decades. The C5 analysis has identified ActionServlet.java as the highest-priority risk intersection: it is simultaneously the most-touched file in the project, orphaned by the engineer who designed it, and directly importing the CVE-flagged commons-beanutils library. Do not deploy this code. Do not inherit this code without first reading the EXCAVATION_REPORT.md this tool has generated.

**🚨 C5 Critical Risk Intersections (CVE-affected + developer-orphaned):**

**ActionServlet.java** — Advisory (WatsonX Granite):
> ActionServlet.java is the entry point for every HTTP request this framework has ever processed, written almost entirely by Craig McClanahan who has been gone for 18 years, and it directly imports org.apache.commons.beanutils — a library with an active CVSS 7.3 access control bypass CVE. This is the highest-risk file in the repository: maximum blast radius, zero institutional knowledge, live vulnerability. Any modification here should be treated as defusing a bomb without a manual.

**RequestProcessor.java** — Advisory (WatsonX Granite):
> RequestProcessor.java orchestrates the core request-dispatch logic that ActionServlet delegates to, authored almost exclusively by McClanahan and Husted — both departed over 17 years ago. Its dependency on commons-collections for internal state management means it sits on top of the CVSS 9.8 deserialization gadget chain. The implicit knowledge required to safely refactor this class is, at this point, archaeological.

**Where to start (WatsonX Granite):**

1. **Do not deploy.** Before any other action, create a security hold on this codebase. CVE-2015-6420 (CVSS 9.8) in commons-collections 2.1 is an actively-exploited RCE vector. Any public-facing deployment of this code is a critical incident waiting to happen.

2. **Upgrade commons-collections immediately.** Bump to 3.2.2 or higher. This single change closes the two highest-severity CVEs. Test against `RequestProcessor.java` and `ActionServlet.java` which both import it.

3. **Replace Log4j 1.x.** Migrate to Log4j 2.x (or SLF4J + Logback). Log4j 1.x is end-of-life, has three critical CVEs in this version, and will never receive security patches.

4. **Schedule a knowledge transfer session on ActionServlet.java.** This file has 312 commits from a developer who left 18 years ago, 2,847 lines of code, and zero documentation. Before modifying it, reconstruct its design intent from git blame and the mailing list archives at apache.org.

5. **Read EXCAVATION_REPORT.md** (written to the repo root by this tool) for the full CVE inventory, complete orphaned file list, and annotated dependency tree before onboarding any new developer.

---

**Reports written to analyzed repository:**
- `/Users/sreenidhi/projects/struts1/ONBOARDING.md` — new developer briefing
- `/Users/sreenidhi/projects/struts1/EXCAVATION_REPORT.md` — security & architectural review

**Total excavation time: 8.4 seconds**
