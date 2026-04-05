---
name: warm-up
description: Load project context into the conversation before substantial work — planning, coding, or reviewing.
---

# /warm-up

Front-load project understanding so subsequent tasks are faster and better informed. Run this before substantial work — skip it for quick questions.

## Steps

Execute in order. Maximize parallelism where noted.

### Step 1 — Load foundation (sequential, main context)

These go into YOUR context directly — you need them for all downstream work:

1. Following the instruction of the `./CLAUDE.md`, `./api/CLAUDE.md` and `./ui/CLAUDE.md` to read and load everything.
2. Read the specs/IDEA.md to capture the context of this project and also its mental model.

### Step 2 — Explore the codebase (parallel subagents)

Spawn parallel **Explore subagents** to map the codebase fast. Each returns a **concise summary** — not raw file contents. This keeps your main context lean.

### Step 3 — Synthesize and report

After all subagents return, produce a brief status report. This confirms warm-up is done and gives the user a chance to correct misunderstandings before real work begins.
