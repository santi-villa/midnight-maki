/**
 * What the NoriPhone can look like: models, case colours and wallpapers, and what unlocks each one.
 * Pure data + small predicates (they read the game through `UnlockCtx`, so they can be tested without a save).
 */
export interface UnlockCtx {
  level: number;
  has: (flag: string) => boolean;
  friend: (id: string) => number;
  projectPhases: number;
  achievement: (id: string) => boolean;
}

export interface Unlock {
  /** how to get it, in words (shown on the silhouette of a locked option) */
  how: string;
  test: (c: UnlockCtx) => boolean;
}

export interface ModelDef {
  id: string;
  name: string;
  note: string;
  /** width / height of the whole device */
  aspect: number;
  /** bezel thickness in "phone pixels": sides, top (speaker + camera) and bottom */
  bezel: { side: number; top: number; bottom: number };
  /** corner radius of the body and of the screen */
  radius: number;
  screenRadius: number;
  camera: 'dot' | 'small' | 'punch' | 'moon';
  speaker: 'slot' | 'short' | 'thin' | 'star';
  unlock?: Unlock;
}

export const MODELS: ModelDef[] = [
  { id: 'classic', name: 'NoriPhone Classic', note: 'Bordes gruesos, parlante bien visible. Simple y acogedor.', aspect: 0.5, bezel: { side: 6, top: 13, bottom: 10 }, radius: 4, screenRadius: 2, camera: 'dot', speaker: 'slot' },
  { id: 'mini', name: 'NoriPhone Mini', note: 'Compacto, de bordes redondeados y cámara chiquita.', aspect: 0.47, bezel: { side: 5, top: 11, bottom: 9 }, radius: 7, screenRadius: 4, camera: 'small', speaker: 'short' },
  { id: 'plus', name: 'NoriPhone Plus', note: 'Más pantalla y marcos finitos. Un poco más elegante.', aspect: 0.46, bezel: { side: 3, top: 9, bottom: 6 }, radius: 5, screenRadius: 3, camera: 'punch', speaker: 'thin', unlock: { how: 'Subí el restaurante al nivel 3.', test: (c) => c.level >= 3 } },
  { id: 'moonberry', name: 'MoonBerry', note: 'Formas suaves, estrellas y estética nocturna.', aspect: 0.48, bezel: { side: 5, top: 12, bottom: 9 }, radius: 8, screenRadius: 5, camera: 'moon', speaker: 'star', unlock: { how: 'Seguí la historia hasta "Las mentiras de Villa Nori" (capítulo 5).', test: (c) => c.has('ch5_done') } },
];
export const MODEL_BY_ID: Record<string, ModelDef> = Object.fromEntries(MODELS.map((m) => [m.id, m]));

export interface ColorDef {
  id: string;
  name: string;
  body: string;
  /** small motif drawn on the bezel */
  deco?: 'petals' | 'stars' | 'pip' | 'spicy' | 'rigg';
  unlock?: Unlock;
}

