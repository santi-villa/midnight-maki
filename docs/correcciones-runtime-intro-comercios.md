# Correcciones de errores, música de introducción y comercios

Este informe documenta la revisión `06b5ca9`. La llegada posterior al restaurante y las nuevas transiciones sustituyen el cierre hacia la plaza descrito aquí: ver [Inicio, reloj y transiciones](entrada-reloj-transiciones.md).

## Rama y alcance

Se inspeccionaron las ramas remotas antes de editar. `master-mgsshv` y `master` apuntaban a `c82e135b09c3b03d67edaa79dcc03c5455e3e67d`; `main`, `menu-principal` y `feat/rutinas-vivas` no aportaban commits posteriores a esa revisión. El trabajo se hizo en `master-mgsshv`, con commits separados y sin force push.

No se modificaron diálogos, ilustraciones, archivos musicales, mapas, reglas del reloj, iluminación, dependencias ni formato/versionado de las partidas. Las capturas regeneradas por las suites existentes de agua e iluminación se descartaron, conservando los archivos originales.

## 1. Aviso global y guardado

Se reprodujeron dos disparadores del aviso:

- Un fundido de `introAudio.ts` usa `performance.now()` como origen. El timestamp de `requestAnimationFrame` puede precederlo ligeramente. El cociente negativo hacía asignar un volumen negativo a `HTMLMediaElement.volume`; Chromium lanzó una excepción real durante la prueba de navegador. Se acotan tanto el progreso del fundido como el volumen a `[0, 1]`. Una prueba específica usa un timestamp anterior al origen.
- Tras silenciar/reactivar ambientes, un bloqueo de autoplay dejaba el segundo `play()` de un ambiente sin manejador de rechazo. Se reprodujo con dos rechazos `NotAllowedError` simulando restricciones móviles. Todos los intentos pasan ahora por el mismo manejador; las restricciones esperan otro gesto y las capas eliminadas no pueden reaparecer.

Además, la persistencia devolvía `true` después de una escritura fallida, serializaba fuera del bloque protegido y podía limpiar `dirty` aunque el estado hubiera cambiado durante la escritura. Se usan snapshots validados, una cola ordenada de escrituras, confirmación de transacción completa y una revisión de estado en memoria (no se agrega ningún campo a los archivos guardados). Se manejan los abortos, se conserva el progreso pendiente y solo se rotan copias previamente validadas. Se mantienen IndexedDB, fallback local y migraciones existentes.

El guardado manual y «Guardar y salir» confirman éxito únicamente si se guardó. Una importación fallida restaura el estado anterior sin recargar; una importación exitosa detiene el autosave anterior para que `pagehide` no reemplace las coordenadas importadas con las del mundo previo.

Se observaron las promesas de eventos, arranque/continuación, disparadores de zona, regalos, cocina, escenas, recompensas y reanudación/suspensión de audio. Las transiciones liberan su bloqueo mediante `finally`; las tareas diferidas que usan actores o zonas comprueban que sigan vigentes. Las suscripciones de autosave se limpian antes de otro arranque. No se retiró el manejador global ni se agregaron capturas vacías para ocultar fallos. Una escena fallida no se marca como vista.

Los diagnósticos guardan hasta 20 registros locales: operación, tipo de excepción y ubicaciones del código. No guardan mensajes arbitrarios, valores rechazados, contenido de partidas, nombres, tokens ni parámetros de URLs. El aviso amigable sigue existiendo para fallos inesperados; no garantiza falsamente que una escritura haya sido exitosa.

## 2. Música de la introducción

La causa de los cambios musicales era el guion: pedía `town` al preparar la valija, `beach` en el tren y `restaurant_night` al llegar. Las siete escenas solicitan ahora `intro`. La pista comienza desde el gesto de «Comenzar», usa `introduction-music.mp3` en loop y conserva el mismo elemento y posición entre líneas, imágenes y carta.

Lluvia, carta, tren y pasos conservan sus pistas y cues independientes. El cierre normal y el salto limpian los ambientes y hacen un fundido hacia `town`, la música de la plaza. Los archivos ilegibles usan la música generada; una restricción de autoplay reintenta la misma canción al siguiente gesto y no se trata como archivo defectuoso. Silenciar cancela fundidos programados y no permite que vuelvan a subir el volumen. La música generada queda silenciada mientras suena una canción personalizada.

## 3. Indicadores comerciales

Los carteles anteriores dibujaban texto Phaser de 16 píxeles lógicos con el horario completo, incluso con el negocio abierto. Se reemplazaron por placas de madera de hasta **29 × 11 píxeles lógicos**, con tipografía pixel art existente: `CERRADO`, `PRONTO` o `CIERRA`. No hay placa si está abierto. Se colocan sobre la fachada, fuera de puertas, caminos, toldos, macetas y demás props; dentro se montan sobre la pared junto a la salida.

