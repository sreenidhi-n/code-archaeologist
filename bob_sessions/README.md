# Bob IDE Session Exports

This directory contains exported Bob IDE session reports demonstrating Code Archaeologist in action.

## Contents

Add exported Bob session markdown files and screenshots here:

- `session-struts1-excavation.md` — Full `excavate_repo` run on apache/struts1
- `session-struts1-screenshot.png` — Bob IDE panel showing phase progress and results
- `session-git-historian.md` — Standalone `git_historian` call result
- `session-dependency-grapher.md` — Standalone `dependency_grapher` call showing CVE detection

## How to Export from Bob

1. Open the Bob IDE session you want to export
2. Go to **Session → Export → Markdown**
3. Save the file to this directory
4. Commit with `git add bob_sessions/ && git commit -m "chore: add Bob session exports"`
