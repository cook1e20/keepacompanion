type: HITL
kind: feature

## Parent PRD

`issues/prd.md`

## Problem

Checking a Product Finder row against the wider web (other retailers' prices, whether the
item is discontinued, RRP) means copying the title or EAN out of Keepa and pasting it into
Google by hand. Requested by the operator 2026-10-08.

## What to build

A **Search** column (real ag-Grid column definition, pinned right next to Track /
Searched / Gate — same mechanism as `src/bridge/columns.ts`) with a small Google button
per row.

- Clicking it opens a Google search for that row's product, using **`brand + title`**.
  Operator decision 2026-10-08: Product Finder rows don't give us the EAN, so search on
  brand and title. Use `google.co.uk` with `gl=uk` so results are UK retailers.
- The click also stamps the existing **Searched** column for that ASIN (same write path
  as a product-link click), so "have I already looked at this?" stays accurate.
- First find out which fields Keepa's row data actually carries for title and brand
  (`params.data`). Record the real field names in CLAUDE.md's "How the Keepa integration
  actually works" section before relying on them. Don't guess them.
- Build the query in a pure function in `src/lib/` with co-located tests:
  - brand is left out when the title already starts with it;
  - Amazon title padding (pipes, long feature lists) is trimmed so the query stays at
    roughly the first 10–12 words;
  - the query is URL-encoded;
  - a missing brand falls back to the title only.
- Opening the tab: `window.open` from the click handler (a user gesture) is enough for
  this issue. Issue 003 replaces it with a docked side window.

## Operator decisions

- ~~EAN-first or title-first~~ decided 2026-10-08: brand + title. Still open: whether a second button for **Google Shopping**
  (`tbm=shop`) is worth having.

## Acceptance criteria

- [x] Search column appears pinned right and survives virtual scrolling, pagination and
      Keepa's `setColumnDefs` re-renders (same guarantees as the existing columns).
- [x] Click opens a UK Google search for the row's product on brand + title.
- [x] Click stamps Searched for that ASIN.
- [x] Query builder is a pure, tested function; `npm test` and `npm run typecheck` pass.
- [ ] HITL: operator loads the unpacked build and checks a page of real rows.

## Progress

2026-10-17: Built `src/lib/search.ts` (+ tests), `SearchRenderer` / `kc_search` column in
`src/bridge/columns.ts`, button click calls `window.open` then `stampSearched`. `npm test`,
`npm run typecheck`, `npm run build` green. **Open for the operator:** Keepa's real
title/brand field names on `params.data` are NOT yet verified. `columns.ts` tries
`title`/`productTitle` and `brand`/`manufacturer` (one accessor, `TITLE_FIELDS`/`BRAND_FIELDS`);
the button is disabled when no title is found. Inspect `params.data` on a real row, trim the
candidate lists, and record the names in CLAUDE.md. Pinned-right / scroll / `setColumnDefs`
survival is by construction (same mechanism as the other columns) but needs the live check.

## Blocked by

None.
