---
name: midnight-maki
description: >
  Proyecto Midnight Maki (Mapaches y Sushi, Villa Nori): RPG cozy japonés, pixel art 2D top-down 3/4, Phaser 4, TypeScript y Vite, navegador y Android.
  Léela antes de cambiar código, mapas, NPC, sprites, tiles, luz, clima o assets de este repositorio.
  Prioriza mejorar lo que ya existe y reutilizar arte y sistemas. No cambies la versión de Phaser ni repitas la migración.
  No subas packs comerciales ni los envíes a servicios externos.
  Enruta cada tarea a una sola skill de producción: pixel-art, pixel-art-studio, pixelbolt-pixel-art, una skill de Phaser 4, o level-design, game-feel, game-ai y performance-optimization.
  Disparadores: midnight maki, villa nori, mapaches y sushi, sprite, tile, NPC, rutina, farol, sombra, clima, Phaser, restaurante.
---

# Midnight Maki

Mejora el juego que ya está. No abras un sistema paralelo ni un estilo visual nuevo si el código o un pack ya cubren la tarea.

La versión declarada es Phaser **4.2.1** (`package.json` y `package-lock.json`). No la cambies. No instales ni sigas `v3-to-v4-migration`: la migración ya está hecha. Si `node_modules/phaser` no es 4.2.1, el árbol de módulos está viejo; no subas el rango para “arreglarlo”.

## Antes de producir nada

1. Lee el archivo de `references/` que corresponda. El código que cita es la fuente. Si un número de aquí no coincide con el archivo, gana el archivo.
2. Busca el sprite, el tile, la rutina o la función que ya existen. Extiéndelos.
3. Un asset nuevo solo entra si no hay pieza reutilizable. Dibújalo al tamaño real del juego y con la paleta de `src/art/palette.ts`.
4. No escribas en `src/assets/packs/`, `ASSETS DESCARGADOS/` ni `public/` para una prueba. Las pruebas van a `.claude/skill-tests/`.
5. No subas PNG, atlas ni zips de packs a un chat, un generador de imágenes ni otro servicio. Esos packs son privados.

## Qué leer

| Pregunta | Archivo |
|---|---|
| Escenas, carpetas, sistemas | `references/architecture.md` |
| Tamaños, paleta, animaciones, cómo entra una imagen | `references/visuals.md` |
| Pueblo, rutinas, luz, clima, reloj | `references/world.md` |
| Packs y licencias | `references/assets.md` |
| Qué comando y qué test correr | `references/checks.md` |

## Qué skill usar

Una tarea, una herramienta de producción. Esta skill manda sobre las otras si se contradicen.

| Tarea | Skill | No uses |
|---|---|---|
| Criterio visual: paleta, perspectiva, sombreado, tiles, consistencia | `pixel-art` | No dibuja archivos |
| Sprite, personaje, objeto, tile o ciclo dibujado pixel a pixel | `pixel-art-studio` | No la uses para fuego, humo o agua animados |
| Fuego, humo, vapor, agua, partículas, hechizos, spritesheet de un efecto | `pixelbolt-pixel-art` | CLI `npx -y pixelbolt@0.11.0`. Sin servidor MCP |
| Escena, filtro, render texture, animación de Phaser, escala | la skill de Phaser con ese nombre | No migres desde Phaser 3 |
| Novedades del motor ya en uso | `v4-new-features` | No cambia la versión |
| Recorrido, ritmo y lectura de un lugar | `level-design` | No redibuja el pueblo ni mueve coordenadas por su cuenta |
| Golpe, juice, feedback de una acción que ya funciona | `game-feel` | No reescribe el movimiento |
| Decisión de un NPC, steering, camino | `game-ai` | Las rutinas actuales viven en `src/data/characters.ts` y `src/systems/schedule.ts`. No las reemplaces por un behavior tree |
| FPS, hitch, draw calls | `performance-optimization` | Mide antes de cambiar el renderer. El suelo y el clima ya tienen un camino GPU y un camino clásico |

`pixel-art` revisa. `pixel-art-studio` dibuja personajes, props y tiles. `pixelbolt-pixel-art` hace efectos. No pases el mismo asset por Studio y por Pixelbolt en la misma pasada.

Las skills de gamedev citan Godot, Unity y un router que **no están instalados**. Ignora esos ejemplos y usa el código de este repo más la skill de Phaser 4 que corresponda. `physics-tuning`, `camera-systems`, `audio-design` y `procedural-gen` tampoco están instaladas.

Pixel Art Studio: los scripts están en `.claude/skills/pixel-art-studio/scripts`. Pillow ya alcanza (`python3 -c "import PIL"`). No agregues Pillow ni Pixelbolt a `package.json`. El juego no depende de ellos.

## Al integrar

- Tile de suelo: 16×16 (`TS` en `src/art/tiles.ts`). Celda de mundo: 16 px (`TILE` en `src/entities/Actor.ts`).
- Quien camina hoy sale de `folkFrame` / `buildFolkSheet`: 24×39 por defecto, pies abajo, origen `(0.5, 1)`. Pip, Rigg y Spicy miden 36×39, 34×39 y 30×39. El chibi de 20×30 es solo el look clásico del jugador.
- `pixelArt: true`, `roundPixels: true`, `antialias: false`. Filtro `NEAREST` en texturas pintadas.
- Escala solo entera. PNG con alpha. No antialiasing.
- Después de un cambio de código: `npm run typecheck` y el `src/tests/*.test.ts` del sistema tocado. No lances `npm run e2e` salvo que te lo pidan.
