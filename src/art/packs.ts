/**
 * Atlases cut from the licensed packs (LimeZu Modern Interiors / Exteriors, VectoRaith's Japanese buildings, GuttyKreum's
 * Japanese City, Serene Village, Sprout Lands UI) live in src/assets/packs/, which git ignores: their licenses forbid sharing
 * them, so they are never in the public repository. The scripts/build-*.py tools write them there from the local packs.
 * When a file is missing (a fresh clone, the CI build) the game simply keeps its own drawn art for those pieces.
 */
const urls = import.meta.glob<string>('../assets/packs/**/*.png', { eager: true, query: '?url', import: 'default' });
const jsons = import.meta.glob('../assets/packs/**/*.json', { eager: true, import: 'default' });

/** URL of a pack image, e.g. packUrl('limezu/atlas.png'), or null when the local packs are not there. */
export function packUrl(path: string): string | null {
  return urls['../assets/packs/' + path] ?? null;
}

/** A pack catalog, or `empty` when the local packs are not there. */
export function packJson<T>(path: string, empty: T): T {
  return (jsons['../assets/packs/' + path] as T | undefined) ?? empty;
}

export interface AtlasRect { x: number; y: number; w: number; h: number }
export interface AtlasFrame { sheet: string; rect: number[]; atlas: AtlasRect }
/** One cut piece and the game ids it dresses. */
export interface PackPiece {
  id: string;
  name: string;
  replaces: string[];
  atlas: AtlasRect;
  rect?: number[];
  trim?: number[];
  tiles?: number[];
  sheet?: string;
  frames?: AtlasFrame[];
}
