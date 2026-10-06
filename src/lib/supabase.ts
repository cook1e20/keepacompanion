import { chunk } from './gating.js';
import type { GatingRow, Settings, TrackStatus, TrackerRow } from './types.js';

/**
 * Hand-rolled PostgREST calls rather than @supabase/supabase-js — the
 * extension needs three endpoints and the SDK would dominate the bundle.
 */
function headers(s: Settings): HeadersInit {
  return {
    apikey: s.supabaseAnonKey,
    Authorization: `Bearer ${s.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
}

function restUrl(s: Settings, path: string): string {
  return `${s.supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`;
}

async function readJson(res: globalThis.Response, what: string): Promise<unknown> {
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

/** PostgREST `in` lists cap out on URL length; 200 asins per request stays well inside it. */
export async function fetchTrackerRows(s: Settings, asins: string[]): Promise<TrackerRow[]> {
  const out: TrackerRow[] = [];
  for (const batch of chunk(asins, 200)) {
    const query = new URLSearchParams({
      select: 'asin,status,status_at,last_searched_at',
      asin: `in.(${batch.join(',')})`,
    });
    const res = await fetch(`${restUrl(s, 'asin_tracker')}?${query}`, { headers: headers(s) });
    out.push(...((await readJson(res, 'asin_tracker read')) as TrackerRow[]));
  }
  return out;
}

export async function upsertStatus(
  s: Settings,
  asin: string,
  status: TrackStatus | null,
): Promise<TrackerRow> {
  const body = {
    asin,
    status,
    // Clearing a status clears its date too, so the column never shows a
    // date with no status beside it.
    status_at: status === null ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(`${restUrl(s, 'asin_tracker')}?on_conflict=asin`, {
    method: 'POST',
    headers: { ...headers(s), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  const rows = (await readJson(res, 'asin_tracker status write')) as TrackerRow[];
  if (!rows[0]) throw new Error('asin_tracker status write returned no row');
  return rows[0];
}

export async function stampSearched(s: Settings, asin: string): Promise<TrackerRow> {
  const now = new Date().toISOString();
  const res = await fetch(`${restUrl(s, 'asin_tracker')}?on_conflict=asin`, {
    method: 'POST',
    headers: { ...headers(s), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ asin, last_searched_at: now, updated_at: now }),
  });
  const rows = (await readJson(res, 'asin_tracker search stamp')) as TrackerRow[];
  if (!rows[0]) throw new Error('asin_tracker search stamp returned no row');
  return rows[0];
}

/**
 * The browser never holds SP-API credentials (CONTRACTS.md §3) — the
 * gating-check edge function owns them and the `gating_status` cache.
 */
export async function fetchGating(s: Settings, asins: string[]): Promise<GatingRow[]> {
  const url = `${s.supabaseUrl.replace(/\/+$/, '')}/functions/v1/gating-check`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: s.supabaseAnonKey,
      Authorization: `Bearer ${s.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'x-kc-secret': s.gatingFunctionSecret,
    },
    body: JSON.stringify({ asins, ttlDays: s.gatingTtlDays }),
  });
  const body = (await readJson(res, 'gating-check')) as { rows?: GatingRow[] };
  return body.rows ?? [];
}
