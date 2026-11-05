# Pueblo, gente, luz

## Mapa vivo

`VILLAGE_WIDTH = 120` y `VILLAGE_HEIGHT = 80` en `src/data/villageWorld.ts`. `VILLAGE_REVISION = 2`. Los barrios de `VILLAGE_BOUNDS` (`src/data/villageGeography.ts`) se estampan en esa grilla. No muevas esas coordenadas para “ordenar” el pueblo.

| Id | Origen | Tamaño | Lugar |
|---|---|---|---|
| `forest` | 0,0 | 31×25 | Bosque de los Susurros. Candado `unlock_forest` |
| `shrine` | 31,0 | 41×23 | Colina del Santuario |
| `station` | 72,0 | 48×23 | Estación abandonada. `unlock_station` |
| `garden` | 0,25 | 31×23 | Jardín de los Faroles. `unlock_garden` |
| `plaza` | 31,23 | 41×37 | Centro. Restaurante, tiendas, fuente, puestos |
| `residential` | 72,23 | 48×37 | Casas y ribera |
| `beach` | 0,48 | 31×32 | Playa. `unlock_beach` |
| `market` | 31,60 | 43×20 | Mercado del puerto. `unlock_beach` y, los puestos, `market_open` |
| `harbor` | 74,60 | 46×20 | Puerto y faro. `unlock_beach` |
| `deepforest` | −40,0 | 40×25 | Fuera de la grilla 120×80. `src/data/deepForest.ts` |

No hay zona `farm`. La huerta es suelo del jardín.

Interiores, fuera de esa grilla (`src/data/zones.ts`, `src/data/houses.ts`):

- `restaurant` 24×14, izakaya. Puertas a plaza, `home` y `storage`.
- `shop_yuki`, `shop_taro`, `shop_bento`: 18×8.
- `library` 12×9. `home` 29×12 (jugador, Pip, Spicy, Rigg y pasillo). `storage` 9×8, `dark`. `lighthouse` 13×12, `gloom`.
- Dieciséis casas de 10×8. El id histórico no se parsea como coordenada. Los sitios están en `VILLAGE_HOME_SITES`.

`src/data/outdoorLayout.ts` no arma las calles vivas. Las arma `installVillageWorld`.

Hábitats de bichos: `src/world/habitats.ts`. No pisa muelles ni agua.

## Rutinas

Un personaje con nombre tiene una parada por periodo en `src/data/characters.ts`: 0 mañana, 1 tarde, 2 atardecer, 3 noche. La parada es zona, tile, acto y a veces cama o asiento. `src/systems/schedule.ts` no cambia de zona durante el periodo, salvo al salir (`depart`, minuto ≥ 82). Fases por minuto de periodo: settle 12, main 36, meal 50, stroll 70, social 82.

`stopFor` en `src/systems/npcs.ts` aplica, en orden: bandera de historia, prólogo, mostrador, festival, sueño del residente, rutina de restaurante, parada del periodo, refugio de lluvia.

Elenco con ficha: Pip, Spicy Bacon, Rigg, Momo, Taro, Yuki, Kumo, Nami, Hoshi, Bento, Sumi, Kiki, Sora, Ume, Akio. Mika es alias de Sumi.

`raccoonRoutine` (`src/data/raccoons.ts`) reemplaza la noche y el turno de Pip, Spicy y Rigg cuando el restaurante está abierto (08:00–22:00) y la intro terminó. Cerrado, de noche, Rigg limpia hasta `CLEAN_UNTIL` (50) y después los tres duermen. No reescribas esa función para “darles IA”: el pueblo a pantalla apagada no hace pathfinding por frame.

Vecinos de ambiente, sin misiones, en `src/data/neighbors.ts`: Ren, Mika, Haru, Tomo, Nene, Goro, Fuyu, Sato, Mame, Kai, Rin, Oto. Su día lo arma `planVillage` (`src/systems/neighborPlan.ts`). Caminan a 2.5 tiles/s (`WALK_TILES` en `src/systems/neighbors.ts`).

Tiendas (`src/systems/schedule.ts`): abren 08:00. Yuki, Bento, Ren, Sumi, Nami y conchas cierran 20:00. Taro, biblioteca y restaurante cierran 22:00. Los puestos del mercado nocturno solo abren en el periodo 3.

## Reloj

`periodMinutes: 90`. `realSecondsPerGameMinute: 1`. Anclas 06:00, 12:00, 18:00, 21:00, 24:00. Mañana y tarde muestran 4 minutos de reloj por minuto de periodo; atardecer y noche, 2. El HUD avanza un minuto mostrado por segundo real. El periodo 3 no pasa de día: llega hasta justo antes de las 06:00. El día nuevo solo ocurre al dormir. Diálogo, menús, cocina y el NoriPhone pausan el reloj.

## Luz, sombra, clima

| Pieza | Archivo | No romper |
|---|---|---|
| Tinte, faroles, luna | `lightState` en `src/scenes/lightmath.ts` | La noche no destapa el tile de día. El charco del farol queda más oscuro que el mediodía |
| Sombra de contacto | `castAnchor` en el mismo archivo, textura en `src/scenes/shadowTex.ts` | Pivote en los pies. No se desliza de costado. Interior fijo; afuera la punta sigue al sol |
| Sol interior | `src/scenes/interiorLight.ts` | De noche la fuerza es 0 |
| Grado de cámara | `src/scenes/grade.ts` | Solo exteriores |
| Clima GPU | `src/scenes/gpuWeather.ts` | `SpriteGPULayer` si `richFx`. Sin GPU usable, el camino clásico |
| Sonda de suelo GPU | `src/scenes/gpuProbe.ts` | Si el tile de prueba no se lee, el suelo no usa `TilemapGPULayer` |
| Lluvia, agua, nieve | `rainFx.ts`, `waterFx.ts`, `src/world/snowCover.ts` | La nieve no tapa puertas. No se guarda |

`?fx` fuerza los extras de GPU. Batería y movimiento reducido se quedan con el efecto liviano.
