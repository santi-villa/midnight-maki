# Maki & Mapaches — Experiencia en PC

Auditoría hecha sobre `master-mgsshv` (`e1934fb`, 14 oct 2026). Es la rama de desarrollo más reciente.

Las otras ramas del remoto quedaron atrás y no se mezclaron:

| Rama | Último commit | Fecha |
| --- | --- | --- |
| `master-mgsshv` | Entrega con bandeja, clientes y bebidas | 2026-10-14 |
| `master` | Pueblo vivo, HUD de madera | 2026-10-12 |
| `menu-principal` | Ocho clientes sueltos | 2026-10-12 |
| `feat/rutinas-vivas` | Cocina más clara | 2026-10-12 |
| `main` | Merge viejo de `master-mgsshv` | 2026-10-12 |

El restaurante sigue llamándose Midnight Maki y el pueblo, Villa Nori. El juego se presenta como Maki & Mapaches.

## Estado de la entrega

El paquete A (controles, atajos y navegación por teclado) queda implementado en esta rama local. Los paquetes B a E siguen pendientes. No se reescribió el movimiento, la cámara ni los menús: se amplió lo que ya existía.

## 1. Estado actual

### Controles que ya funcionan

- Caminar con WASD y flechas. La diagonal se normaliza en `WorldScene.updatePlayer` para no ir más rápido en oblicuo.
- Clic en el suelo para caminar, y clic sobre una persona o un objeto para acercarse e interactuar.
- E, Espacio y Enter disparan la acción contextual principal.
- Escape cierra el modal de arriba. El botón Atrás del navegador y de Android hace lo mismo, o abre NoriPhone si no hay ventana.
- El título ya se recorre con flechas. El diálogo avanza con E, Espacio y Enter, y las opciones numeradas aceptan 1–9.
- NoriPhone enfoca la primera aplicación al abrirse. Al cerrar un modal se devuelve el foco anterior.
- Joystick virtual opcional, guardado en ajustes (`joystick`, activo por defecto desde la versión 2 de ajustes).
- La página no hace zoom con pellizco ni con Ctrl+rueda. `body` tiene `overflow: hidden`.

### Interfaz, cámara y pixel art

- Una sola lógica de juego. Los menús son paneles HTML sobre el canvas de Phaser.
- El zoom de la cámara es entero: `floor(min(ancho, alto) / (16 × 11))`, con mínimo 2. En 1280×720 da 4; en 1920×1080 da 6. El pixel art del canvas usa `pixelArt`, `roundPixels` y `image-rendering: pixelated`.
- El HUD es HTML. El tamaño de texto tiene cuatro pasos (`textScale`). No hay una escala de interfaz aparte ni zoom de cámara elegible.
- La cocina es un overlay vertical (tablero + bandeja) pensado para el celular. En pantallas altas el tablero pasa a 220×300.
- La decoración coloca muebles por toque, con botones para rotar y empujar un casillero. No hay arrastre libre ni teclado.
- No hay sistema de tooltips. Algunos botones usan `title`.
- No hay pantalla completa propia. El modo ventana es el del navegador.

### Guardado y ajustes

- La partida vive en IndexedDB, con copia en `localStorage`. No se mezcla con los ajustes.
- Los ajustes están en `localStorage` (`mm_settings`): volúmenes, texto, cocina, movimiento reducido, vibración, joystick, flecha de misión y calidad de efectos.
- Al ocultar la pestaña se guarda la partida, se suspende el audio y la vibración no pulsa. El reloj de juego no avanza mientras un modal, un diálogo o la decoración lo pausan. Al volver, el frame se recorta a 50 ms, así que la paciencia de los clientes no salta por el tiempo afuera.

## 2. Problemas

