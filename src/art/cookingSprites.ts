/**
 * Optional PNG art for the kitchen (public/cocina/<name>.png, list in docs/cocina-assets.md).
 * Every piece is optional: while one is missing the drawing made by code is used instead.
 */
const cache = new Map<string, HTMLImageElement | null>();

/** The loaded sprite, or null while it loads or when the file does not exist. */
export function cookSprite(name: string): HTMLImageElement | null {
  if (!cache.has(name)) {
    cache.set(name, null);
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    img.onload = () => { if (img.naturalWidth > 0) cache.set(name, img); };
    img.onerror = () => {};
    img.src = `${import.meta.env.BASE_URL}cocina/${name}.png`;
  }
  return cache.get(name) ?? null;
}

/** Starts loading the pieces the kitchen is about to use. */
export function preloadCookSprites(names: string[]) {
  for (const n of names) cookSprite(n);
}
