# PRD — Keepa Companion

## Problem

Product Finder research is repetitive and lossy. Scanning a filter produces a page of
100 ASINs; a handful get looked at properly, most get passed over. Change the filter and
all of that judgement is gone — the same ASINs come back looking untouched, and the same
ones get re-researched weeks later. Nothing records "I already looked at this", "I
bought this", or "this was close but not quite".

Separately, gating is only discovered at the end: an ASIN clears every numeric filter,
gets researched, and only then turns out to be restricted for our account.

## Users

One — the operator. Single-user tool, single Amazon UK seller account.

## What it does

Three columns on the Keepa Product Finder grid, all keyed by ASIN so they persist across
filter changes:

1. **Track** — Checked / Bought / Near miss / Pass, one at a time, with the date set.
   Clicking the held status clears it.
2. **Searched** — how long ago this ASIN was last manually researched. Stamped
   automatically when the product is opened from the grid, and by clicking the cell.
3. **Gate** — is this ASIN restricted for our seller account in the UK?

## User stories

1. As the operator, I mark an ASIN "Pass" so that when it reappears under a different
   filter I can skip it instantly.
2. As the operator, I see that I last researched an ASIN 3 days ago, so I do not repeat
   the work.
3. As the operator, I see an ASIN is gated before spending research time on it.
4. As the operator, I mark an ASIN "Bought" so the finder doubles as a record of what
   was actually acted on.
5. As the operator, my triage survives a browser restart and a filter change, because it
   is stored server-side rather than in the browser.

## Constraints

- **The browser never holds SP-API credentials** and never calls SP-API directly
  (`../CONTRACTS.md` §3). Gating goes through an edge function owned by `alchemist-v2`.
- **SP-API Listings Restrictions allows 5 req/sec.** Gating must not be requested
  eagerly for a whole 100-row page.
- **No secrets in the repo or the bundle.** Credentials are entered in the extension's
  options page.
- The feature rides on Keepa's own grid, which we do not control and which can change.

## Out of scope for v1

- Product Viewer, Top Seller List, and the other Keepa grids.
- Free-text notes (the `note` column exists, unused).
- Any write to `products`, `deals`, or any other repo's tables.
- Bulk/batch gating checks initiated by the operator.

## Implementation decisions

- Real ag-Grid column definitions, not DOM injection — see `CLAUDE.md`.
- A dedicated `gating_status` cache table, **not** `ungate_log`, which is a different
  concern entirely (see `BUILD_LOG.md`, rejected designs).
- Viewport-driven, debounced, batched gating requests; cache answers immediately and
  push network results in when they land.