- No hay un mapa único de acciones. E, Espacio y Enter están escritos a mano en la escena, y no existen M, J, I, R, P ni F.
- No se puede consultar ni cambiar los atajos. Tampoco se detectan duplicados.
- Las indicaciones del HUD no dicen la tecla y no distinguen el último método de entrada. En PC el joystick sigue apareciendo si el ajuste está activo.
- Phaser captura las teclas de movimiento y puede impedir escribir en un campo, o dejar que Espacio y las flechas desplacen la página.
- Cerrar una ventana con Enter o Escape puede coincidir con la acción del mundo si el reloj se reanuda en el mismo evento.
- Los paneles no atrapan el tabulador ni se recorren con flechas. El foco visible es irregular.
- La decoración pausa el juego y no se cierra con Escape. Sin mouse, el jugador queda adentro.
- En un monitor horizontal la cocina y varios menús siguen el apilado vertical del celular. No es el trabajo de este paquete.
- No hay zoom cercano/normal/alejado, ni tamaño de interfaz Pequeño/Normal/Grande, ni tooltips de cursor. El texto grande no agranda el HUD de juego.
- No hay un modo de pantalla completa guardado en ajustes.

## 3. Cambios propuestos

### Paquete A — controles, atajos y teclado

Hecho en esta entrega.

- Mapa central en `src/input/bindings.ts`.
- Predeterminados: E interactuar, Enter confirmar, Espacio alternativa (la acción secundaria si hay una al lado; si no, la principal), F secundaria, Escape cerrar, M mapa, J diario, I mochila, R recetario, P NoriPhone.
- WASD y flechas siguen fijos, para no pisar el movimiento ni dejar al jugador sin caminar. La diagonal sigue normalizada.
- El movimiento se bloquea con un modal, un diálogo, la decoración, una transición o el foco en un campo de texto.
- Los atajos no corren mientras se escribe, ni con Ctrl, Alt o Meta, ni mientras hay una ventana, un diálogo, la carta o la intro.
- Escape siempre cierra el modal de arriba y, en decoración, el editor. En exploración libre no abre el teléfono ni pausa el servicio: eso lo hace P, y la pausa al cambiar de aplicación queda en el paquete D. La tecla queda tragada hasta soltarla, así que cerrar una ventana no dispara otra acción.
- Ajustes muestra la lista, permite cambiar cada atajo, avisa si está repetido y restaura los valores. Se guarda en `mm_settings.bindings`, fuera de la partida.
- Con teclado, el botón contextual muestra la tecla. Con mouse, la tecla queda en el `title`. Con el dedo, no se muestra y el joystick vuelve si el ajuste está activo.
- Los paneles se recorren con Tab y flechas, con anillo de foco. Las opciones de diálogo también.
- En decoración, Escape sale, las flechas empujan el mueble fantasma y Tab recorre los botones.

### Paquete B — interfaz horizontal y cocina

Pendiente. Misma lógica de juego. En pantallas anchas: pedidos a la izquierda, mesa de preparación al centro, ingredientes y bandeja a la derecha o abajo. Columnas en inventario, recetario, misiones, mapa, colecciones, amistades, tiendas, mejoras, proyectos y resumen del día. La versión táctil actual se mantiene.

### Paquete C — escalado, zoom, cámara y tooltips

Pendiente. Escala de interfaz Pequeño, Normal y Grande. Zoom cercano, normal y alejado, sin mostrar zonas bloqueadas ni romper colisiones. Tooltips breves, con demora, dentro de la pantalla, también por foco, y no obligatorios en el celular.

### Paquete D — ajustes, multitarea y calidad de vida

Pendiente. Pantalla completa real, pausa explícita al perder el foco, música que no se duplique al volver, confirmación de compras grandes e indicador de guardado. No se agregan opciones que no hagan nada.

### Paquete E — pruebas y correcciones

Pendiente como pase propio. Cada paquete igual corre typecheck, build y las pruebas que toca.

## 4. Archivos

### Paquete A

