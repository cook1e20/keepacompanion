import type { GatingRow } from './types.js';

const DAY_MS = 86_400_000;

export type GateBadge = { text: string; cls: string; title: string };

/**
 * A completed check is trusted for `ttlDays`. A failed check (`gated: null`)
 * is never fresh — SP-API auth failures and throttles must not stick.
 */
export function isFresh(row: GatingRow | undefined, now: Date, ttlDays: number): boolean {
  if (!row || row.gated === null) return false;
  const ms = Date.parse(row.checked_at);
  if (Number.isNaN(ms)) return false;
  return now.getTime() - ms < ttlDays * DAY_MS;
}

/**
 * Split the asins a viewport wants into those answerable from cache and
 * those needing an SP-API round trip. `pending` is excluded from `stale`
 * so a slow batch is never re-requested while still in flight.
 */
export function partitionAsins(
  asins: readonly string[],
  cache: ReadonlyMap<string, GatingRow>,
  pending: ReadonlySet<string>,
  now: Date,
  ttlDays: number,
): { cached: string[]; stale: string[] } {
  const cached: string[] = [];
  const stale: string[] = [];
  const seen = new Set<string>();

  for (const asin of asins) {
    if (seen.has(asin)) continue;
    seen.add(asin);
    if (isFresh(cache.get(asin), now, ttlDays)) cached.push(asin);
    else if (!pending.has(asin)) stale.push(asin);
  }
  return { cached, stale };
}

export function badgeFor(row: GatingRow | undefined): GateBadge {
  if (!row) return { text: '·', cls: 'kc-gate-unknown', title: 'Not checked yet' };
  if (row.gated === null) {
    return { text: '?', cls: 'kc-gate-error', title: row.reason_code ?? 'Check failed' };
  }
  if (row.gated) {
    return {
      text: 'GATED',
      cls: 'kc-gate-gated',
      title: `Gated${row.reason_code ? ` — ${row.reason_code}` : ''}`,
    };
  }
  return { text: 'OK', cls: 'kc-gate-open', title: 'Ungated — you can list this ASIN' };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new RangeError('chunk size must be >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
