type: HITL
kind: feature

## Parent PRD

`issues/prd.md`

## Problem

Issue 002's Google button opens a new tab, which takes the operator off the Keepa page.
The ask (2026-10-08): Google results open beside Keepa, so the Product Finder stays in
view.

## Constraint that shapes the design

Google can't be embedded in the Keepa page or in an extension side panel. It sends
`X-Frame-Options` / `frame-ancestors` headers that block iframes, and stripping those
headers with `declarativeNetRequest` is fragile and against Google's terms. So the
results have to be a real browser window, not an in-page panel.

## What to build

- The Search button (issue 002) messages the service worker (MAIN world → content script →
  `chrome.runtime`, the existing bridge path), which opens Google in a **popup window
  docked to the right of the Keepa window**. Use `chrome.windows.create({ type: 'popup',
  url, left, top, width, height })`, sized from the Keepa window's own bounds
  (`chrome.windows.getCurrent`). No extra manifest permission is needed for
  `chrome.windows`.
- **Reuse one search window**: later clicks navigate the same popup
  (`chrome.tabs.update` on its tab) and focus it, rather than opening a new window each
  time. If the operator has closed it, open a fresh one.
- Optional setting (options page): "tile" mode, which also resizes the Keepa window to the
  left part of the screen so the two sit side by side. Default off.
- Keep the docking geometry in a pure function in `src/lib/` (screen width, Keepa bounds,
  preferred popup width → popup rect, and Keepa rect when tiling), with tests.
- The popup width and the tile setting are stored in `chrome.storage.local`, like the
  existing settings.

## Alternatives considered

- **Chrome side panel (`chrome.sidePanel`)**: it can only show extension pages, and Google
  still can't be iframed inside one. Ruled out.
- **Google Custom Search JSON API rendered in a side panel**: works inside the panel but
  needs an API key, has a 100 free queries/day cap, and the results are thinner than real
  Google. Not worth it unless the docked window proves annoying.

## Acceptance criteria

- [ ] Clicking Search opens or reuses a single Google popup docked beside Keepa; Keepa keeps
      its page and scroll position.
- [ ] Closing the popup and clicking again opens a new one in the same place.
- [ ] Tile mode (off by default) puts Keepa and Google side by side.
- [ ] Geometry is a pure, tested function; `npm test` and `npm run typecheck` pass.
- [ ] HITL: operator checks it on their real screen setup (single and dual monitor).

## Blocked by

Issue 002 (the Search button itself).
