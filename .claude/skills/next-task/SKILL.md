---
name: next-task
description: Pick and complete the next open issue from issues/ in this session — one issue, implemented directly, then stop. Use when the user says "next task" or wants to work one issue. For working several issues in a row with coder/reviewer subagents, use /next-task-overseer instead.
---

# Next Task

Work exactly one issue from `issues/`, yourself, in this session. `/next-task-overseer`
reuses sections 2 and 3 of this file to pick its issues, so keep them self-contained.

## 1. Context check (do this first)

If this session already contains a completed `/next-task` iteration, or is otherwise
long with unrelated work, do NOT start. Tell the user:

> Context is carrying over from earlier work — run `/clear`, then `/next-task` again for
> a fresh iteration.

Only proceed in a long session if the user explicitly says to.

## 2. Gather context

Read these fresh — don't rely on stale context:

- `git log -n 5 --format="%H%n%ad%n%B---" --date=short` — recent work and notes left for
  this iteration.
- All files in `issues/*.md`. Files with no `type:` line (`spec.md`, `spec-*.md`) are
  specs: reference context, never tasks.
- `GLOSSARY.md` and `docs/adr/`, if they exist. Use the glossary's terms in code, tests
  and commit messages; respect ADRs in the area you're touching.

## 3. Pick the task

Skip any issue whose `## Blocked by` lists an issue still open in `issues/` — and check
the blocker's *stated reason* still holds against what was actually built, not just
whether its file moved to `done/`. Of the rest, pick in this order:

1. Critical bugfixes (`kind: bug` with `severity: critical` only — `major` and `minor`
   are tier 4)
2. Development infrastructure — tests, types and dev scripts come before features
3. Tracer bullets for new features — a tiny end-to-end slice first, then expand
4. Polish and quick wins (including `major` and `minor` bugs)
5. Refactors

If nothing is workable, say so and stop.

**`type: HITL` issues** have a human-gated step (a product or design call, creating an
account, setting env vars, anything outside the codebase). Build and test around it
freely, but stop and get an explicit go-ahead before doing the gated step itself.

## 4. Implement

Use `/tdd` at the seams named in the spec. For a bug issue use `/diagnosing-bugs`
instead: build a loop that goes red on the bug before touching code.

Once green, review your own diff and refactor anything you just made worse, re-running
the tests after each step. Bigger restructuring is a separate issue, not this one.

**Bugs spotted along the way:** don't fix them. Log one with the template and rules in
`.claude/skills/log-bug/SKILL.md`, mention it in the commit, and stay on your task.

## 5. Feedback loop

Before committing, the feedback loop must pass. Use the commands `CLAUDE.md` names; the
default is:

- `npm run test`
- `npm run typecheck` (skip if `package.json` has no `typecheck` script)
- `npm run build` if the task touched config, routes, or anything the deploy builds

## 6. Close out

- **Issue:** if complete, move it to `issues/done/` and tick its criteria. If not, add a
  dated note to the issue file saying what was done and what's left.
- **Recap:** if this iteration taught you something durable and non-obvious about the
  codebase (quirks, gotchas, where things live, commands that misbehave), record it
  briefly in `CLAUDE.md`. Fix or delete any `CLAUDE.md` entry you found to be wrong.
  Routine progress belongs in the commit message, not there.
- **Commit** (stage only this issue's paths — never `git add -A`), with: key decisions,
  files changed, blockers or notes for the next iteration, and any bugs logged.
- **Never `git push`.** Pushing deploys to production; the user ships with `/ship`.

ONLY WORK ON A SINGLE TASK. When done, remind the user to `/clear` before the next
`/next-task`.
