import { loadSettings, saveSettings } from '../lib/settings.js';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types.js';

function field(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`missing field: ${id}`);
  return el;
}

async function hydrate(): Promise<void> {
  const settings = await loadSettings();
  field('supabaseUrl').value = settings.supabaseUrl;
  field('supabaseAnonKey').value = settings.supabaseAnonKey;
  field('gatingFunctionSecret').value = settings.gatingFunctionSecret;
  field('gatingTtlDays').value = String(settings.gatingTtlDays);
}

async function save(): Promise<void> {
  const ttl = Number.parseInt(field('gatingTtlDays').value, 10);
  const settings: Settings = {
    supabaseUrl: field('supabaseUrl').value.trim(),
    supabaseAnonKey: field('supabaseAnonKey').value.trim(),
    gatingFunctionSecret: field('gatingFunctionSecret').value.trim(),
    gatingTtlDays: Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_SETTINGS.gatingTtlDays,
  };
  await saveSettings(settings);

  const status = document.getElementById('status');
  if (status) {
    status.textContent = 'Saved — reload the Keepa tab.';
    setTimeout(() => { status.textContent = ''; }, 4000);
  }
}

document.getElementById('save')?.addEventListener('click', () => void save());
void hydrate();