- Nuevos: `src/input/bindings.ts`, `src/input/keys.ts`, `src/input/shortcuts.ts`, `src/tests/input.test.ts`, `docs/roadmap-pc.md`.
- Ampliados: `src/main.ts`, `src/scenes/WorldScene.ts`, `src/core/types.ts`, `src/core/events.ts`, `src/persistence/storage.ts`, `src/ui/dom.ts`, `src/ui/hud.ts`, `src/ui/settingsPanel.ts`, `src/ui/menus.ts`, `src/ui/styles.css`, `src/ui/hud.css`, `src/dialogue/dialogue.ts`, `src/decoration/editor.ts`.

### Paquetes siguientes, previstos

- B: `src/restaurant/cooking.ts`, `src/restaurant/kitchen.ts`, `src/ui/styles.css`, `src/ui/menus.ts`, `src/ui/recipes.ts`, `src/decoration/editor.ts`.
- C: `src/scenes/WorldScene.ts` (`layout`), `src/core/settings.ts`, `src/ui/hud.css`.
- D: `src/core/flow.ts`, `src/core/appShell.ts`, `src/audio/audio.ts`, `src/systems/time.ts`, `src/ui/settingsPanel.ts`.
- E: `src/tests/` y `e2e/`.

## 5. Riesgos

- Tragar mal una tecla puede dejar el mundo sordo hasta soltarla. Por eso Escape sigue cerrando aunque el mapa esté roto, y perder el foco limpia las teclas tragadas.
- Reasignar Enter o Espacio cambia la confirmación del mundo. El diálogo sigue aceptando esas teclas físicas además del mapa, para no romper la lectura.
- Ocultar el joystick en mouse y teclado cambia la pantalla de PC. En un dispositivo táctil (`pointer: coarse` sin hover) el joystick sigue la preferencia guardada.
- El foco automático de un panel no debe pisar el foco que NoriPhone ya coloca.
- No se tocó la rama `master` ni se reescribieron guardados viejos. Un ajuste sin `bindings` usa los valores nuevos.

## 6. Criterios de aceptación

### Paquete A

- WASD y flechas caminan, también en diagonal, y no mueven la página.
- E interactúa. F usa la otra acción cercana cuando existe. Espacio hace esa otra acción o, si no hay, la principal. Enter confirma.
- M, J, I, R y P abren mapa, diario, mochila, recetario y NoriPhone solo durante la exploración.
- Esos atajos no se disparan al escribir, con un modal abierto, en un diálogo o durante la intro.
- Escape cierra una ventana sin hablar con el mundo y sin pausar el servicio. En decoración, sale del editor. P abre NoriPhone.
- Tab y flechas recorren el panel de arriba. El control enfocado se ve.
- Ajustes lista los atajos, rechaza duplicados, restaura y guarda sin tocar la partida.
- Con teclado se ve la tecla de la acción. Con el dedo no aparece, y el joystick respeta su ajuste.
- La versión táctil conserva el botón contextual y el toque en el suelo.

### Paquetes B a E

Quedan descritos arriba. No se dan por cumplidos.

## 7. Orden

1. Paquete A, esta entrega.
2. Paquete B, cocina y columnas, sin duplicar estado.
3. Paquete C, zoom, escala y tooltips.
4. Paquete D, pantalla completa, pausa al cambiar de aplicación y calidad de vida.
5. Paquete E, regresión de punta a punta en celular y en las resoluciones 1280×720, 1366×768, 1600×900, 1920×1080 y 2560×1440.

## Verificación del paquete A

Revisión de código y pruebas automáticas. No se jugó una sesión manual completa en el navegador, así que el recorrido de cocina, decoración y Alt+Tab en una ventana real queda para el paquete E.

Las pruebas de este paquete cubren el mapa, la diagonal, los duplicados, la escritura en campos, la persistencia de ajustes y el índice de foco. Typecheck, build, pruebas unitarias y e2e se anotan al correrlas.
