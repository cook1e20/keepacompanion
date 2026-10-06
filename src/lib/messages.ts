import type { GatingRow, TrackStatus, TrackerRow } from './types.js';

/** Tags on window.postMessage traffic between the MAIN-world bridge and the content script. */
export const FROM_BRIDGE = 'kc-bridge';
export const FROM_CONTENT = 'kc-content';

export type Request =
  | { kind: 'TRACKER_FETCH'; asins: string[] }
  | { kind: 'TRACKER_SET'; asin: string; status: TrackStatus | null }
  | { kind: 'SEARCH_STAMP'; asin: string }
  | { kind: 'GATING_FETCH'; asins: string[] };

export type Response =
  | { kind: 'TRACKER_ROWS'; rows: TrackerRow[] }
  | { kind: 'GATING_ROWS'; rows: GatingRow[] }
  | { kind: 'ERROR'; message: string };

export interface Envelope<T> {
  source: typeof FROM_BRIDGE | typeof FROM_CONTENT;
  id: number;
  payload: T;
}
