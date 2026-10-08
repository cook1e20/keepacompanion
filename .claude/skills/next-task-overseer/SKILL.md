---
name: next-task-overseer
description: Take over the session as overseer and work the issues/ queue issue after issue — delegating implementation to the coder subagent (Sonnet) and QA to the reviewer subagent (Opus) — until a blocker needs the user. Use when the user wants several issues worked in a row. For a single issue done directly, use /next-task.
effort: medium
---

# Next Task — overseer

You are now the **overseer** for this session. You hold the context and make the
decisions; subagents do the heavy lifting. Work the queue issue after issue until you hit
a blocker that needs the user, then stop and ask.

## Your team

- **`coder`** (Sonnet) — implements one issue test-first, runs the feedback loop, never
  commits. Also use it for smaller self-contained jobs: a spike, a failing-test repro, a
  doc update, a bug write-up.
- **`reviewer`** (Opus, high effort) — read-only QA of uncommitted work against the issue
  and conventions; returns `VERDICT: APPROVE` or `CHANGES_REQUESTED` with numbered
  blocking findings.
- **`Explore`** — read-only sweeps when you need a fact from across many files.

Keep your own context lean: delegate reading and coding, keep the decisions. Subagents
start cold, so every brief must be self-contained.

## 1. Pick the next issue

Follow sections 2 and 3 of `.claude/skills/next-task/SKILL.md` (gather context, pick the
task) — read it fresh each time, along with the chosen issue in full.

## 2. Pre-flight

- `git status --porcelain` — record dirty paths as the **baseline**. That is someone
  else's in-flight work: never stage, edit, revert or stash it. If it overlaps the
  issue's files, that's a blocker — ask the user.
- **`type: HITL` issues:** build/test work around the gated step can proceed. The gated
  step itself (a decision, account creation, env var, migration apply, anything live) is
  a blocker: stop and ask for an explicit go-ahead.

Standing safety rules (pass them on in every brief): no `git push` (pushing deploys), no
history rewrites, no applying migrations or live DB writes, no committing `.env` or
credentials — all of these need the user.

## 3. Delegate the build

Brief the `coder` with: the issue path, its acceptance criteria **quoted verbatim**, the
feedback-loop commands (those `CLAUDE.md` names; default `npm run test`, plus
`npm run typecheck` where `package.json` has it and `npm run build` if it touches
config/routes/the deploy), the relevant `CLAUDE.md` rules, glossary terms and
ADRs **quoted, not pointed at**, the baseline paths to leave alone, what is out of
scope, and the safety rules. For a bug issue, tell it to use `/diagnosing-bugs` (red loop
first). For large issues, split into slices and brief one at a time.

## 4. QA — route by risk

The test suite proves the code does what the coder intended; review proves that's what
the issue asked for. The reviewer is the only QA beyond the tests, so spend it where a
miss is expensive:

- **Always review:** money/pricing/billing logic, auth and permissions, data migrations
  or schema changes, anything that writes or deletes user data, and anything touching
  what the `CLAUDE.md` flags as critical.
- **Overseer reads the diff instead:** UI-only, plumbing/wiring, refactors with no
  behaviour change, docs, and mechanical changes. Read the full diff plus the tests
  added; if anything looks off, escalate to the reviewer.
- **When unsure, review.**

Reviewer brief: issue, acceptance criteria, conventions, baseline paths, and the coder's
report. On `CHANGES_REQUESTED`, pass the blocking findings verbatim back to the coder
(SendMessage to the same coder if still available), then re-review. Up to 3 rounds. You
arbitrate: overrule a finding that contradicts the issue or a documented convention, and
record why in the commit. If it won't converge after 3 rounds, that's a blocker.

## 5. Land it

1. Run the feedback loop yourself — don't trust reported results.
2. Stage **only** this issue's paths (never `git add -A` / `git add .`): the change, the
   issue's move to `issues/done/` (or its progress note), any bug issues logged, and any
   `CLAUDE.md` recap.
3. Commit with key decisions, files changed, review rounds and overruled findings,
   blockers or notes for next time, and any bugs logged.

Then give the user a one-paragraph status line and **go straight back to step 1**.

## 6. When to stop

Stop and ask the user — clearly stating what you need and your recommendation — when:

- a HITL gate is reached;
- the tree is dirty in a way that overlaps the work;
- review won't converge, or the feedback loop can't be made green;
- nothing unblocked is left in `issues/`.

If an issue is blocked but others below it are workable, add a dated `blocked: <reason>`
note to the issue, mention it, and move on.

If your own context is getting heavy, say so at the end of an issue and suggest `/clear`
then `/next-task-overseer` to resume with a fresh overseer.
