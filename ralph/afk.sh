#!/bin/bash
set -eo pipefail

# Unattended ralph loop, sandboxed in Docker. Run from the project root:
#   ./ralph/afk.sh <iterations>
# Auth is either an exported ANTHROPIC_API_KEY or your mounted subscription login
# (run `claude` + /login first). Claude runs inside a container that can only see
# this directory (mounted at /work) and your credentials — not the rest of your
# machine. Works on macOS and Windows (via Git Bash / WSL) with Docker Desktop.

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Install Docker Desktop first (see ralph/README.md)." >&2
  exit 1
fi

# Auth: use the API key if explicitly exported, otherwise fall back to a mounted
# subscription login (~/.claude/.credentials.json, created by `claude` + /login).
# On macOS subscription creds live in the Keychain and can't be mounted, so use
# the API key there; on Windows (WSL) / Linux the credentials file mounts fine.
auth_args=()
if [ -n "$ANTHROPIC_API_KEY" ]; then
  auth_args=(-e ANTHROPIC_API_KEY)
  echo "Auth: ANTHROPIC_API_KEY (per-token API billing)"
elif [ -f "$HOME/.claude/.credentials.json" ]; then
  auth_args=(-v "$HOME/.claude:/root/.claude")
  echo "Auth: mounted ~/.claude subscription login"
else
  echo "No auth available. Either:" >&2
  echo "  - export ANTHROPIC_API_KEY (API billing), or" >&2
  echo "  - log in with your subscription: run 'claude' then /login, which creates" >&2
  echo "    ~/.claude/.credentials.json (works on Windows/WSL/Linux; not macOS Keychain)." >&2
  echo "See ralph/README.md." >&2
  exit 1
fi

IMAGE=ralph-sandbox

# Build the sandbox image once (rebuild by hand with: docker build -t ralph-sandbox -f ralph/Dockerfile ralph)
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building $IMAGE (first run only)..."
  docker build -t "$IMAGE" -f ralph/Dockerfile ralph
fi

# Mount host gitconfig read-only so commits carry your name/email, if present.
gitconfig_mount=()
if [ -f "$HOME/.gitconfig" ]; then
  gitconfig_mount=(-v "$HOME/.gitconfig:/root/.gitconfig:ro")
fi

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "result").result // empty'

tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

for ((i=1; i<=$1; i++)); do
  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  issues=$(cat issues/*.md 2>/dev/null || echo "No issues found")
  prompt=$(cat ralph/prompt.md)
  scope="RUN SCOPE: autonomous sandboxed run — work on AFK issues only, never HITL."

  docker run --rm -i \
    -v "$PWD:/work" -w /work \
    "${auth_args[@]}" \
    "${gitconfig_mount[@]}" \
    "$IMAGE" \
    claude \
      --dangerously-skip-permissions \
      --verbose \
      --print \
      --output-format stream-json \
      "$scope Previous commits: $commits Issues: $issues $prompt" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo "Ralph complete after $i iterations."
    exit 0
  fi
done
