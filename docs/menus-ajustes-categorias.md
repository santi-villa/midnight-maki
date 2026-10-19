# Ajustes y navegación (2026-10-19)

- Ajustes separados en Sonido, Juego, Controles, Comodidad y, durante la partida, Partida. Son las mismas opciones y preferencias; no se duplican menús ni se altera el guardado.
- Teclado y atajos en un bloque plegable, cerrado inicialmente con entrada táctil. Tamaños táctiles conservados; pestañas visibles con texto en pantallas pequeñas.
- Personal y Clientes tienen iconos distintos en NoriPhone. Pausa conserva sus accesos existentes.
- El menú inicial recalcula el espacio de la ilustración si cambia el tamaño del texto.
- Verificado: `phoneHome.test.ts` (3 casos); dos E2E nuevos y específicos: categorías/persistencia de ajustes y misión/teléfono/guardado/continuación. Capturas 390×844 inspeccionadas (incluyendo texto grande). Las 2 pruebas E2E de portada de la entrega anterior también pasaron.
- No se ejecutó la suite completa ni se afirmó compatibilidad en teléfono físico. Typecheck y build finales se registran en la nota de optimización del arranque.
