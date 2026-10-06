# Ralph — autonomous issue loop

Two ways to run Claude over the issues in `issues/`:

| Script | Mode | Sandbox | When |
|---|---|---|---|
| `once.sh` | interactive, `acceptEdits` | none (you approve edits) | supervised, quick runs |
| `afk.sh <N>` | unattended, N iterations | **Docker container** | walk-away runs |

`afk.sh` bypasses permission prompts, so it runs Claude inside a Docker container
that can only see this project directory and your API key — never the rest of your
machine. Same setup works on macOS and Windows.

## One-time setup

### 1. Install Docker Desktop
- **macOS / Windows:** https://www.docker.com/products/docker-desktop/
  (free for personal use; on Windows accept the WSL2 backend it offers).
- Verify: `docker --version`.

### 2. Authenticate — pick one

**Option A — Subscription login (uses your Claude plan, no API billing).**
Best on **Windows (WSL) / Linux**, where credentials are stored in a file that
mounts into the container.
```sh
claude          # then run /login and complete the browser OAuth once
```
This writes `~/.claude/.credentials.json`; `afk.sh` mounts it automatically. Not
available on macOS (subscription creds live in the Keychain, which can't be mounted
— use Option B there).

**Option B — API key (per-token API billing, works everywhere incl. macOS).**
- Create one at https://console.anthropic.com/ → API Keys.
- Export it (add to your shell profile so it persists):
  ```sh
  export ANTHROPIC_API_KEY=sk-ant-...
  ```

`afk.sh` uses `ANTHROPIC_API_KEY` if it's set, otherwise the mounted subscription
login. On Windows, run `afk.sh` from **Git Bash** or **WSL**.

The sandbox image builds automatically on first run (rebuild manually with
`docker build -t ralph-sandbox -f ralph/Dockerfile ralph`).

## Run

```sh
# from the project root
./ralph/once.sh          # supervised
./ralph/afk.sh 10        # 10 unattended iterations, sandboxed
```

`afk.sh` stops early if Claude reports `<promise>NO MORE TASKS</promise>`.

## What the sandbox does and doesn't do

- **Isolates the filesystem:** the container only mounts this project at `/work`.
  A bad command can't touch other repos, your home dir, or system files.
- **Isolates secrets:** only your Anthropic auth (`ANTHROPIC_API_KEY`, or a mounted
  `~/.claude` for subscription login) and your read-only `.gitconfig` cross into the
  container. Host SSH keys, cloud creds, browser sessions stay out.
- **Does not block the network.** The container reaches the Anthropic API over the
  default network. If you want to lock egress down to only the API, that's a further
  step (custom Docker network + firewall) not set up here.

## Rate limits on long unattended runs

A many-iteration `afk.sh N` run can exhaust your plan's usage window (especially on a
subscription login). When that happens Claude just stalls or errors on the affected
iterations — it won't corrupt anything, and completed iterations are already committed.
Prefer smaller batches (e.g. `afk.sh 5`) and re-run once your limit resets, rather than
one huge run. On an API key the same work keeps going but bills per token, so watch
spend on long runs.
