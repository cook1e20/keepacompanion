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

- Clicking it opens a Google search for that row's product. Default query: the EAN if the
  row has one (most exact), else `brand + title`. Use `google.co.uk` with `gl=uk` so
  results are UK retailers.
- The click also stamps the existing **Searched** column for that ASIN (same write path
  as a product-link click), so "have I already looked at this?" stays accurate.
- First find out which fields Keepa's row data actually carries (`params.data`): title,
  brand, and especially whether an EAN list is present on Product Finder rows. Record
  the real field names in CLAUDE.md's "How the Keepa integration actually works" section
  before relying on them. Don't guess them.
- Build the query in a pure function in `src/lib/` with co-located tests (EAN preferred,
  title fallback, brand de-duplicated when the title already starts with it, length
  capped, URL-encoded).
- Opening the tab: `window.open` from the click handler (a user gesture) is enough for
  this issue. Issue 003 replaces it with a docked side window.

## Operator decisions

- EAN-first or title-first query, and whether a second button for **Google Shopping**
  (`tbm=shop`) is worth having.

## Acceptance criteria

- [ ] Search column appears pinned right and survives virtual scrolling, pagination and
      Keepa's `setColumnDefs` re-renders (same guarantees as the existing columns).
- [ ] Click opens a UK Google search for the row's product; EAN used when present.
- [ ] Click stamps Searched for that ASIN.
- [ ] Query builder is a pure, tested function; `npm test` and `npm run typecheck` pass.
- [ ] HITL: operator loads the unpacked build and checks a page of real rows.

## Blocked by

None.
