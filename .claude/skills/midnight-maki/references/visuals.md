# Imagen

Estilo: pixel art cozy japonés, vista cenital con lectura 3/4. Cabeza grande, ojos grandes, contorno oscuro por pieza, pies en la base del frame. Paleta apagada, sin neón: `PAL` en `src/art/palette.ts`. El contorno del chibi es `#2b2231` (`src/art/chibi.ts`).

## Tamaños que hay que respetar

| Qué | Tamaño | Dónde |
|---|---|---|
| Tile de suelo y celda de mapa | 16×16 | `TS` en `src/art/tiles.ts`, `TILE` en `src/entities/Actor.ts` |
| Columnas del tileset generado | 16 | `TILESET_COLS` |
| Aldeano y jugador héroe | 24×39 | `FOLK_W` / `FOLK_H`. Diseño 32×52, raster a `FOLK_SCALE` 0.75 |
| Aldeano más ancho | alto 39, ancho `round(frameW × 0.75)` | Taro, Hoshi, Sumi y Kiki `frameW` 40 → 30. Nami, Bento y Sora `frameW` 38 → 29 |
| Pip, Rigg, Spicy | 36×39, 34×39, 30×39 | `LOOKS` en `src/art/trio.ts`. `folkFrame` los desvía ahí |
| Look clásico del jugador | 20×30 | `CW`/`CH` en `src/art/chibi.ts`, solo si el look no es héroe |
| Hoja | 30 frames en horizontal | `FRAME_COUNT`. Índices en `FRAMES` |
| Clientes del salón | 28×40, origen `(0.5, 1)` | `CUSTOMER_W` / `CUSTOMER_H`. La hoja del mundo tiene 47 frames |

`charTexture` en `src/scenes/textures.ts` elige la hoja: ficha en `FOLK_SPECS` o look héroe → folk; si no, mapa de mapache viejo; jugador clásico → chibi; el resto → `neighborSheet`. No dibujes un NPC nuevo a 16×24 ni a 20×30. Esos números son comentarios o el fallback.

El comentario de cabecera de `characters.ts` y un párrafo de `GAME_DESIGN.md` todavía dicen 16×24. No los sigas.

## Animación de personajes

`FRAMES` en `src/art/characters.ts`:

- Caminar, 4 índices por rumbo (idle, paso, idle, paso): `down` 0–2, `up` 3–5, `right` 6–8, `left` 9–11.
- Caras: parpadeo, feliz, sorpresa, sueño, triste, soberbio, respiración (el torso baja 1 px).
- Acciones: cocinar 24–25, saludar 26–27, leer 28, sentarse 29.

Rumbos del tipo `Dir`: `down`, `up`, `left`, `right`. El cliente del salón mira a la derecha en la hoja y usa `flipX` para la izquierda.

`Actor` elige el frame según el acto (`walk`, `cook`, `read`, `sit`, `wave`, `sleep`, …) en `src/entities/Actor.ts`. No crees un `AnimationManager` paralelo para el elenco generado: la hoja ya es el contrato.

## Cómo entra una imagen

1. **Pintada en código.** Tiles: `ensureTileset` → textura `tiles` (`src/scenes/textures.ts`, `src/art/tiles.ts`). Personajes: `buildCharacterSheet`. Props y muebles: `src/art/*`. Se cachean con `src/art/sheetCache.ts`.
2. **Atlas del repo**, cargados en `BootScene.preload`: `src/assets/cozy-town`, `interiors`, `village`, `farm`, `icons16`, `bridges`, `pets`, `clientes`, `portraits`.
3. **Packs locales**, opcionales. `src/art/packs.ts` hace glob de `src/assets/packs/**/*.png` y excluye `NUEVO`. Si el archivo no está, queda el arte dibujado. Flags de prueba: `?interiors=classic`, `?exteriors=classic`, `?buildings=classic`, `?japaneseCity=classic`, `?serene=classic`.
4. **`public/`** es estático de Vite (`base: './'`). Título, intro, logo, mapa. No es el lugar de un sprite de juego nuevo.

Al crear una textura de pixel art: `setFilter(NEAREST)`. El juego ya lo hace en clima y vida de calle. Escala entera. PNG con alpha. Sin antialiasing ni halo de fondo blanco.

Un sprite de prueba no se copia a `src/assets` ni a `public`. Se queda en `.claude/skill-tests/` hasta que se pida integrarlo.

Phaser, cuando sí haga falta una hoja externa: `this.load.spritesheet` si la grilla es uniforme, o `this.load.atlas` si el JSON trae `frames[].frame.{x,y,w,h}` y `filename`. Pixel Art Studio escribe ese JSON (formato de atlas que el propio `references/export.md` de esa skill marca para Phaser). Pixelbolt escribe PNG, atlas y GIF. El archivo que entra al juego es el PNG a escala 1, no el GIF.
