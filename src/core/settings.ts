import { bus } from './events';
import type { Settings } from './types';
import { loadSettings, storeSettings } from '../persistence/storage';

export const settings: Settings = loadSettings();

export function applySettings() {
  document.documentElement.style.setProperty('--font-scale', String(settings.textScale));
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
}

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  storeSettings(settings);
  applySettings();
  bus.emit('settings:changed', {});
}
