# Conexiones de caminos, giro del muelle y muebles anteriores

## Correcciones

- Las seis zonas exteriores tienen accesos conectados por caminos transitables, incluyendo las puertas de las casas, las escaleras de la terraza este, el jardín y los dos pasillos del mercado. Se conservan las identidades de las casas y sus puertas interiores.
- Faroles, bancos, macetas, cajas, flores y puntos de recolección quedan fuera de las calles. Se revisan también la lluvia y las decoraciones que aparecen al completar restauraciones. La fuente conserva su lugar como elemento central de la plaza.
- Puentes y muelles eligen bordes y esquinas del autotile nativo de madera de VectoRaith según las ocho celdas vecinas. Se retiran las superposiciones rectas que atravesaban el giro del muelle en L. La colisión sigue dependiendo del terreno existente.
- Los gráficos antiguos de 36 muebles y cuatro objetos fijos tienen sustituciones de Bitglow. Incluye camas, futones, roperos, bibliotecas, escritorios, mesas, sillas, alfombras y luces. El cambio se aplica a los objetos ya colocados, a sus vistas en tiendas y al editor. Los objetos narrativos sin equivalente conservan su arte.

No cambian los diálogos, el tiempo, la iluminación ni los sistemas online.

## Guardados

No se renombra ningún ID de mueble, casa, proyecto o zona. Se conservan las huellas lógicas de los muebles anteriores, compras, monedas y ubicaciones. La altura visual de los roperos aumenta; no su colisión. Los puntos de recolección cambian de coordenadas, manteniendo el orden y los grupos de objetos que se usan para identificar lo ya recogido cada día.

## Archivos principales

- `src/data/outdoorLayout.ts`, `plazaEast.ts`, `plazaMap.ts`, `zones.ts`, `projects.ts`: calles, accesos y colocación de objetos.
- `src/world/bridge.ts`, `src/art/bridges.ts`, `src/art/tiles.ts`, `src/world/zoneRuntime.ts`, `src/scenes/BootScene.ts`: conexión y dibujo de puentes.
- `scripts/build-bridge-assets.py`, `src/assets/bridges/`: extracción nativa reproducible y procedencia.
- `src/art/interiorReplacements.ts`, `src/art/interiors.ts`, `src/scenes/textures.ts`, `src/data/furniture.ts`: sustitución visual de los IDs anteriores.
- `scripts/build-interior-assets.py`, `src/assets/interiors/`: futones, escritorios y vistas laterales de mesas; catálogo de 178 piezas y 208 recortes.
- `src/tests/outdoorLayout.test.ts`, `villageSample.test.ts`: regresiones de accesibilidad y paso libre.

## Cómo comprobarlo

1. Continuar una partida con los muebles iniciales: la cama, el ropero y las bibliotecas ya muestran los modelos nuevos, sin comprar otros.
2. Recorrer las calles de Villa Nori hasta las casas, comercios y biblioteca; entrar y salir de sus puertas. Revisar las escaleras del este y el recorrido del jardín.
3. Bajar al puerto y caminar por el muelle desde el tramo horizontal hacia el vertical: la esquina continúa la superficie y ningún adorno bloquea el paso.
4. Visitar el mercado y revisar ambos pasillos. En una partida con proyectos terminados, revisar también las flores y recolecciones nuevas.
5. Guardar y volver a abrir: los muebles conservan su identidad, posición y orientación.

## Verificación de esta entrega

- `npm run typecheck`: correcto.
- `npm run build`: correcto. Vite mantiene avisos sobre módulos importados tanto estática como dinámicamente; no impiden generar la aplicación.
- `npx vitest run src/tests/outdoorLayout.test.ts src/tests/villageSample.test.ts`: **15 pruebas aprobadas**. No se ejecutó la suite completa, según la preferencia del usuario.
- Chromium/Playwright: renderizado real de las seis zonas exteriores y de la habitación en 1366×768 y 390×844; atlas de interiores y puentes cargados, 40 equivalencias sin destinos faltantes.
- Recorridos de personaje en navegador: entrada y salida de tres casas con puertas de distintos tipos, Taro, Bento, Yuki y biblioteca; giro completo del muelle hasta su extremo vertical.
- Escritura y lectura de IndexedDB: mismos muebles, IDs, coordenadas, orientaciones, monedas e inventario. Sin errores de página ni reportes globales en esas comprobaciones.

Se utilizó emulación de resolución móvil, no un teléfono físico. No se ejecutó una partida completa de la historia ni todas las combinaciones posibles de decoración del jugador.

## Capturas del juego

- [Plaza completa](art/caminos-interiores/plaza.png)
- [Giro del muelle](art/caminos-interiores/muelle-giro.png)
- [Jardín](art/caminos-interiores/garden.png)
- [Mercado](art/caminos-interiores/market.png)
- [Playa](art/caminos-interiores/beach.png)
- [Estación](art/caminos-interiores/station.png)
- [Bosque](art/caminos-interiores/forest.png)
- [Muebles con sus IDs anteriores](art/caminos-interiores/muebles-existentes.png)
- [Habitación en PC](art/caminos-interiores/habitacion-pc.png)
- [Habitación en resolución móvil](art/caminos-interiores/habitacion-movil.png)
