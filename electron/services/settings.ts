import Store from 'electron-store';
import type { Settings, ModeId } from '../shared/types';

interface StoreSchema {
  settings: Settings;
}

const defaults: Settings = {
  hotkey: 'CommandOrControl+Shift+Space',
  saveHistory: true,
  defaultMode: 'meeting' as ModeId,
  language: 'auto',
  openaiApiKey: undefined,
  openaiTranscribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
};

const store = new Store<StoreSchema>({
  name: 'voxnote-settings',
  defaults: {
    settings: defaults,
  },
});

export function getSettings(): Settings {
  const stored = store.get('settings');
  return { ...defaults, ...stored };
}

export function setSettings(patch: Partial<Settings>): Settings {
  const current = getSettings();
  const updated = { ...current, ...patch };
  store.set('settings', updated);
  return updated;
}

export function getApiKey(): string | undefined {
  const settings = getSettings();
  return settings.openaiApiKey || process.env.OPENAI_API_KEY;
}

export function getTranscribeModel(): string {
  const settings = getSettings();
  return settings.openaiTranscribeModel || process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
}

export function getChatModel(): string {
  const settings = getSettings();
  return settings.openaiChatModel || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
}
