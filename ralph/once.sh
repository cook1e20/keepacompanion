#!/bin/bash

issues=$(cat issues/*.md 2>/dev/null || echo "No issues found")
commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
prompt=$(cat ralph/prompt.md)

scope="RUN SCOPE: interactive supervised run — you may work on any open issue, whether labelled AFK or HITL."

claude --permission-mode acceptEdits \
  "$scope Previous commits: $commits Issues: $issues $prompt"
