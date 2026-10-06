# Keepa Companion

Chrome extension (MV3) that adds three columns to the **Keepa Product Finder**:

| Column | What it does |
|---|---|
| **Track** | Four buttons — Checked / Bought / Near miss / Pass. One verdict per ASIN, with the date it was set. |
| **Searched** | Age of the last manual search for that ASIN ("3d", "5w"). Stamped automatically when you open the product from the grid, or by clicking the cell. |
| **Gate** | UK listing restriction for our seller account, via SP-API. `OK` / `GATED` / `?`. |

The point of storing this in Supabase rather than extension storage: **a verdict reached
under one Product Finder filter is still there under the next one.** Triage state is
per-ASIN and filter-agnostic by design.

## Sibling projects (one shared Supabase)

This repo is the fourth in the constellation coordinated from the root `../`
(AlchemistSuite) repo, alongside `../alchemist-v2`, `../DealFinder` and
`../Alchemist_Dashboard`. Cross-repo contracts — table ownership, the anon grant
surface, money units — are owned by **`../CONTRACTS.md`**. On a cross-repo contract,
CONTRACTS.md wins; on local implementation detail, this repo wins.

**This repo owns:** the extension, and the `asin_tracker` table.
**It must not:** hold SP-API credentials, or call SP-API directly. Gating answers come
only from `alchemist-v2`'s `gating-check` edge function, which owns those credentials
and the `gating_status` cache (CONTRACTS.md §3).

## How the Keepa integration actually works

This is the part worth knowing before changing anything.

- Keepa's Product Finder grid is **ag-Grid Enterprise 21.1.0** on `#grid-asin-finder`,
  and `grid.js` keeps its `gridOptions` in module scope — **nothing is exposed on
  `window`**, so there is no handle to grab.
- The only reliable seam is the constructor. `grid.js` loads ag-Grid via a dynamically
  injected `<script>` and then calls `new agGrid.Grid(el, gridOptions)`.
  `src/bridge/bridge.ts` installs an accessor on `window.agGrid` at `document_start`
  (MAIN world) so it intercepts that assignment, and proxies the constructor with a
  `construct` trap. **Use a Proxy, not a wrapper function** — ag-Grid's `Grid` may be an
  ES5 function or an ES2015 class depending on the bundle, and only a construct trap is
  safe for both.
- `gridOptions.api` is populated *during* construction, so the proxy reads it after
  `Reflect.construct` returns rather than relying on `onGridReady` (Keepa assigns its
  own `onGridReady` *after* the constructor call, so hooking it is unreliable).
- Columns are added as **real ag-Grid column definitions**, not DOM injected into rows.
  That is what makes them survive virtual scrolling (only ~14 of 100 rows are in the DOM
  at a time), pagination, column resizing, and Keepa's own re-renders. Injecting `<td>`s
  would fight all four.
- Keepa calls `setColumnDefs` whenever the user reconfigures columns, which would drop
  ours. The bridge **wraps `api.setColumnDefs`** so every future call re-appends them.
  No event listener, no recursion guard. Verified: replacing Keepa's entire column set
  keeps all three columns, with no duplication.
- The ASIN for a row is `params.data.asin` (Keepa's own row-data field; there is also a
  hideable `colId: "asin"` column). Product links are `#!product/<domainId>-<ASIN>`,
  which is how a click is traced back to an ASIN for the Searched stamp.
- MAIN-world scripts cannot reach `chrome.runtime`, so `src/content/content.ts` is a
  pure relay between the bridge (`window.postMessage`) and the service worker.

**Re-verify the grid assumptions if Keepa ships a new `grid.js`.** They are pinned to
a specific ag-Grid version and a specific element id; a Keepa rewrite is the most likely
way this breaks.

## Stack

esbuild + TypeScript (strict) + Vitest. **Not Vite**, deliberately: MV3 content scripts
are not ES modules, and a MAIN-world script must be one self-contained IIFE — three
separate IIFE entry points is exactly what Rollup's multi-entry code-splitting will not
do without a plugin. `build.mjs` is ~40 lines and has no plugin version risk.

```
npm run build      # dist/ — load this as an unpacked extension
npm run watch      # rebuild on change (reload the extension to pick it up)
npm test           # vitest
npm run typecheck  # tsc --noEmit
```

- `.npmrc` pins `legacy-peer-deps=true`. npm 10.9.0 on this machine dies with
  `Cannot read properties of null (reading 'edgesOut')` resolving vitest 4's peer graph
  — reproducible in an empty directory, so it is an arborist bug, not this project's
  tree. Remove it once npm is upgraded and a clean install succeeds without it.
- Pure logic lives in `src/lib/*.ts` with co-located `*.test.ts`. The bridge, content
  script, service worker and options page are deliberately untested — they are
  verified by loading the extension.

## Conventions

- **Tests are the feedback loop.** `npm test` and `npm run typecheck` must pass before
  commit.
- **No secrets in tracked files.** Supabase URL, anon key and the gating function secret
  are entered on the options page and live in `chrome.storage.local` — never bundled,
  never committed. Same rule the dashboard follows for its connection pill.
- **A failed gating check is never cached.** `gated: null` means the check did not
  complete (auth failure, throttle, HTTP error) and must be retried, never rendered as
  a verdict. Both `isFresh()` implementations — extension and edge function — encode
  this; keep them in step.
- **Status writes are optimistic**, then reconciled by `mergeRows` on a later-wins
  basis so an in-flight fetch cannot undo a click.

## Gotchas found while building

- **`ungate_log` is the wrong table for gating and must not be reused for it.** It is
  alchemist-v2's *auto-ungate application* log — `result` is
  `approved | failed | no_link | error`, the PK is `asin` alone, and its rows carry the
  EU marketplace a deal came from (live: de/es/it/fr only, zero UK rows). It answers
  "did we try to get ungated, and how did it go", not "is this ASIN gated for us now".
  Writing UK restriction checks into it would clobber the cooldown data
  `getRecentUngateAttempts()` depends on. Hence the separate `gating_status` table.
- **A new table gets nothing for `service_role` in this project** — there is no
  `pg_default_acl` entry supplying it, and Supabase's schema defaults hand *anon* and
  *authenticated* full privileges instead. Every new table needs both an explicit
  `grant … to service_role` and, for service-role-only tables, an explicit
  `revoke all … from anon, authenticated`. See alchemist-v2's CLAUDE.md (issue 019, G4
  pilot) for the two live outages this caused.
- **"Works locally" is not evidence the anon contract works.** The `asin_tracker` grants
  were verified live with the real anon key: upsert succeeds, an out-of-range status is
  rejected by the CHECK constraint, `gating_status` returns `permission denied`, and
  DELETE returns 401.
- **SP-API Listings Restrictions is 5 req/sec**, so a cold page of 100 ASINs would take
  ~20s if checked eagerly. Gating is therefore requested per *rendered* row — a cell
  renderer only exists for a row ag-Grid actually paints — debounced 150ms, and batched
  20 at a time. Scrolling never blocks on SP-API: the worker answers from cache at once
  and pushes the network batch in when it lands.

## Setup

1. `npm install && npm run build`
2. `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`
3. Extension options → Supabase URL, anon key, gating function secret
4. For the Gate column, set the edge function's secrets — see
   `../alchemist-v2/supabase/functions/gating-check/index.ts`.

## Agents

No project-specific subagents. Delegate to the built-in `Explore` and `general-purpose`
agents as needed.
