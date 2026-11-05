# Comprobaciones

No des por bueno un cambio de código sin una corrida. No lances la suite e2e: tarda y se pide aparte.

| Comando | Cuándo |
|---|---|
| `npm run typecheck` | Cualquier cambio de TypeScript |
| `npx vitest run src/tests/<archivo>.test.ts` | El sistema que tocaste |
| `npm test` | Solo si el cambio cruza varios sistemas y te lo piden. Sigue sin incluir Playwright |
| `npm run e2e` | Solo si te lo piden |

Archivos que ya cubren lo fácil de romper:

| Tema | Test |
|---|---|
| Reloj y horarios | `src/tests/hudClock.test.ts`, `hours.test.ts`, `businessHours.test.ts`, `schedule.test.ts` |
| Pueblo y zonas | `village.test.ts`, `villageDress.test.ts`, `zones.test.ts`, `worldmapLayout.test.ts` |
| Luz, grado, lluvia, agua, GPU | `light.test.ts`, `grade.test.ts`, `rain.test.ts`, `water.test.ts`, `phaser4Fx.test.ts` |
| Vecinos y vida | `neighbors.test.ts`, `townLife.test.ts`, `townAmbience.test.ts` |
| Arte de tiendas y personajes | `shopArt.test.ts`, `hero.test.ts`, `folk.test.ts`, `limezu.test.ts` |
| Restaurante | `service.test.ts`, `floor.test.ts`, `kitchenPure.test.ts` |

Una imagen nueva se revisa a escala 1 y a un entero (4 u 8): silueta clara, pies en la base, sin halo, sin color fuera de la paleta, y el mismo ancho de celda que el sistema que la va a usar. Un GIF sirve para mirar el movimiento. Al juego entra el PNG.

Vite sirve en el puerto 5173 (`vite.config.ts` y `.claude/launch.json`). Playwright, si alguna vez se corre, usa el 5174.
