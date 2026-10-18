# Etapa 1 — Luz y noche

Se trabaja sobre `master-mgsshv`, incorporando primero los avances remotos de horarios, mascotas y huerta. No se implementan aquí las etapas 0 ni 2–4.

## Cambios

- Noche exterior azul más oscura, con transición continua desde el atardecer, también bajo lluvia. Se acorta el alcance de los faroles y se elimina el relleno artificial de luces en cuadrícula de los interiores; se conservan sus luces de objetos y ventanas y su ambiente cálido.
- Sofi conserva una pequeña luz de orientación. Flecha de misión y placas comerciales se dibujan encima de la oscuridad.
- Ajustes → Pantalla y comodidad → **Noche: Normal / Oscura**. Solo afecta el exterior al anochecer; no cambia velocidad del reloj, estaciones ni interiores. `nightBrightness` es opcional, vive en `mm_settings` y usa Normal si falta o es inválido. No se cambia el formato de las partidas.
- Encendido gradual con umbrales diferentes por posición. La intensidad del círculo de luz ahora parte de cero, en vez de aparecer ya iluminado al empezar a encenderse.
- Faroles de calle estables; luces de llama y papel con ruido interpolado irregular y alguna interrupción breve. La animación modifica exclusivamente los halos aditivos. Su iluminación base queda en la textura pequeña de oscuridad, sin repintarla por titileo. Ahorro de batería y movimiento reducido conservan luces estáticas sin halos.
- Ventanas de viviendas y su luz sobre el suelo se apagan por casa, progresivamente entre las 22:00 y las 00:21. Es una decisión visual provisional, sin simular todavía el sueño ni mover vecinos: la etapa 3 las conectará con los horarios personales. Locales y restaurante conservan sus horarios existentes.
- Caché de oscuridad por cámara, dimensiones, posición de Sofi, color ambiental e intensidades de las fuentes. Una escena quieta con el reloj detenido no se redibuja aunque sus halos estén animados.

## Verificación

- `npx tsc --noEmit`: aprobado.
- `npx vitest run src/tests/light.test.ts`: 29 pruebas aprobadas (color, continuidad entre períodos, lluvia, brillo opcional, encendido gradual, ruido/fallas, ventanas, oclusión y círculos de luz).
- `CHROME=/usr/bin/chromium npx playwright test e2e/light.spec.ts --workers=1`: seis casos verificados. Cinco pasaron en la primera corrida; el de fachada/interior se interrumpió por una recarga de Vite durante un ajuste de desarrollo y pasó al repetirlo aisladamente. Se repitió también el caso de ajustes/capturas tras quitar el aviso de movimiento de las imágenes y agregar la comprobación del encendido escalonado.
- En modo alto, con reloj detenido y sin mover a Sofi: **cero redibujos adicionales de oscuridad durante 800 ms**, con halos que sí cambian de intensidad. Moverla invalida correctamente su círculo de luz. Ahorro de batería y movimiento reducido también mantienen la capa quieta.
- Ajuste probado con botones reales y lectura posterior de `mm_settings` mediante `loadSettings()`. Las preferencias antiguas sin el campo nuevo arrancan en Normal. La escena de ajustes/visitas no produjo errores de página.
- Capturas Playwright inspeccionadas en Chromium headless a 1280×800, `/?debug`, con `perf: 'high'`: plaza, jardín, restaurante, encendido al atardecer, opciones Normal/Oscura a la misma hora y Ajustes. Se conservaron en `docs/art/luces/etapa-1/`.

No se ejecutó la suite completa ni se probó en un teléfono físico. La conexión de ventanas con el sueño y desplazamiento de los vecinos queda para la etapa 3.

## Cómo verlo

Abrir `/?debug` con `perf: 'high'` en `mm_settings`. Iniciar partida o continuar y, con `window.mmDebug`, colocar el reloj de noche y visitar plaza, jardín y restaurante. Comparar ambas opciones de Noche desde Ajustes. Detener el reloj, dejar quieta a Sofi y comprobar que `world.lightRedraws` permanece constante mientras cambian los halos. Moverla debe volver a actualizar su luz.

Capturas de referencia: `docs/art/luces/etapa-1/`.
