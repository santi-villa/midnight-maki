# Juegos del NoriPhone

En el celular hay una página nueva, **Juegos**, con tres juegos simples. Se abren como cualquier app (dentro de la pantalla del
celular) y se cierran con la flecha de volver. No cambian nada del juego: solo guardan el récord de cada uno en la partida
(banderas `arcade_snake`, `arcade_catch`, `arcade_memo`).

| Juego | Cómo se juega | Controles |
|---|---|---|
| **Víbora** | La clásica: comé maki para crecer, sin chocar las paredes ni tu cola. Cada maki la acelera un poquito (con tope). | Flechas o WASD, deslizar sobre el tablero, o la cruz de botones. Recuerda hasta dos giros rápidos; un giro en U se ignora. |
| **Lluvia** (de sushi) | Mové el plato para atajar el sushi que cae. Si se te cae uno o atajás un ají, perdés un corazón (hay 3). Cae más rápido a medida que sumás. | Arrastrar sobre la pantalla, flechas izquierda/derecha (mantener) o los botones ◀ ▶. |
| **Memoria** | 16 cartas, 8 pares (sushi, onigiri, langostino, pez, té, mapache, sakura, farol). Encontralos en la menor cantidad de turnos. | Tocar las cartas. |

Archivos: reglas puras en `src/ui/phone/games/logic.ts` (tests en `src/tests/phoneGames.test.ts`), pantallas en
`src/ui/phone/games/arcade.ts` y `arcade.css`, íconos en `src/ui/phone/appIcons.ts`, apps en `src/ui/menus.ts`, página en
`src/ui/phone/pages.ts`.