El horario completo aparece al entrar/interactuar o abrir el comercio. Entrar a un edificio cerrado comercialmente sigue permitido; el mensaje distingue expresamente acceso físico y atención del mostrador.

`shopGate()` sigue siendo la fuente común de estado para indicadores y operaciones. Compras, ventas y saludos vuelven a validar atención después de operaciones asíncronas y antes de mutar inventario o monedas. Los menús abiertos actualizan estado y botones cuando cambia el horario o una excepción narrativa. El alias antiguo `mika` utiliza el mismo gate que `sumi`. Se conservan festivales, desplazamientos narrativos, flags de apertura/cierre y reglas especiales del mercado nocturno.

## Archivos modificados

| Área | Archivos |
| --- | --- |
| Diagnóstico, eventos y ciclo de partida | `src/core/errors.ts`, `src/core/events.ts`, `src/core/flow.ts`, `src/core/state.ts`, `src/main.ts` |
| Guardado y UI | `src/persistence/storage.ts`, `src/ui/title.ts`, `src/ui/menus.ts`, `src/ui/settingsPanel.ts` |
| Límites asíncronos | `src/dialogue/dialogue.ts`, `src/quests/quests.ts`, `src/systems/actions.ts`, `src/story/story.ts` |
| Audio e introducción | `src/audio/audio.ts`, `src/story/intro.ts`, `src/story/introAudio.ts`, `src/story/introScript.ts` |
| Indicadores y atención | `src/scenes/WorldScene.ts`, `src/scenes/textures.ts`, `src/systems/npcs.ts`, `src/systems/schedule.ts`, `src/ui/shops.ts` |
| Pruebas unitarias | `src/tests/errors.test.ts`, `src/tests/storage.test.ts`, `src/tests/introAudio.test.ts`, `src/tests/intro.test.ts`, `src/tests/schedule.test.ts` |
| Navegador | `e2e/resilience.spec.ts`, `e2e/intro-music.spec.ts`, `e2e/shops.spec.ts` |
| Informe | `docs/correcciones-runtime-intro-comercios.md` |

## Validación

- `npm test`: **169 pruebas, 21 archivos, todas aprobadas** en la revisión final.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado; conserva advertencias no bloqueantes de Vite sobre módulos importados tanto estática como dinámicamente.
- `CHROME=/usr/bin/chromium npm run e2e -- --workers=2`: **32 pruebas aprobadas**, incluidas cocina/guardado, introducción, clientes, movimiento, horarios, iluminación, agua y título.
- Después de ajustar la ubicación final de las placas y la importación: `CHROME=/usr/bin/chromium npm run e2e -- e2e/shops.spec.ts e2e/resilience.spec.ts --workers=2`: **6 pruebas aprobadas**. Incluye una nueva prueba de guardado manual/importación. Es una revalidación específica posterior, no una segunda ejecución de toda la suite.
- Smoke test del build de producción servido por `vite preview`: HTTP 200, archivo MP3 emitido en `assets`, loop de intro, salto a `town`, round-trip en IndexedDB y cero errores JavaScript.
- El loop se verificó con el archivo real, avanzando cerca del final y observando su regreso al comienzo; la identidad del elemento y la posición se verificaron durante las siete escenas y la carta. Se verificaron silencio, salto, fallback por 404 y reintento tras autoplay denegado.
- Bento, Taro y Yuki se verificaron en preparación, mañana, tarde, cierre, atardecer y noche. Las pruebas comprueban placas ausentes al abrir, tamaño, capas de dibujo, separación de puertas/props, apertura de menús, rechazo de compras/ventas pendientes y reapertura.
- IndexedDB real: aborto de transacción, conservación del último guardado, reintento y recuperación tras recargar. Pruebas adicionales: cuota agotada, snapshot no serializable, cola concurrente, estado modificado durante escritura, reemplazo de partida en curso y recuperación desde backup.

## Límites y diagnóstico si reaparece

El navegador usado fue Chromium con el perfil móvil Pixel 7. No se probó en Safari/iOS ni en un dispositivo Android físico. No se recibió la partida histórica ni el registro del dispositivo que originó el aviso: los disparadores anteriores fueron reproducidos, pero no establecen que fueran el único error de aquella sesión.

Si vuelve a aparecer, abrir el juego con `?debug`, reproducirlo y consultar `window.mmDebug.errorReports()` antes de recargar. Esos registros permiten identificar la operación y la ubicación sin compartir partidas ni códigos de backup. Para examinar el error original en el dispositivo, usar el depurador del navegador con pausa en excepciones, evitando compartir datos personales o parámetros de URLs.