export const COLORS: ColorDef[] = [
  { id: 'crema', name: 'Crema', body: '#efe3c8' },
  { id: 'negro', name: 'Negro', body: '#34313d' },
  { id: 'rosa', name: 'Rosa pastel', body: '#efbfc6' },
  { id: 'celeste', name: 'Celeste', body: '#a9d3ea' },
  { id: 'menta', name: 'Verde menta', body: '#a8dcc0' },
  { id: 'lavanda', name: 'Lavanda', body: '#c9b8e6' },
  { id: 'rojo', name: 'Rojo oscuro', body: '#8e3a46' },
  { id: 'cafe', name: 'Beige café', body: '#c4a27c' },
  { id: 'sakura', name: 'Sakura', body: '#f6c9d6', deco: 'petals', unlock: { how: 'Terminá las dos etapas de "Plaza en flor" en la cartelera.', test: (c) => c.projectPhases >= 2 } },
  { id: 'medianoche', name: 'Medianoche', body: '#232a52', deco: 'stars', unlock: { how: 'Completá el capítulo 4 de la historia.', test: (c) => c.has('ch4_done') } },
  { id: 'estrellas', name: 'Estrellas', body: '#4a3b78', deco: 'stars', unlock: { how: 'Terminá la historia principal.', test: (c) => c.has('story_done') || c.has('ch8_done') } },
  { id: 'pip', name: 'Edición Pip', body: '#8e8d96', deco: 'pip', unlock: { how: 'Amistad nivel 3 con Pip.', test: (c) => c.friend('pip') >= 3 } },
  { id: 'spicy', name: 'Edición Spicy', body: '#c9503f', deco: 'spicy', unlock: { how: 'Amistad nivel 3 con Spicy.', test: (c) => c.friend('spicy') >= 3 } },
  { id: 'rigg', name: 'Edición Rigg', body: '#5d7388', deco: 'rigg', unlock: { how: 'Amistad nivel 3 con Rigg.', test: (c) => c.friend('rigg') >= 3 } },
];
export const COLOR_BY_ID: Record<string, ColorDef> = Object.fromEntries(COLORS.map((c) => [c.id, c]));

export interface WallpaperDef {
  id: string;
  name: string;
  unlock?: Unlock;
}

export const WALLPAPERS: WallpaperDef[] = [
  { id: 'crema', name: 'Crema' },
  { id: 'rosa', name: 'Rosa pastel' },
  { id: 'menta', name: 'Verde menta' },
  { id: 'noche', name: 'Cielo nocturno' },
  { id: 'faroles', name: 'Faroles japoneses' },
  { id: 'sakura', name: 'Flores de sakura' },
  { id: 'sushi', name: 'Sushi' },
  { id: 'pip', name: 'Pip: canicas y estrellas', unlock: { how: 'Amistad nivel 2 con Pip.', test: (c) => c.friend('pip') >= 2 } },
  { id: 'spicy', name: 'Spicy: sushi picante', unlock: { how: 'Amistad nivel 2 con Spicy.', test: (c) => c.friend('spicy') >= 2 } },
  { id: 'rigg', name: 'Rigg: noche de libros', unlock: { how: 'Amistad nivel 2 con Rigg.', test: (c) => c.friend('rigg') >= 2 } },
  { id: 'tres', name: 'Los tres mapaches', unlock: { how: 'Amistad nivel 4 con Pip, Spicy y Rigg.', test: (c) => ['pip', 'spicy', 'rigg'].every((i) => c.friend(i) >= 4) } },
  { id: 'maki', name: 'Midnight Maki', unlock: { how: 'Subí el restaurante al nivel 2.', test: (c) => c.level >= 2 } },
  { id: 'nori', name: 'Villa Nori', unlock: { how: 'Terminá tres etapas de proyectos del pueblo.', test: (c) => c.projectPhases >= 3 } },
  { id: 'recuerdo', name: 'Recuerdo del faro', unlock: { how: 'Encendé el Faro de las Tres Estrellas (final de la historia).', test: (c) => c.has('story_done') || c.has('ch8_done') } },
];
export const WALLPAPER_BY_ID: Record<string, WallpaperDef> = Object.fromEntries(WALLPAPERS.map((w) => [w.id, w]));

export type PhoneKind = 'model' | 'color' | 'wallpaper';
export const ITEMS: Record<PhoneKind, { id: string; unlock?: Unlock; name: string }[]> = { model: MODELS, color: COLORS, wallpaper: WALLPAPERS };

export function itemOf(kind: PhoneKind, id: string) {
  return ITEMS[kind].find((i) => i.id === id);
}

export function ruleMet(kind: PhoneKind, id: string, ctx: UnlockCtx): boolean {
  const it = itemOf(kind, id);
  return !!it && (!it.unlock || it.unlock.test(ctx));
}

export const DEFAULT_PHONE = { model: 'classic', color: 'crema', wallpaper: 'crema' } as const;
