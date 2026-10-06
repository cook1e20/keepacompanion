type: HITL

## Parent PRD

`issues/prd.md`

## What to build

The whole first vertical slice: an MV3 extension that adds the Track, Searched and Gate
columns to the Keepa Product Finder, the `asin_tracker` table behind the first two, and
the `gating-check` edge function (in `../alchemist-v2`, which owns SP-API) behind the
third.

Columns must be real ag-Grid column definitions injected via the grid's own API, so they
survive virtual scrolling, pagination, column resizing and Keepa's re-renders. Gating
must be requested per rendered row rather than per page, because SP-API allows 5 req/sec.

Credentials are entered on an options page and stored in `chrome.storage.local` — never
bundled, never committed.

## Acceptance criteria

- [x] `npm run build` produces a loadable unpacked extension; `npm test` and
      `npm run typecheck` pass
- [x] Three columns appear pinned right on the Product Finder grid
- [x] Track: four buttons, one status at a time, clicking the held status clears it,
      date recorded
- [x] Searched: shows age, stamped by a product-link click and by clicking the cell
- [x] Gate: OK / GATED / ? from SP-API via the edge function, cached in `gating_status`
- [x] State is keyed by ASIN and survives a filter change
- [x] Columns survive Keepa replacing its own column set (verified in a harness)
- [x] `asin_tracker` migration with explicit anon *and* service_role grants; anon
      contract verified live against the real key
- [x] `gating_status` is service-role only; anon gets `permission denied`
- [x] A failed gating check is never cached as a verdict
- [x] No secrets in tracked files or in `dist/`
- [ ] Verified against the live Product Finder with the extension loaded — **pending**,
      needs the operator to load the unpacked extension and set the function secrets

## Blocked by

None.

## User stories addressed

- User stories 1-5
