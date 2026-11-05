# Arquitectura

Entrada: `index.html` → `src/main.ts`. El `Phaser.Game` se crea cuando `#game` tiene tamaño.

```ts
type: Phaser.AUTO
pixelArt: true
roundPixels: true
antialias: false
scale.mode: Phaser.Scale.RESIZE
fps: { target: 60, min: 30 }
scene: [BootScene, TitleScene, WorldScene]
```

No hay bloque `physics` en la config. `?debug` publica `window.mmDebug`. `?st` fuerza el bucle por `setTimeout`. `__mm` es el juego, para pruebas.

## Escenas

Solo tres, en este orden. No hay `scene.add`.

| Key | Archivo | Rol |
|---|---|---|
| `boot` | `src/scenes/BootScene.ts` | Carga atlas, arma el tileset, arranca `title` |
| `title` | `src/scenes/TitleScene.ts` | Fondo de noche en tiles de 16 px y la sonda GPU. Se duerme cuando entra el arte del título |
| `world` | `src/scenes/WorldScene.ts` | Pueblo, interiores, NPC, luz, agua, lluvia, restaurante |

El resto de `src/scenes/` son efectos y mates, no escenas. El menú es DOM: `src/ui/title.ts`. `startWorld` está en `src/core/flow.ts`.

## Carpetas de `src/`

| Carpeta | Qué guarda |
|---|---|
| `art/` | Pintores y recortes: tiles, personajes, props, muebles, packs |
| `assets/` | Atlas PNG/JSON que sí van en el repo |
| `audio/` `music/` | Ambiente, pasos, voces, menú e intro |
| `cloud/` `coop/` | Firebase, códigos de amigo, restaurante de a dos |
| `core/` | Estado, ajustes, balance, flujo, errores |
| `data/` | Zonas, objetos, recetas, personajes, geografía |
| `decoration/` | Editor de colocar, rotar y guardar en el cuarto |
| `dialogue/` | Texto, temas, regalos |
| `entities/` | `Actor` y poses de descanso |
| `galley/` `kitchen/` `restaurant/` | Cocina, piso, pedidos, personal |
| `input/` | Teclas y atajos |
| `minigames/` | Pesca, bichos, puzzles |
| `persistence/` | IndexedDB y `validateSave` |
| `quests/` `story/` | Misiones, intro, lazos |
| `systems/` | Reloj, agenda, NPC, pueblo |
| `ui/` | HUD, menús, NoriPhone |
| `world/` | Grilla, villa, hábitats, transiciones |
| `tests/` | Vitest |

## Sistemas y su archivo

| Sistema | Entrada |
|---|---|
| Reloj | `src/systems/time.ts`, `src/systems/daytime.ts`, `src/core/balance.ts` |
| Partida | `src/persistence/storage.ts`, `SAVE_VERSION = 1` en `src/core/state.ts`, `src/persistence/validate.ts`. Tres slots |
| Input | `src/input/bindings.ts`, `src/input/shortcuts.ts`. WASD o flechas, E, Enter, Space, F, P el NoriPhone, Escape cierra |
| Diálogo | `src/dialogue/dialogue.ts`, `src/dialogue/talk.ts` |
| Servicio | `src/restaurant/service.ts`, `src/restaurant/floor.ts` |
| Cocina | `src/kitchen/act.ts`, `src/kitchen/board.ts`, `src/galley/index.ts` |
| Pesca | `src/minigames/fishing.ts`. Hace falta caña (`src/systems/rods.ts`) |
| Misiones | `src/quests/quests.ts` |
| Teléfono | `src/ui/phone/phone.ts`, abierto desde `src/ui/menus.ts` |
| Decoración | `src/decoration/editor.ts` |
| Cooperativo | `src/coop/index.ts` |

## Grilla

`src/world/grid.ts` es caminabilidad y A* de 4 direcciones. El índice es `y * w + x`. Y crece hacia abajo. El tile del mundo mide 16 px. Los pies del actor quedan en `ty * TILE + TILE - 2`, origen del sprite `(0.5, 1)`, profundidad = Y de los pies.

Afuera hay un solo mapa vivo, `village` (`src/world/village.ts`). La partida sigue guardando el barrio (`plaza`, `beach`, …). Los interiores son zonas aparte.
