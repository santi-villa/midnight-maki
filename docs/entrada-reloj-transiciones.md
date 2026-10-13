# Inicio dentro del restaurante, reloj y transiciones

Este informe describe la revisión `b49496f`. El encuentro con Pip ahora se reproduce automáticamente al terminar o saltar la intro, y se refuerza la cobertura de los paneles bajo carga: ver [Correcciones de plaza, intro y arranque](plaza-intro-arranque.md).

## Rama y alcance

Antes de modificar archivos se inspeccionaron las ramas. `master-mgsshv`, en `06b5ca9`, contenía las correcciones más recientes y estaba por delante de `master` y `main`. Las mejoras se realizaron en tres etapas con commits independientes. Antes de publicar se volvió a consultar el remoto: no había cambios nuevos que integrar.

Se conservan las siete imágenes, diálogos y secuencia de la introducción; las canciones personalizadas y sus archivos; la velocidad y reglas del reloj; las estaciones y el cálculo de iluminación. No cambia el formato de guardado. Se restauraron las capturas de agua e iluminación que las suites existentes regeneran para evitar cambios ajenos a estas tareas.

## 1. Llegada y prólogo

La introducción terminaba colocando a Sofi en la plaza y el prólogo dependía de entrar al restaurante. Ahora tanto completar la historia como saltarla desembocan en la entrada interior de Midnight Maki: casilla `(8, 12)`, libre de colisiones, mirando hacia arriba. La puerta de la plaza reutiliza esa misma definición. La música cambia suavemente a la pista del restaurante correspondiente al período; el HUD aparece después de abrirse la transición y se libera el movimiento.

El primer objetivo es hablar con Spicy Beacon y conocer a los mapaches. El encuentro conserva sus diálogos y comienza al hablar con Spicy, permitiendo explorar antes. Una segunda conversación inicia la enseñanza de cocina. Se mantienen los seis pasos e índices del prólogo, sus flags y los siguientes objetivos: preparar sushi, visitar a Taro, decorar la habitación y descansar. Ver o saltar la intro no completa el encuentro ni todo el prólogo.

Continuar una partida existente respeta su zona, coordenadas y progreso. Una prueba carga un guardado previo situado en la plaza, conserva su prólogo pendiente y permite entrar al restaurante sin completar objetivos automáticamente.

## 2. Reloj del HUD

El reloj analógico permanece en la tarjeta de madera y suma una hora digital `HH:MM`. Ambos reciben el mismo minuto calculado desde el período y el progreso del reloj existente; no se agrega otro contador ni se modifica la velocidad. El cálculo utiliza `BALANCE.periodMinutes`, normaliza valores inválidos y envuelve el formato al llegar a medianoche.

Se conservan período, fecha y monedas. Contraer la tarjeta oculta fecha y monedas, dejando visibles ambos relojes. Tipografía pixel art, tamaños y espaciado se adaptan a pantallas pequeñas y horizontales. Las pruebas verifican la sincronización, el paso de `23:59` a `00:00`, el nuevo día y que pausar el juego detenga el avance.

## 3. Carga inicial y cambio de escenario

La carga inicial muestra una ventana japonesa oscura, un farol pixel art animado, el nombre del juego y mensajes breves. Se eliminó la barra decorativa que aparentaba medir progreso. El menú se monta antes de retirar la pantalla con un fundido corto; no hay una espera artificial. Se respeta movimiento reducido.

Entrar o salir de interiores cierra dos paneles negros desde los lados, monta el destino con la pantalla cubierta y espera dos eventos reales `POST_RENDER` de Phaser antes de abrir. Cada movimiento dura 240 ms: aproximadamente 480 ms más el render del destino. El plazo de recuperación del render no cuenta mientras el navegador está oculto. Las regiones exteriores mantienen un fundido y se elimina la pausa fija de 420 ms del sistema anterior.

El bloqueo cubre toda la operación, rechaza entradas duplicadas y libera controles y overlays en `finally`. Se valida y prepara el destino antes de destruir el escenario anterior. Si una decoración ocupa la casilla prevista, se busca una casilla libre cercana evitando salidas automáticas. Un error al montar/renderizar intenta restaurar el escenario y posición anteriores y se propaga al registro de errores existente. Si falla la primera llegada, el flujo regresa al menú y permite empezar otra vez.

Movimiento reducido, tanto en ajustes como en la preferencia del navegador, utiliza una cobertura sencilla sin paneles deslizantes. La animación normal solo transforma dos elementos DOM; no agrega redibujados al mundo ni modifica iluminación o colisiones existentes.

