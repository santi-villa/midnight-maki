# Recursos seleccionados para Villa Nori

Se integran recortes pequeños a un atlas de 256×256, cargado antes de generar las texturas del juego. No se carga la carpeta completa de descargas ni las variantes ampliadas 32/48 px.

## VectoRaith

Origen: ZIP `vectoraith_tileset_buildings_japanese_traditional_DEMO.zip`, suministrado para este proyecto.

[Página oficial de Traditional Japanese Buildings](https://vectoraith.itch.io/traditional-japanese-buildings-tileset-pack).

La demo suministrada incluye nueve PNG: edificios, terreno y agua, cada uno a tres escalas. La lámina de edificios a 16 px contiene dos pequeñas fachadas y algunos accesorios. La imagen de referencia del conjunto completo tiene muchas más casas, torii, castillos y puentes que no forman parte de ese ZIP.

Se utiliza un recorte nativo de césped y un material de tejado, con adaptación de color. Las viviendas utilizan ahora las dos fachadas de la demo: sus tejados, entramados, puertas, ventanas y jardineras se ensamblan con módulos a resolución nativa, conservando las huellas y los accesos históricos. Las casas de té y florerías usan el frontón del segundo modelo. Los comercios principales conservan sus fachadas propias. Los puentes y muelles usan ahora el autotile de madera de 32×48 de la lámina de terrenos de esa misma demo (recorte 160,96). Sus cuartos nativos incluyen bordes rectos y esquinas internas/externas, elegidos según las celdas vecinas. La extracción reproducible y su procedencia están en `scripts/build-bridge-assets.py` y `src/assets/bridges/provenance.json`; el dibujo en código queda como fallback si no carga el archivo.

La página oficial permite usar el arte en juegos comerciales y gratuitos y modificarlo; conserva la propiedad del autor y restringe la distribución del recurso suelto y su uso para entrenamiento de IA, NFT y actividades similares. Revisado el 16 de octubre de 2026. Este atlas contiene solo piezas utilizadas como recursos de Midnight Maki.

## Bitglow

Origen: `Pixel Interior – Cozy 16x16 Living Room & Kitchen Top Down Tileset.zip`, suministrado para este proyecto.

Se seleccionan una mesa, cuatro orientaciones de silla, plantas, un jarrón, una lámpara y un reloj de `livingroom_LRK.png` y `decorations_LRK.png`. El texto de licencia original acompaña el atlas en `src/assets/cozy-town/Bitglow-license.txt`.

Mesas y sillas conservan las huellas lógicas y orientaciones de los IDs existentes. Las sillas ajustan su altura visual y los recortes se adaptan con escala uniforme. La mesa girada utiliza ahora la vista lateral nativa del atlas de interiores en lugar de estirar el sprite horizontal. Las decoraciones se ajustan a sus lienzos manteniendo proporción y pivote en la base.

## Selección restante de las descargas

### Ampliación del catálogo interior

Se añaden 178 muebles y adornos de los paquetes Bitglow Bedroom (20), Bathroom (19) y Living Room & Kitchen (21). Se conservan los píxeles originales y las orientaciones completas, con un atlas propio de 1024×512. La licencia original acompaña el atlas en `src/assets/interiors/Bitglow-license.txt`; `catalog.json` registra lámina y rectángulo de origen de cada pieza. La selección es reproducible mediante `scripts/build-interior-assets.py`. Además, los muebles antiguos con equivalente usan este mismo atlas sin cambiar sus IDs ni huellas guardadas. Véase `docs/interiores-bitglow.md` para integración, guardados y alcance.

- **Interiores y muebles:** se priorizó Bitglow por coherencia y permiso comercial adjunto. Cosy Cabin, Cozy Interior, Pixel Lands y Super Retro World quedan como alternativas de estilo, no se mezclan todos en el mismo salón.
- **Exterior:** se conservaron bancos, carteles, macetas, flores, casas comerciales y objetos de cada zona; se armonizan sus materiales y se añaden tejas de la demo sin cambiar la navegación.
- **Sprout Lands, Cozy Lands, Farming Pack Free Tier y otros recursos no comerciales:** no se incorporan a esta publicación.
- Las piezas grandes que solo aparecen en la imagen del pack completo no se extraen de la previsualización para fingir que están disponibles en la demo.

Los créditos del menú del juego mencionan a VectoRaith y Bitglow. El resto de la construcción del mundo, arte de personajes, lógica, animaciones y composición sigue siendo el trabajo propio del proyecto.
