import { bus } from './events';
import type { Settings } from './types';
import { loadSettings, storeSettings } from '../persistence/storage';
import { normalizeUiScale } from './uiScale';

export const settings: Settings = loadSettings();

export function applySettings() {
  const scale = normalizeUiScale(settings.uiScale);
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.documentElement.style.setProperty('--ui-inverse-scale', String(1 / scale));
  document.documentElement.style.setProperty('--font-scale', String(settings.textScale));
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
}

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  settings.uiScale = normalizeUiScale(settings.uiScale);
  storeSettings(settings);
  applySettings();
  bus.emit('settings:changed', {});
}
