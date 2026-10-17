# Fachadas elegidas y puentes con barandillas

## Fachadas del restaurante incorporadas

Se utiliza la lámina PNG enviada posteriormente dentro de `Imagen de ChatGPT 17 oct 2026, 01_34_44.zip`, conservada en `art-source/village/lamina-aportada.png`. El archivo tiene 1013×1181 píxeles y transparencia; empaquetarlo no aumenta su calidad, pero permite acceder a sus píxeles en el entorno y recortarlos de forma reproducible.

| Etapa visual existente | Nivel | Referencia elegida |
| --- | --- | --- |
| Heredado | 1–2 | Primera: edificio compacto de tejado oscuro y frontón triangular |
| Recuperado | 3–4 | Segunda: edificio con planta superior y balcón de madera |
| Popular | 5–7 | Tercera: edificio ancho de tejado oscuro y alero curvo |
| Corazón de Villa Nori | 8 en adelante | Tercera, con guirnalda y tres estrellas decorativas |

El restaurante sigue llamándose Midnight Maki. Se mantienen niveles, costes, misiones, puertas, huellas de colisión y posiciones guardadas. Los recortes se ajustan con escala uniforme y sin suavizado adicional. El nombre y los faroles acompañan la fachada. Las máscaras de ventanas siguen la geometría de cada modelo; las puertas de madera/cortinas no emiten un rectángulo de luz sobre el personaje. Los faroles conservan el sistema de iluminación de la entrada.

`scripts/build-village-assets.py` genera un atlas de 512×256 con 18 piezas. `src/assets/village/catalog.json` registra rectángulos, hash de la imagen fuente, puertas y ventanas. La lámina completa no se precarga. Si el atlas no carga, el renderizador conserva la apariencia anterior.

Archivos: `src/art/restaurantFacade.ts`, `src/art/villageAssets.ts`, `src/scenes/BootScene.ts`, `src/scenes/textures.ts`, `src/scenes/WorldScene.ts`.

## Puentes implementados

- Vuelven los tonos miel y las barandillas con postes, remates claros y travesaños del estilo anterior.
- Los bordes se calculan a partir de las celdas de puente que lindan con agua, no de dos rectángulos superpuestos.
- El muelle en L conserva sus dos giros continuos: el convexo en 36,39 y el cóncavo en 37,40. Las entradas desde tierra y el paso interno permanecen abiertos.
- Las barandillas son sprites estáticos reutilizables, con profundidad para ordenar correctamente al personaje. Se destruyen al cambiar de zona, sin acumular imágenes ni texturas al volver.
- Las colisiones, pesca, interacciones y coordenadas guardadas permanecen iguales.

Archivos: `src/world/bridge.ts`, `src/art/bridges.ts`, `src/scenes/WorldScene.ts`, `src/tests/villageSample.test.ts`.

## Decoraciones incorporadas

Los botes, dos arbustos tipo bonsái, faroles de papel y piedra, guirnalda, puesto/soporte de madera, barriles, secadero de pescado, mesa con redes y cajas de pescado usan recortes de la lámina aportada. Los puestos de mercado usan sus fachadas pequeñas de tres colores. Se conservan los contenidos y acciones de cada vendedor.

Se sustituyen gráficos de objetos existentes. Algunos botes pasan a la variante con cuerda y dos cajas costeras al modelo de pescado, en las mismas coordenadas y con las mismas huellas. Las decoraciones permanecen fuera de los caminos. Se mantienen los modelos de bayas y objetos especializados sin equivalente adecuado.

La demo sigue aportando buzón, cajas y coníferas pequeñas. Sus cuatro coníferas decorativas acompañan casas y jardines de la plaza, playa y jardín. Los grandes árboles conservan sus modelos. Las casas existentes mantienen sus puertas laterales y su ensamblado, ya basado en esa familia de assets: no se superponen edificios de referencia sobre sus accesos.

Archivos: `src/art/villageAssets.ts`, `src/assets/village/`, `src/data/props.ts`, `src/data/outdoorLayout.ts`; para las piezas de la demo, `scripts/build-exterior-details.py`, `src/art/cozyFrames.ts`, `src/art/cozyAssets.ts` y `src/assets/cozy-town/`.

## Verificación

- TypeScript y build: correctos.
- 16 pruebas específicas aprobadas: accesos, caminos sin adornos, guardados, etapas de restauración y continuidad de las barandillas en ambos giros. No se ejecutó la suite completa.
- Chromium/Playwright: el personaje recorre el muelle horizontal y gira hasta el extremo vertical. Capturas en PC (1366×768) y móvil emulado (390×844).
- En la plaza, 27 imágenes de barandilla comparten cinco texturas; al reconstruir la zona sigue habiendo 27 y cinco, sin acumulación.
- Sin errores de página ni reportes del manejador global durante esa comprobación.

Capturas: [muelle en PC](art/puentes-cozy/muelle-giro-pc.png), [muelle en móvil emulado](art/puentes-cozy/muelle-giro-movil.png), [detalles junto a las casas](art/puentes-cozy/barrio-detalles.png).

## Verificación de la lámina completa

- Typecheck y build correctos.
- 18 pruebas específicas aprobadas: accesos, carreteras, proyectos, giros de puente, orden de las tres fachadas y alineación de sus puertas y ventanas. No se ejecutó la suite completa.
- Chromium/Playwright: entrada y salida del restaurante en niveles 1, 3, 5 y 8; revisión visual diurna, nocturna y en 390×844 (móvil emulado), además de PC 1366×768.
- La máscara emisiva de la puerta tiene alfa cero; las ventanas conservan sus máscaras por etapa.
- Arranque y selección del fallback comprobados bloqueando la carga del atlas: el menú aparece y el renderizador devuelve el control al dibujo anterior.
- Guardar y leer conserva decoración, monedas, inventario y misiones. No aparecieron errores de página ni reportes globales durante la comprobación.
- Se preservaron los cambios de pesca, audio y nube recibidos en `8f40fea` antes de empezar esta integración.

Capturas actuales: [primera fachada](art/fachadas-elegidas/restaurante-nivel-1.png), [segunda](art/fachadas-elegidas/restaurante-nivel-3.png), [tercera](art/fachadas-elegidas/restaurante-nivel-5.png), [última etapa](art/fachadas-elegidas/restaurante-nivel-8.png), [noche](art/fachadas-elegidas/restaurante-noche.png), [móvil emulado](art/fachadas-elegidas/restaurante-movil.png), [muelle](art/fachadas-elegidas/detalles-plaza.png), [puestos](art/fachadas-elegidas/detalles-market.png), [botes y pesca](art/fachadas-elegidas/detalles-beach.png).

[Vista comparativa de las cuatro etapas, generada con el renderizador del juego](art/fachadas-elegidas/evolucion.png).
