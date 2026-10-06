export const TRACK_STATUSES = ['checked', 'bought', 'near_miss', 'pass'] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number];

export interface TrackerRow {
  asin: string;
  status: TrackStatus | null;
  status_at: string | null;
  last_searched_at: string | null;
}

/** `gated: null` means the check could not be completed (auth, throttle, error). */
export interface GatingRow {
  asin: string;
  gated: boolean | null;
  reason_code: string | null;
  checked_at: string;
}

export interface Settings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  gatingFunctionSecret: string;
  gatingTtlDays: number;
}

export const DEFAULT_SETTINGS: Settings = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  gatingFunctionSecret: '',
  gatingTtlDays: 30,
};
