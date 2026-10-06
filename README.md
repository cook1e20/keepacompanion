# Keepa Companion

Chrome extension (MV3) adding three per-ASIN columns to the Keepa Product Finder:
**Track** (Checked / Bought / Near miss / Pass), **Searched** (age of the last manual
search), and **Gate** (UK listing restriction for our seller account, via SP-API).

Triage state lives in Supabase keyed by ASIN, so a verdict reached under one Product
Finder filter is still visible under the next one.

## Install

```bash
npm install
npm run build
```

Then `chrome://extensions` → Developer mode → **Load unpacked** → pick `dist/`.

Open the extension's options and enter the Supabase URL, anon key, and — for the Gate
column — the gating function secret. Nothing is bundled into the extension.

## Development

```bash
npm run watch       # rebuild on change; reload the extension to pick it up
npm test            # vitest
npm run typecheck   # tsc --noEmit
```

`CLAUDE.md` carries the design notes: how the ag-Grid interception works, why the
gating cache is a separate table from `ungate_log`, and what to re-check if Keepa ships
a new `grid.js`.
