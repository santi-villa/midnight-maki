# Correcciones de plaza, introducción y arranque

Se trabajó sobre `master-mgsshv`. Antes de editar se incorporaron por fast-forward los tres commits nuevos de personalización de Sofi y Santiago, hasta `159394f`; se conservan esos cambios. Las correcciones se separan en arranque/iluminación, introducción/encuentro y vida de la plaza.

## Causas y correcciones

| Punto | Causa identificada | Corrección |
| --- | --- | --- |
| Titileo junto a la fuente | El flicker cambiaba el radio de las máscaras que quitan oscuridad y colorean el suelo. Donde se superponen luces, aparecían y desaparecían manchas grandes de color claro. | Radios estables en máscaras y halos; se conserva la variación suave de intensidad, los colores por período, lluvia, estaciones y reloj. |
| Menú anterior durante el arranque | La pantalla de carga se retiraba antes de cargar la ilustración del título. Además, la nueva capa comenzaba transparente y dejaba ver la escena Phaser anterior. | Se espera la imagen cargada, o un error real, antes de retirar el loader. El fondo del título es opaco desde el inicio. El fallback sigue disponible si falta el archivo. |
| Imágenes que cambiaban de tamaño | Imagen y texto participaban en el mismo layout vertical; reglas CSS posteriores volvían a poner el texto en el flujo en horizontal. | Imagen en un marco fijo de pantalla y texto superpuesto dentro de ella, con pergamino, marco de madera y tipografía pixel art existentes. Se eliminan las reglas contradictorias. |
| Falta de caída del frasco de Pip | El encuentro había quedado ligado a hablar manualmente con Spicy, después de la intro. | El encuentro original empieza automáticamente al completar o saltar las siete imágenes. Se conserva toda la escena del frasco, sonidos, diálogos y elección. |
| Gato caminando de espaldas | El sprite del gato mira a la izquierda, pero se espejaba con la regla de los pájaros, que miran a la derecha. | Se corrige el espejo horizontal del gato en ambos sentidos, conservando colisiones, velocidad y frames. |
| Vecinos quietos en la plaza | Algunas rutinas no tenían actividad o usaban `look`; las poses sentadas tampoco colocaban a los vecinos sobre los bancos. | Yuki, Taro y Ume usan posiciones de los bancos existentes. Se utiliza una casilla libre delante y un ajuste visual de 12 píxeles lógicos. Los demás vecinos mantienen lectura, trabajo, juego y otras tareas, incluidas las esperas antes de salir. |
| Globos superpuestos | Los globos se ubicaban independientemente sobre cada actor y podían coexistir con el fundido de un globo previo. | Cada turno limpia el globo anterior y su tween. Los globos simultáneos se separan dentro de la cámara con un espacio mínimo; los vecinos sentados pueden conversar sin abandonar su banco. |

En la reproducción junto a la fuente el período permaneció en **atardecer**: no se observó un cambio real del reloj hacia el día o la noche. Se compararon 24 capturas con el reloj pausado, en una región de 350 × 330 píxeles de la plaza. La diferencia entre brillo medio máximo y mínimo bajó de **7,64** a **0,06** niveles sobre una escala de 0–255 al estabilizar los radios. La prueba de regresión vuelve a medir capturas reales y comprueba que el período y el tinte ambiental se mantengan.

La intro conserva los archivos de ilustraciones, texto y música. El encuadre se adapta a la pantalla y centra la imagen; las líneas ya no modifican su tamaño. La carta sigue siendo un diálogo independiente. La escena automática de Pip se protege contra llamadas duplicadas y solo confirma el encuentro tras completar la escena. Quedan pendientes la lección de Spicy, preparar sushi, Taro, decorar y descansar. Los seis índices del prólogo y el formato del guardado permanecen compatibles. Una partida antigua en la plaza conserva su ubicación y puede continuar el encuentro al entrar al restaurante; un encuentro terminado no se repite.

Las rutinas mantienen zonas, turnos comerciales, rutas de salida, clima, festivales y colocaciones narrativas explícitas. No se alteran diseños de edificios ni se añaden bancos. Las posiciones lógicas siguen fuera de los props sólidos.

## Corrección adicional encontrada en las regresiones

