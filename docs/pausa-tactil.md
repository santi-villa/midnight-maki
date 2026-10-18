# Pausa accesible desde el HUD

- Botón ⏸ en la fila superior derecha, junto a Mochila/Misiones/Mapa; icono pixel art de dos barras con la paleta de madera y pergamino. Nombre accesible «Pausa» y atajo Esc cuando se usa teclado.
- Abre el mismo menú que Esc. Agrega «Continuar partida» y una explicación táctil; también se puede cerrar con ✕ o Esc. No abre otra pausa si ya hay un modal.
- Reutiliza `openModal` y `clock.pause/resume`: sin otro reloj ni cambios en guardados. Mantiene el comportamiento existente del cooperativo; la visita no pausa el dispositivo del anfitrión.
- Se aprovecha la distribución existente: cuatro botones en una fila y dos por fila en pantallas de hasta 340 px. Áreas de toque de al menos 44×44 px en las resoluciones comprobadas.

Verificación: `npx tsc --noEmit` aprobado; los dos casos de `e2e/pause-menu.spec.ts` aprobados, sin suite completa. Comprueban Esc, toque real emulado, detención del reloj/controles, reanudación y ausencia de superposición con el reloj. Capturas inspeccionadas en `docs/art/pausa/`: PC 1280×720, vertical 320×740 y 390×844, horizontal 844×390; `/?debug`, `window.mmDebug`, `perf: 'high'`. Chromium con emulación táctil, no un celular físico.

Archivos: `src/ui/hud.ts`, `menus.ts`, `skin.ts`, prueba y capturas citadas arriba.
