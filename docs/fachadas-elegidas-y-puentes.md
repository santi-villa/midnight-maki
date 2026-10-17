# Fachadas elegidas y puentes con barandillas

## Selección del restaurante pendiente de sprites originales

El usuario eligió tres referencias, en este orden:

1. Edificio compacto de tejado oscuro y frontón triangular: primera apariencia.
2. Edificio más alto, con planta superior y balcón de madera: segunda apariencia.
3. Edificio ancho de tejado oscuro, alero curvo y gran frente de ventanas: tercera apariencia y siguientes.

El restaurante seguirá llamándose Midnight Maki. El juego actual tiene cuatro etapas visuales; la propuesta es mantener el tercer modelo en la última con sus mejoras decorativas, sin cambiar los niveles, costes, misiones ni progresión. **La sustitución de las fachadas todavía no está implementada.**

En el entorno solo está `ASSETS DESCARGADOS/vectoraith_tileset_buildings_japanese_traditional_DEMO.zip`: nueve láminas, con dos fachadas pequeñas y accesorios, terrenos y agua en tres escalas. No contiene esas tres fachadas, los barcos ni buena parte de los comercios y accesorios de la lámina completa mostrada en el chat. Las referencias del chat son visibles para seleccionar los modelos, pero no están disponibles como archivos de imagen locales para hacer recortes fieles.

Para completar esta parte hace falta el PNG original del tileset completo o su ZIP. No se presentan reproducciones aproximadas como si fueran recortes originales. Cuando esté disponible, hay que integrar cada fachada manteniendo las puertas y sus interacciones, revisar su espacio visual y alinear las ventanas con la iluminación existente. Seleccionar únicamente accesorios del paquete que encajen con cada zona, sin llenar caminos ni accesos.

## Puentes implementados

- Vuelven los tonos miel y las barandillas con postes, remates claros y travesaños del estilo anterior.
- Los bordes se calculan a partir de las celdas de puente que lindan con agua, no de dos rectángulos superpuestos.
- El muelle en L conserva sus dos giros continuos: el convexo en 36,39 y el cóncavo en 37,40. Las entradas desde tierra y el paso interno permanecen abiertos.
- Las barandillas son sprites estáticos reutilizables, con profundidad para ordenar correctamente al personaje. Se destruyen al cambiar de zona, sin acumular imágenes ni texturas al volver.
- Las colisiones, pesca, interacciones y coordenadas guardadas permanecen iguales.

Archivos: `src/world/bridge.ts`, `src/art/bridges.ts`, `src/scenes/WorldScene.ts`, `src/tests/villageSample.test.ts`.

## Decoraciones disponibles implementadas

El atlas existente incorpora los recortes nativos de la demo de una conífera pequeña, buzón, cartel cubierto y caja de madera. Se utilizan en el buzón, menú exterior y cajas existentes; los arbustos sencillos/floridos pasan a su modelo nativo. Cuatro coníferas pequeñas acompañan casas y jardines de la plaza, playa y jardín. Los grandes árboles y arbustos de bayas conservan sus modelos y funciones. Los faroles de piedra y módulos de casas disponibles ya se utilizaban.

Archivos: `scripts/build-exterior-details.py`, `src/art/cozyFrames.ts`, `src/art/cozyAssets.ts`, `src/assets/cozy-town/`, `src/data/props.ts`, `src/data/outdoorLayout.ts`.

## Verificación

- TypeScript y build: correctos.
- 16 pruebas específicas aprobadas: accesos, caminos sin adornos, guardados, etapas de restauración y continuidad de las barandillas en ambos giros. No se ejecutó la suite completa.
- Chromium/Playwright: el personaje recorre el muelle horizontal y gira hasta el extremo vertical. Capturas en PC (1366×768) y móvil emulado (390×844).
- En la plaza, 27 imágenes de barandilla comparten cinco texturas; al reconstruir la zona sigue habiendo 27 y cinco, sin acumulación.
- Sin errores de página ni reportes del manejador global durante esa comprobación.

Capturas: [muelle en PC](art/puentes-cozy/muelle-giro-pc.png), [muelle en móvil emulado](art/puentes-cozy/muelle-giro-movil.png), [detalles junto a las casas](art/puentes-cozy/barrio-detalles.png).