La primera ejecución completa detectó que, bajo carga, el timeout de una transición podía resolver antes de que el compositor terminara de cerrar ambos paneles. El estado decía `covered`, pero la geometría todavía dejaba una pequeña zona sin cubrir. Se fuerza el estado final de ambos paneles antes de montar el escenario. Esto mantiene la apertura animada y la espera por el render del destino.

Se añadió una prueba que simula una transición de 900 ms y comprueba que el fallback del plazo cubra toda la pantalla, retire el overlay y devuelva el control. Después del ajuste pasaron las diez pruebas específicas de transiciones y plaza. No se agregan esperas artificiales ni se amplían las animaciones normales.

## Archivos modificados

| Área | Archivos |
| --- | --- |
| Arranque y presentación | `src/ui/title.ts`, `src/ui/styles.css` |
| Iluminación, gato, vecinos y globos | `src/scenes/WorldScene.ts`, `src/entities/Actor.ts`, `src/data/characters.ts`, `src/systems/npcs.ts`, `src/ui/speechLayout.ts` |
| Introducción y escena automática | `src/story/intro.ts`, `src/story/story.ts`, `src/core/flow.ts` |
| Cobertura de transiciones | `src/ui/dom.ts`, `src/ui/styles.css` |
| Unitarias | `src/tests/speechLayout.test.ts`, `src/tests/schedule.test.ts` |
| Nuevas E2E y helper de encuentro | `e2e/plaza-experience.spec.ts`, `e2e/helpers/arrival.ts` |
| E2E ampliadas | `e2e/boot.spec.ts`, `e2e/intro.spec.ts`, `e2e/arrival.spec.ts`, `e2e/town-life.spec.ts`, `e2e/transitions.spec.ts` |
| E2E adaptadas al encuentro automático | `e2e/hours.spec.ts`, `e2e/hud-clock.spec.ts`, `e2e/intro-music.spec.ts`, `e2e/light.spec.ts`, `e2e/newgame.spec.ts`, `e2e/resilience.spec.ts`, `e2e/shops.spec.ts`, `e2e/title.spec.ts`, `e2e/water.spec.ts` |

## Verificación

- `npm test`: **199 pruebas aprobadas en 26 archivos**.
- `npm run typecheck`: aprobado, también después del ajuste de cobertura.
- `npm run build`: aprobado, también después del ajuste de cobertura. Se conservan los avisos no bloqueantes de Vite sobre módulos importados estática y dinámicamente.
- `CHROME=/usr/bin/chromium npm run e2e -- --workers=2`: **54 pruebas aprobadas**, sin reintentos, en 6,9 minutos, en la ejecución completa posterior a corregir la cobertura.
- `CHROME=/usr/bin/chromium npm run e2e -- e2e/transitions.spec.ts e2e/plaza-experience.spec.ts --workers=2`: **10 aprobadas** después de corregir la cobertura.
- Producción con `vite preview`: nueva partida, salto, encuentro automático, restaurante/plaza/Taro, hora analógica y digital sincronizadas, guardado IndexedDB y continuación. Aprobado en **390 × 844** y **1280 × 720**, con cero errores JavaScript; la lección de sushi sigue pendiente.
- Revisión visual de texto sobre ilustraciones, bancos y globos en PC y celular. La geometría del texto se verifica a **320 × 740** y **1280 × 720**; bancos y globos a **390 × 844** y **1280 × 720**.
- La suite incluye intro completa con siete imágenes, carta, música y fallback; escena automática tras salto y cierre normal; guardados anteriores; cocina; horarios comerciales; vecinos y clientes; movimiento reducido; fallos de guardado y carga; agua e iluminación.

Durante la preparación se identificó un servidor Vite anterior con módulos duplicados por HMR: el test importaba una instancia de servicio distinta de la usada por el mundo. Se confirmó comparando ambas funciones e instancias, se detuvo el servidor de esta tarea y las pruebas de clientes pasaron con un servidor limpio. No fue necesario cambiar el servicio del juego.

No se modifica la velocidad del reloj, las estaciones, los archivos musicales, las ilustraciones ni la personalización reciente. Las capturas históricas de agua e iluminación regeneradas por tests se restauran antes del commit.

## Límites

Las verificaciones móviles usan Chromium emulado; no se probaron Safari/iOS ni teléfonos físicos. No se reprodujo una oscilación real del período del reloj. Si aparece junto al titileo en un dispositivo, registrar la hora y el período de `window.mmDebug.clock.period` con `?debug` permitirá distinguir un cambio de tiempo de uno visual.
