# Build Log — Keepa Companion

## 2026-09-19 — repo created, first vertical slice landed

Built the whole feature end to end in one session: extension, `asin_tracker` table,
and alchemist-v2's `gating-check` edge function.

**What was built**

- MV3 extension: MAIN-world bridge, isolated-world relay, service worker, options page.
- Three ag-Grid columns (Track / Searched / Gate), pinned right.
- `asin_tracker` (this repo) and `gating_status` (alchemist-v2) created live on the
  shared `A2ASearch` project; `gating-check` edge function deployed.
- 36 unit tests here, 19 more in alchemist-v2 for the edge function's pure logic.

**Key decisions**

- **Real ag-Grid columns, not DOM injection.** Keepa's finder is ag-Grid Enterprise
  21.1.0 with virtual scrolling (~14 of 100 rows in the DOM). DOM injection would fight
  virtualisation, pagination, resizing and Keepa's re-renders; column defs get all four
  for free.
- **Constructor interception over polling.** `gridOptions` is module-scoped in Keepa's
  `grid.js`, so the bridge installs a `window.agGrid` accessor at `document_start` and
  proxies `agGrid.Grid`. Polling for the global would race Keepa's promise-chained
  construction.
- **Wrap `api.setColumnDefs`** rather than listening for column events — every future
  Keepa call re-appends our columns, with no recursion guard needed.
- **esbuild, not Vite.** Three IIFE entry points is what Rollup multi-entry won't do
  without a plugin; MV3 content scripts can't be ES modules.
- **A separate `gating_status` table.** Reusing `ungate_log` looked right and is wrong —
  see the rejected-designs note below.
- **Gating requested per rendered row**, debounced and batched, because SP-API allows
  5 req/sec and a cold 100-row page would otherwise take ~20s.

**Explicitly rejected — do not re-propose**

- **Reusing `ungate_log` as the gating cache.** It is the auto-ungate *application* log
  (`approved | failed | no_link | error`, PK on `asin` alone, EU marketplaces only —
  live check found zero UK rows). Writing UK restriction checks into it would clobber
  the cooldown data `getRecentUngateAttempts()` depends on.
- **Routing gating through the `commands` queue.** Contract-pure, but the worker runs
  every 15 minutes, which makes a live column useless.
- **Storing tracker state in `chrome.storage`.** Kills the whole point: the state must
  survive a filter change and be the same on any machine.
- **Caching a failed gating check.** `gated: null` is "did not complete", never a
  verdict; an auth failure or throttle must be retried.

**Gotchas discovered**

- `ungate_log` is EU-only application bookkeeping, not a UK restriction cache (above).
- New tables in this Supabase project get **no** `service_role` grant by default, and
  Supabase's schema defaults hand anon/authenticated full privileges — both need to be
  stated explicitly in every migration.
- Keepa's `__ag_grid_instance` on the grid element is an **instance id number**, not the
  grid object — a dead end for getting at the API.
- Keepa assigns `gridOptions.onGridReady` *after* `new agGrid.Grid(...)`, so hooking it
  is unreliable; read `gridOptions.api` straight after construction instead.
- npm 10.9.0 on this machine cannot resolve vitest 4's peer graph
  (`Cannot read properties of null (reading 'edgesOut')`), reproducible in an empty
  directory. Pinned `legacy-peer-deps=true` in `.npmrc`.
- `en-GB` abbreviates September as "Sept", not "Sep" — caught by a test assertion.

**Verified**

- Harness reproducing Keepa's exact load pattern (dynamic ag-Grid `<script>` →
  `new agGrid.Grid`): columns inject, survive a full `setColumnDefs` replacement with no
  duplication, and the toggle/stamp/clear behaviour is correct and per-ASIN.
- Anon contract checked live with the real key: upsert works, a bad status is rejected
  by the CHECK, `gating_status` is `permission denied`, DELETE is 401.
- `gating-check` deployed and fails closed (500, no data) until its secrets are set.

## To do

- [ ] Set the `gating-check` edge function secrets (`LWA_APP_ID`, `LWA_CLIENT_SECRET`,
      `SP_API_REFRESH_TOKEN`, `SP_API_MERCHANT_ID`, `KC_SHARED_SECRET`) — the Gate
      column returns nothing until this is done.
- [ ] Load the unpacked extension and verify the three columns against the live Product
      Finder (the harness proves the mechanism; only a real page proves Keepa specifics).
- [ ] Decide whether Track/Searched should also appear on Product Viewer and Top Seller
      List, which are the same ag-Grid component on different element ids.
- [ ] Consider a "check gating for the whole page" toolbar button for deliberate bulk
      checks, rather than viewport-driven only.
- [ ] `note` column exists on `asin_tracker` but has no UI yet.
