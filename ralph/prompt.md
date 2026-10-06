# ISSUES

Local issue files from `issues/` are provided at start of context. Parse them to understand the open issues.

Each issue is labelled `type: AFK` (safe to run unattended) or `type: HITL` (needs a human in the loop). Work only on issues that fall within the RUN SCOPE stated at the very start of this prompt.

You've also been passed a file containing the last few commits. Review these to understand what work has been done.

If all in-scope tasks are complete, output <promise>NO MORE TASKS</promise>.

# TASK SELECTION

Pick the next task. Prioritize tasks in this order:

1. Critical bugfixes
2. Development infrastructure

Getting development infrastructure like tests and types and dev scripts ready is an important precursor to building features.

3. Tracer bullets for new features

Tracer bullets are small slices of functionality that go through all layers of the system, allowing you to test and validate your approach early. This helps in identifying potential issues and ensures that the overall architecture is sound before investing significant time in development.

TL;DR - build a tiny, end-to-end slice of the feature first, then expand it out.

4. Polish and quick wins
5. Refactors

# EXPLORATION

Explore the repo.

# IMPLEMENTATION

Use /tdd to complete the task.

# FEEDBACK LOOPS

Before committing, run the feedback loops:

- `npm run test` to run the tests
- `npm run typecheck` to run the type checker

# COMMIT

Make a git commit. The commit message must:

1. Include key decisions made
2. Include files changed
3. Blockers or notes for next iteration

# THE ISSUE

If the task is complete, move the issue file to `issues/done/`.

If the task is not complete, add a note to the issue file with what was done.

# RECAP

Before finishing, ask: did this iteration teach you something durable about the codebase
that isn't obvious from reading the code — architecture quirks, gotchas, where things
live, commands that behave unexpectedly? If so, record it briefly in `CLAUDE.md` and
commit that change. Future iterations start fresh; `CLAUDE.md` is how they start warm
instead of rediscovering what you just learned.

Do not log routine progress there — that belongs in the commit message.

`CLAUDE.md` is a cache of the code, not the source of truth. If anything you observed
this iteration contradicts a claim in `CLAUDE.md`, fix or delete that entry in the same
commit — a stale note misleads every future iteration.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
