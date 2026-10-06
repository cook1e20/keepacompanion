import { partitionAsins } from '../lib/gating.js';
import type { Request, Response } from '../lib/messages.js';
import { isGatingConfigured, isTrackerConfigured, loadSettings } from '../lib/settings.js';
import * as api from '../lib/supabase.js';
import type { GatingRow } from '../lib/types.js';

/**
 * Cross-tab gating cache. The service worker can be evicted between
 * requests — that only costs a re-read of the server-side `gating_status`
 * cache, never a duplicate SP-API call, so in-memory is enough.
 */
const gatingCache = new Map<string, GatingRow>();
const gatingPending = new Set<string>();

/** SP-API Listings Restrictions allows 5 rps; 20 asins is ~4s worst case. */
const GATING_BATCH = 20;

/**
 * Scrolling fires a GATING_FETCH per viewport, and each one used to start its
 * own network loop. The edge function paces itself internally, but nothing
 * paced the *invocations* — a few seconds of scrolling put a dozen of them in
 * flight at once and Amazon returned 429s. Chaining them means only one batch
 * is ever in flight, so the function's own spacing is the real rate again.
 */
let gatingChain: Promise<void> = Promise.resolve();

async function handle(request: Request, tabId: number | undefined): Promise<Response> {
  const settings = await loadSettings();

  if (!isTrackerConfigured(settings)) {
    return { kind: 'ERROR', message: 'Set the Supabase URL and anon key in the extension options.' };
  }

  switch (request.kind) {
    case 'TRACKER_FETCH':
      return { kind: 'TRACKER_ROWS', rows: await api.fetchTrackerRows(settings, request.asins) };

    case 'TRACKER_SET':
      return {
        kind: 'TRACKER_ROWS',
        rows: [await api.upsertStatus(settings, request.asin, request.status)],
      };

    case 'SEARCH_STAMP':
      return { kind: 'TRACKER_ROWS', rows: [await api.stampSearched(settings, request.asin)] };

    case 'GATING_FETCH': {
      if (!isGatingConfigured(settings)) {
        return { kind: 'ERROR', message: 'Set the gating function secret in the extension options.' };
      }
      const { cached, stale } = partitionAsins(
        request.asins, gatingCache, gatingPending, new Date(), settings.gatingTtlDays,
      );
      // Answer from cache at once and let the network batch land as a push,
      // so scrolling never waits on SP-API. Marking the stale asins pending
      // here, not inside the chained job, stops the next viewport queueing
      // the same asins again while this one waits its turn.
      if (stale.length > 0 && tabId !== undefined) {
        for (const asin of stale) gatingPending.add(asin);
        gatingChain = gatingChain.then(() => resolveStale(settings, stale, tabId));
      }
      return {
        kind: 'GATING_ROWS',
        rows: cached.map((asin) => gatingCache.get(asin)).filter((r): r is GatingRow => !!r),
      };
    }
  }
}

async function resolveStale(
  settings: Awaited<ReturnType<typeof loadSettings>>,
  stale: string[],
  tabId: number,
): Promise<void> {
  try {
    for (let i = 0; i < stale.length; i += GATING_BATCH) {
      const batch = stale.slice(i, i + GATING_BATCH);
      const rows = await api.fetchGating(settings, batch);
      for (const row of rows) gatingCache.set(row.asin, row);
      for (const asin of batch) gatingPending.delete(asin);
      push(tabId, { kind: 'GATING_ROWS', rows });
    }
  } catch (err) {
    for (const asin of stale) gatingPending.delete(asin);
    push(tabId, { kind: 'ERROR', message: `Gating check failed: ${message(err)}` });
  }
}

function push(tabId: number, response: Response): void {
  // The tab may have navigated away mid-batch; that rejection is not an error.
  void chrome.tabs.sendMessage(tabId, response).catch(() => undefined);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

chrome.runtime.onMessage.addListener((request: Request, sender, sendResponse) => {
  handle(request, sender.tab?.id)
    .then(sendResponse)
    .catch((err: unknown) => sendResponse({ kind: 'ERROR', message: message(err) } satisfies Response));
  return true; // keep the channel open for the async reply
});
