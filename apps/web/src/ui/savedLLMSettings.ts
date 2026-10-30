import type { LLMSettings, ResidentId } from '@aiverse/protocol';

/**
 * Language model settings the player filled in, remembered in this browser's localStorage so
 * a reload fills them in again: per resident, and the latest for a resident not set up yet.
 * The key is kept in plain text there, readable by anyone using this browser profile.
 */
const STORAGE_KEY = 'aiverse.llmSettings';

interface Saved {
  latest: LLMSettings;
  byResident: Record<ResidentId, LLMSettings>;
}

/** The browser's localStorage, or null where there is none or access is refused. */
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Only the string settings, so a hand-edited or older entry cannot break the page. */
function settingsFrom(value: unknown): LLMSettings {
  const settings: LLMSettings = {};
  if (typeof value !== 'object' || value === null) return settings;
  for (const name of ['baseUrl', 'apiKey', 'model'] as const) {
    const setting = (value as Record<string, unknown>)[name];
    if (typeof setting === 'string') settings[name] = setting;
  }
  return settings;
}

function read(storage: Storage): Saved {
  try {
    const data: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    const byResident: Record<ResidentId, LLMSettings> = {};
    const stored = record.byResident;
    if (typeof stored === 'object' && stored !== null) {
      for (const [id, settings] of Object.entries(stored)) byResident[id] = settingsFrom(settings);
    }
    return { latest: settingsFrom(record.latest), byResident };
  } catch {
    return { latest: {}, byResident: {} };
  }
}

/** What was last used for this resident, else the latest used for anyone; empty if none. */
export function loadLLMSettings(residentId: ResidentId, storage = browserStorage()): LLMSettings {
  if (!storage) return {};
  const saved = read(storage);
  return saved.byResident[residentId] ?? saved.latest;
}

export function saveLLMSettings(residentId: ResidentId, settings: LLMSettings, storage = browserStorage()): void {
  if (!storage) return;
  const saved = read(storage);
  const kept = settingsFrom(settings);
  saved.byResident[residentId] = kept;
  saved.latest = kept;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Full or refused: the settings just are not remembered.
  }
}
