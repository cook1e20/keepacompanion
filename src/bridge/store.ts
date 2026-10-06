import { FROM_BRIDGE, FROM_CONTENT, type Envelope, type Request, type Response } from '../lib/messages.js';
import { emptyRow, mergeRows } from '../lib/tracker.js';
import type { GatingRow, TrackStatus, TrackerRow } from '../lib/types.js';

const PUSH_ID = 0;

let nextId = 1;
const waiting = new Map<number, (response: Response) => void>();

const trackerCache = new Map<string, TrackerRow>();
const gatingCache = new Map<string, GatingRow>();
const requestedTracker = new Set<string>();

type Repaint = (asins: ReadonlySet<string>) => void;
const repainters = new Set<Repaint>();

let lastError = '';

export function onRepaint(fn: Repaint): () => void {
  repainters.add(fn);
  return () => repainters.delete(fn);
}

function repaint(asins: ReadonlySet<string>): void {
  if (asins.size === 0) return;
  for (const fn of repainters) fn(asins);
}

export function trackerFor(asin: string): TrackerRow {
  return trackerCache.get(asin) ?? emptyRow(asin);
}

export function gatingFor(asin: string): GatingRow | undefined {
  return gatingCache.get(asin);
}

export function errorText(): string {
  return lastError;
}

function absorb(response: Response): void {
  if (response.kind === 'ERROR') {
    lastError = response.message;
    console.warn('[Keepa Companion]', response.message);
    return;
  }
  lastError = '';
  const touched = new Set<string>();
  if (response.kind === 'TRACKER_ROWS') {
    for (const row of response.rows) {
      trackerCache.set(row.asin, mergeRows(trackerCache.get(row.asin), row));
      touched.add(row.asin);
    }
  } else {
    for (const row of response.rows) {
      gatingCache.set(row.asin, row);
      touched.add(row.asin);
    }
  }
  repaint(touched);
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.source !== window) return;
  const envelope = event.data as Envelope<Response> | undefined;
  if (!envelope || envelope.source !== FROM_CONTENT) return;

  if (envelope.id === PUSH_ID) {
    absorb(envelope.payload);
    return;
  }
  const resolve = waiting.get(envelope.id);
  if (resolve) {
    waiting.delete(envelope.id);
    resolve(envelope.payload);
  }
});

function send(payload: Request): Promise<Response> {
  const id = nextId++;
  const envelope: Envelope<Request> = { source: FROM_BRIDGE, id, payload };
  return new Promise<Response>((resolve) => {
    waiting.set(id, resolve);
    window.postMessage(envelope, window.location.origin);
    // A dropped relay must not leak a pending entry forever.
    setTimeout(() => {
      if (waiting.delete(id)) resolve({ kind: 'ERROR', message: 'Extension did not respond' });
    }, 30_000);
  });
}

/** Tracker rows are fetched once per asin per page load; writes keep them current. */
export async function ensureTracker(asins: readonly string[]): Promise<void> {
  const wanted = asins.filter((asin) => !requestedTracker.has(asin));
  if (wanted.length === 0) return;
  for (const asin of wanted) requestedTracker.add(asin);
  absorb(await send({ kind: 'TRACKER_FETCH', asins: wanted }));
}

export async function ensureGating(asins: readonly string[]): Promise<void> {
  if (asins.length === 0) return;
  absorb(await send({ kind: 'GATING_FETCH', asins: [...asins] }));
}

export async function setStatus(asin: string, status: TrackStatus | null): Promise<void> {
  // Paint the click immediately; the server row replaces it when it lands.
  const optimistic: TrackerRow = {
    ...trackerFor(asin),
    status,
    status_at: status === null ? null : new Date().toISOString(),
  };
  trackerCache.set(asin, optimistic);
  repaint(new Set([asin]));
  absorb(await send({ kind: 'TRACKER_SET', asin, status }));
}

export async function stampSearched(asin: string): Promise<void> {
  const optimistic: TrackerRow = { ...trackerFor(asin), last_searched_at: new Date().toISOString() };
  trackerCache.set(asin, optimistic);
  repaint(new Set([asin]));
  absorb(await send({ kind: 'SEARCH_STAMP', asin }));
}