La biblioteca era una interacción exterior sin interior. Para incluir su entrada y salida se añadió una habitación pequeña con estantes, mesa, bancos y faroles usando el renderer y materiales existentes. Se conserva la lectura y la misión del libro de Rigg, adaptando su objetivo de navegación al interior. El mapa sigue indicando la plaza y las partidas pueden guardar y continuar dentro de la biblioteca.

## Archivos modificados

| Área | Archivos |
| --- | --- |
| Llegada y prólogo | `src/story/intro.ts`, `src/story/story.ts`, `src/data/zones.ts` |
| Hora digital | `src/ui/hud.ts`, `src/ui/hudClock.ts`, `src/ui/hud.css` |
| Carga y transiciones | `index.html`, `src/ui/dom.ts`, `src/ui/styles.css`, `src/ui/title.ts`, `src/scenes/BootScene.ts`, `src/scenes/WorldScene.ts`, `src/core/flow.ts`, `src/world/zoneTransition.ts` |
| Biblioteca e integración | `src/data/props.ts`, `src/data/zones.ts`, `src/quests/side.ts`, `src/ui/worldmap.ts` |
| Pruebas unitarias nuevas | `src/tests/prologue.test.ts`, `src/tests/hudClock.test.ts`, `src/tests/zoneTransition.test.ts` |
| E2E nuevas | `e2e/arrival.spec.ts`, `e2e/hud-clock.spec.ts`, `e2e/boot.spec.ts`, `e2e/transitions.spec.ts` |
| E2E adaptadas al nuevo inicio | `e2e/newgame.spec.ts`, `e2e/hours.spec.ts`, `e2e/intro.spec.ts`, `e2e/intro-music.spec.ts`, `e2e/resilience.spec.ts`, `e2e/shops.spec.ts`, `e2e/title.spec.ts`, `e2e/light.spec.ts`, `e2e/water.spec.ts` |
| Documentación | `docs/entrada-reloj-transiciones.md`, nota histórica en `docs/correcciones-runtime-intro-comercios.md` |

## Validación final

- `npm test`: **192 pruebas aprobadas en 24 archivos**.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado. Vite mantiene avisos sobre módulos importados estática y dinámicamente; no impiden generar el build.
- `CHROME=/usr/bin/chromium npm run e2e -- --workers=2`: **46 pruebas aprobadas**, sin reintentos, en 4,2 minutos.
- Build de producción servido con `vite preview`: partida nueva con salto de intro, restaurante con orientación y música correctas, recorrido restaurante/plaza/Taro, hora digital sincronizada, guardado IndexedDB, recarga y continuación. Aprobado en **390 × 844** y **1280 × 720**, con **cero errores JavaScript**.
- Revisión visual de capturas de carga inicial en PC y celular, reloj a 320 px y biblioteca móvil. Comprobaciones geométricas del HUD también en **320 × 740**, **390 × 844**, **844 × 390** y **1280 × 720**: relojes y botones dentro de pantalla, sin superposición entre sí.
- Intro completa: las siete imágenes y carta conservan la misma canción en loop, sin reinicios ni superposición; el cierre llega al restaurante. Se mantienen las pruebas de salto, silencio, fallback de archivo ausente y restricciones de autoplay.
- Entradas/salidas físicas en PC y celular: restaurante, Bento, Taro, Yuki, biblioteca, casa y depósito. Se comprueba cobertura negra completa al montar, controles bloqueados, casilla libre, orientación y dos frames del destino antes de abrir.
- Fallos inyectados: carga/render de un destino, llegada inicial y solicitud duplicada. Se verifican restauración de posición, guardado válido, overlays retirados, control recuperado y posibilidad de volver a empezar.
- Biblioteca: lectura del libro de Rigg, flag conservado, ubicación en el mapa, guardado dentro del interior, recarga y salida.
- La suite completa conserva además verificaciones de cocina, horarios comerciales, vecinos, importación/guardado, agua, iluminación y menú principal.

## Límites

Se utilizó Chromium de escritorio con viewport y perfil móvil emulados. No se verificó Safari/iOS ni un teléfono físico; tampoco se hizo un benchmark de rendimiento en hardware móvil. No quedan fallos conocidos en las pruebas ejecutadas. Las correcciones previas de errores, música y comercios siguen documentadas en su informe histórico.
