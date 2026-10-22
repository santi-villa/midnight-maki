/**
 * Pip's hand-drawn sprite sheet (30 frames in the shared layout, see FRAMES in characters.ts), cut from the sheet received
 * for him by scripts/build-pip-sheet.py. Loaded once at boot; without it Pip keeps the generated raccoon.
 */
import sheetURL from '../assets/pip/pip-sheet.png';

export const PIP_SHEET_KEY = 'pip-sheet-source';
export const PIP_SHEET_URL = sheetURL;
export const PIP_FRAME = { w: 36, h: 32 } as const;

let sheet: CanvasImageSource | null = null;
export function installPipSheet(source: CanvasImageSource) { sheet = source; }
export function pipSheet(): CanvasImageSource | null { return sheet; }
