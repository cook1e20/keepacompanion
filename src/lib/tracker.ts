import { TRACK_STATUSES, type TrackStatus, type TrackerRow } from './types.js';

export const STATUS_LABELS: Record<TrackStatus, string> = {
  checked: 'Checked',
  bought: 'Bought',
  near_miss: 'Near miss',
  pass: 'Pass',
};

/** Short button face — the Track column is ~132px wide. */
export const STATUS_SHORT: Record<TrackStatus, string> = {
  checked: 'Chk',
  bought: 'Buy',
  near_miss: 'Near',
  pass: 'Pass',
};

export function isTrackStatus(value: unknown): value is TrackStatus {
  return typeof value === 'string' && (TRACK_STATUSES as readonly string[]).includes(value);
}

/**
 * Clicking the status a row already holds clears it; clicking any other
 * status switches to it. Keeps the four buttons as a single toggle group.
 */
export function nextStatus(current: TrackStatus | null, clicked: TrackStatus): TrackStatus | null {
  return current === clicked ? null : clicked;
}

export function emptyRow(asin: string): TrackerRow {
  return { asin, status: null, status_at: null, last_searched_at: null };
}

const DAY_MS = 86_400_000;

/**
 * Compact age for the Searched column: "—", "today", "3d", "5w", "2y".
 * Weeks take over at a fortnight and years at 365 days, which keeps the
 * cell to five characters for any age this column can reach.
 */
export function formatAge(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';

  // A negative age means clock skew between this browser and Postgres,
  // not a future search.
  const days = Math.floor((now.getTime() - then) / DAY_MS);
  if (days <= 0) return 'today';
  if (days < 14) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 365)}y`;
}

/** Full timestamp for the cell tooltip. */
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return 'Never searched';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'Never searched';
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Later-wins merge so an optimistic local write is not undone by an in-flight fetch. */
export function mergeRows(existing: TrackerRow | undefined, incoming: TrackerRow): TrackerRow {
  if (!existing) return incoming;
  const pick = (a: string | null, b: string | null): boolean =>
    Date.parse(b ?? '') > Date.parse(a ?? '') || a === null;
  return {
    asin: incoming.asin,
    status: pick(existing.status_at, incoming.status_at) ? incoming.status : existing.status,
    status_at: pick(existing.status_at, incoming.status_at) ? incoming.status_at : existing.status_at,
    last_searched_at: pick(existing.last_searched_at, incoming.last_searched_at)
      ? incoming.last_searched_at
      : existing.last_searched_at,
  };
}
