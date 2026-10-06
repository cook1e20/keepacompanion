import { DEFAULT_SETTINGS, type Settings } from './types.js';

const KEY = 'kc_settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

/** Tracker works on Supabase alone; the gating column additionally needs the function secret. */
export function isTrackerConfigured(s: Settings): boolean {
  return s.supabaseUrl.trim() !== '' && s.supabaseAnonKey.trim() !== '';
}

export function isGatingConfigured(s: Settings): boolean {
  return isTrackerConfigured(s) && s.gatingFunctionSecret.trim() !== '';
}
