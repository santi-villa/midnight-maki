# Recursos seleccionados para Villa Nori

Se integran recortes pequeños en atlas cargados antes de generar las texturas del juego.
No se carga la carpeta completa de descargas ni las variantes ampliadas 32/48 px.

## Serene Village revamped v1.9 (LimeZu)

[Fuente oficial](https://limezu.itch.io/serenevillagerevamped), con licencia
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) indicada en esa página
(revisada el 30/10/2026). Dos bases de terreno y nueve sprites naturales sustituyen
los dibujos de diez IDs existentes: árboles frondosos, arbustos, flores, piedras
y cercas. Se recorta la lámina nativa de 16 px y se adapta la paleta de verdes y
tierra, sin escalar los objetos. Se mantienen pinos, cerezos y árbol otoñal propios.

El atlas seleccionado, catálogo de procedencia y atribución están en
`src/assets/serene/`. Extracción reproducible: `scripts/build-serene-assets.py`.
Los créditos del juego enlazan autor, fuente y licencia y describen las modificaciones.
Véase [integración de Serene Village](serene-village.md) para zonas, alcance,
capturas y validación.

El nuevo mapa utiliza también un recorte de relieve de 16×16 px, coordenadas
`[16, 160, 16, 16]` de la misma lámina. Conserva el tamaño nativo, adapta los verdes
y ofrece una variante de pared de piedra. Atlas y atribución verificable:
`src/assets/map-study/cliffs.png` y `credits.json`. Se reproduce mediante
`scripts/build-map-study-assets.py` y se carga con los recursos del juego.

## Japanese City FREE (GuttyKreum)

Detalles comerciales de [The Japan Collection: Japanese City (Free Version)](https://guttykreum.itch.io/free-japanese-city-game-assets):
expendedoras roja/blanca, dos postes eléctricos, dos letreros, un expositor y dos
puestos compuestos con toldos de la descarga gratuita. Atlas de 256×128 en
`src/assets/japanese-city/atlas.png`; procedencia y hash en `catalog.json`.
`scripts/build-japanese-city-assets.py` reproduce la selección a partir de
`Free_Version/Tilemap/Tilemap.png`, sin usar previsualizaciones del pack pago.

Licencia de la página oficial revisada el 30/10/2026: permite modificar y utilizar
el arte dentro de juegos gratuitos/comerciales; restringe la redistribución de los
recursos sueltos y su uso en logos o marcas. La fuente completa permanece fuera
del repositorio. GuttyKreum figura en los créditos del juego.
Véase [distribución de packs e integración](japanese-city.md) para ubicaciones,
escala, comparación y recomendación de compra.

## VectoRaith

Origen: ZIP `vectoraith_tileset_buildings_japanese_traditional_DEMO.zip`, suministrado para este proyecto.

[Página oficial de Traditional Japanese Buildings](https://vectoraith.itch.io/traditional-japanese-buildings-tileset-pack).

La demo suministrada incluye nueve PNG: edificios, terreno y agua, cada uno a tres escalas. La lámina de edificios a 16 px contiene dos pequeñas fachadas y algunos accesorios. La imagen de referencia del conjunto completo tiene muchas más casas, torii, castillos y puentes que no forman parte de ese ZIP.

Se utiliza un recorte nativo de césped y un material de tejado, con adaptación de color. Las viviendas utilizan ahora las dos fachadas de la demo: sus tejados, entramados, puertas, ventanas y jardineras se ensamblan con módulos a resolución nativa, conservando las huellas y los accesos históricos. Las casas de té y florerías usan el frontón del segundo modelo. Los comercios principales conservan sus fachadas propias. Los puentes y muelles usan ahora el autotile de madera de 32×48 de la lámina de terrenos de esa misma demo (recorte 160,96). Sus cuartos nativos incluyen bordes rectos y esquinas internas/externas, elegidos según las celdas vecinas. La madera se adapta a la paleta cálida anterior. Las barandillas elevadas se dibujan con el estilo propio del pueblo siguiendo únicamente los bordes que dan al agua, incluidos los giros; no son nuevos sprites extraídos del paquete. La extracción reproducible y su procedencia están en `scripts/build-bridge-assets.py` y `src/assets/bridges/provenance.json`; el dibujo en código queda como fallback si no carga el archivo.

La página oficial permite usar el arte en juegos comerciales y gratuitos y modificarlo; conserva la propiedad del autor y restringe la distribución del recurso suelto y su uso para entrenamiento de IA, NFT y actividades similares. Revisado el 16 de octubre de 2026. Este atlas contiene solo piezas utilizadas como recursos de Midnight Maki.

La demo aporta además una conífera pequeña, buzón rojo, cartel cubierto y caja de madera, incorporados mediante `scripts/build-exterior-details.py`. Los arbustos exteriores reutilizan su recorte nativo de arbusto florido. Una entrega posterior incorpora barcos y las tres fachadas elegidas a partir de la lámina completa aportada por el usuario, descrita abajo; no se atribuyen esas piezas al ZIP de demostración.

### Pack completo (31/10/2026)

Ahora está el pack completo en `ASSETS DESCARGADOS/NUEVO/Traditional Japanese Buildings Tileset/` (ignorado por git; su
licencia no permite redistribuir el recurso suelto). `scripts/build-japanese-buildings.py` recorta fachadas enteras de
la hoja `ATLAS` de 16 px, a tamaño nativo, a `src/assets/jp-buildings/atlas.png` (512×257) con su `catalog.json`:

```
JP_BUILDINGS_SRC=/ruta/a/Original/16x16 python3 scripts/build-japanese-buildings.py
```

Cada fachada guarda su puerta, ventanas y cartel. `art/japaneseBuildings.ts` las dibuja y alimenta la geometría que ya
usaban el restaurante (`restaurantFacadeLayout`) y los comercios (`villageShopLayout`), así que la baldosa de la puerta,
el camino, la persiana del comercio cerrado, los faroles y el brillo nocturno de las ventanas siguen a la fachada nueva.
La huella crece a baldosas enteras alrededor de la fachada, y la fachada se corre unos píxeles para que su puerta caiga
en el medio de una baldosa.

- **Midnight Maki**: una fachada por etapa — casa vieja de techo oscuro, la misma casa restaurada (techo gris verdoso),
  la casa grande azul y la posada de dos pisos. El cartel con el nombre del restaurante, los faroles y las ventanas
  tapiadas de "cerrado" se mantienen. La puerta queda en la misma baldosa en las cuatro etapas.
- **Panadería, Ropa de Yuki y Almacén de Taro**: el comercio con toldo y mercadería, cada uno con su color de techo y su
  cartel.
- **Biblioteca**: la casa grande de dos pisos.

`?buildings=classic` vuelve a las fachadas anteriores. Ver `docs/jp-centro.png` y `docs/jp-restaurante-etapas.png`.

Escenografía del mismo pack (catálogo `pieces`, dibujada a tamaño nativo y centrada abajo): santuario de madera (huella de
seis baldosas), torii, faroles de piedra, komainu, pinos japoneses y cerezos. Con `?buildings=classic` vuelven el
santuario chico con la casa del cuidador y el arte anterior de árboles y faroles.

### Lámina completa aportada por el usuario

El PNG de 1013×1181 recibido en `Imagen de ChatGPT 17 oct 2026, 01_34_44.zip` se conserva en `art-source/village/lamina-aportada.png`. `scripts/build-village-assets.py` recorta 18 piezas de esa imagen de VectoRaith: las tres fachadas elegidas para Midnight Maki, botes, arbustos, faroles, guirnalda, recipientes y accesorios pesqueros y tres fachadas pequeñas para puestos de mercado. Su atlas de 512×256 ocupa unos 45 KiB de PNG; la lámina completa no entra en la carga del juego. `src/assets/village/catalog.json` registra el hash, origen de cada recorte y geometría de las fachadas. Se mantiene la mención de VectoRaith en los créditos del juego.

Esta lámina tiene interpolación y transparencia parcial: no se presenta como una exportación nativa de 16 px. Se limpia el fondo tenue y se ajustan los recortes con proporción uniforme, sin añadir suavizado. Véase [fachadas elegidas y puentes](fachadas-elegidas-y-puentes.md).

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

## Modern Interiors (LimeZu)

Pack comprado (versión completa) de LimeZu: <https://limezu.itch.io/moderninteriors>. Su licencia permite usarlo y editarlo en proyectos comerciales, **prohíbe redistribuirlo** y pide crédito, que figura en la pantalla de créditos del juego.

Por eso el pack **no está en el repositorio** (`ASSETS DESCARGADOS/NUEVO/` está en `.gitignore`); el original vive en el Drive de Santi. En el repo solo queda el atlas chico con los recortes que usa el juego (`src/assets/limezu/atlas.png`, 256×100) y su catálogo (`catalog.json`, con hoja y rectángulo de origen de cada pieza).

`scripts/build-limezu-assets.py` arma ese atlas a partir de las hojas por tema. Acepta las hojas nativas de 16×16 o las de RPG Maker MV de 48×48: estas últimas son ampliaciones exactas ×3 del original y se reducen con vecino más cercano, sin inventar ni suavizar píxeles. Uso:

```
LIMEZU_SRC=/ruta/a/las/hojas/por/tema python3 scripts/build-limezu-assets.py
```

Los diez estilos de piso (los que se compran y eligen en Decorar) usan baldosas del Room Builder del pack; el tatami sale del tema japonés. Se repite la columna central de cada piso, que no tiene sombreado de borde. Cada pieza declara qué muebles o props del juego viste (`replaces`): los IDs guardados, las huellas en la grilla y el comportamiento no cambian, solo el dibujo. Las piezas se dibujan a tamaño nativo, nunca escaladas. Una pieza con una sola vista no se usa girada de costado (ahí queda el dibujo anterior). Con `?interiors=classic` en la URL el juego carga sin el pack, para comparar.

Primera prueba (32 piezas): sillas de izakaya en cuatro direcciones, mesas, chabudai, zabutones, banquito, bandeja de té, roperos, aparador, escritorio, mesita de luz, lámparas, plantas, pecera, cuadros, kakejiku y bibliotecas.

## Modern Exteriors (LimeZu)

Pack comprado de LimeZu: <https://limezu.itch.io/modernexteriors>. Mismas condiciones que Modern Interiors: se puede usar y editar, **no se puede redistribuir** y pide crédito (figura en los créditos del juego). El pack vive fuera del repo, en `ASSETS DESCARGADOS/NUEVO/` (ignorado por git).

En el repo solo queda el atlas chico de recortes (`src/assets/limezu/exteriors.png`) y su catálogo (`exteriors.json`, con hoja y rectángulo de origen). Lo arma `scripts/build-limezu-exteriors.py` a partir de la carpeta `Modern_Exteriors_16x16` del pack:

```
LIMEZU_EXT_SRC=/ruta/a/Modern_Exteriors_16x16 python3 scripts/build-limezu-exteriors.py
```

El catálogo tiene dos partes:

- **Baldosas** que se dibujan dentro del tileset del juego: la arena seca, la arena compacta de los paseos, el mar animado (8 cuadros del pack, en un patrón de 2×2) y la línea de la orilla. El agua más profunda y la lluvia son un velo de color sobre los mismos píxeles. El mar del pack solo se usa en las zonas de mar (`fishing: 'sea'`); los estanques del bosque y del jardín siguen con su agua dibujada.
- **Piezas** a tamaño nativo para props nuevos de la playa: sombrillas, toallones, castillos de arena, una gaviota, boyas, rocas en el mar y matas de playa.

Con `?exteriors=classic` en la URL el juego carga sin el pack (arena, agua y orilla anteriores, y sin los props nuevos), para comparar.

Primera zona: Playa de las Conchas (`docs/limezu-playa-antes-despues.png`). El faro del pack (7×16 baldosas) se usa desde el 31/10/2026: ver más abajo.

Segunda zona: la plaza (`docs/limezu-plaza-antes-despues.png`). Fuente redonda con agua (`Garden Fountain_3_4`), bancos (`Bench_7`), faroles (`Street_Lamp_5`, también en las demás zonas), buzón, dos macetas del pack de jardín, cuatro canteros en lugar de los canteros planos del piso, y dos palomas. Las piezas salen de las carpetas *Singles* del pack, recortadas a sus píxeles visibles. El cartel de anuncios y el empedrado siguen siendo los del juego.

Ajuste visual del 30/10/2026: arena y franja arenosa de los ocho cuadros de la
orilla adaptadas a una paleta beige clara, con menos saturación y contraste en
las ondas. El script conserva el mapeo de colores en `sandPalette` del catálogo;
los píxeles del mar y los objetos mantienen sus colores originales. La decoración
nueva de la playa se reduce de 17 a seis piezas: una sombrilla con toallón, una
gaviota, una mata, un peñasco en el borde oeste y una boya junto al muelle este.
También se despeja la franja central de cajas, barriles, faroles, botes y piedras
sueltas. Comparación actual: `docs/playa-antes.png` y `docs/playa-ajustada.png`.

Playa en el mapa nuevo (31/10/2026). Ese ajuste era del mapa anterior; en el mapa
unificado solo habían quedado cuatro piezas y el agua cortaba en escalones contra
la arena. Ahora:
- **Orilla completa**: además del borde de arriba, los costados y las esquinas del
  estanque del pack (`Sea_Water_Tileset_Basic`) y las esquinas interiores
  (`Sea_Water_Tileset_Outer_Corners`), animados con el agua. Solo junto a arena: la
  costa de pasto del puerto no lleva espuma.
- **Profundidad por distancia a tierra** en todas las zonas de mar: agua clara junto
  a la costa y al islote del faro, más oscura mar adentro (antes todo el mar era
  "profundo").
- **Arena más cálida**, cerca del color de los caminos de tierra (antes se veía casi
  blanca junto a ellos). Los castillos usan el mismo crema, conservando su sombreado.
- **Decoración**: segunda sombrilla con toallón, castillo con muralla y torre, tres
  matas, cuatro rocas y tres boyas mar adentro. Quedan libres los puntos de conchas,
  los puestos, el mirador del atardecer y los lugares de pesca.
Comparación: `docs/limezu-playa-antes-despues.png`.

Puerto, mercado y estación (31/10/2026, `docs/limezu-puerto-mercado-estacion.png`):
- **Mercado**: carro de flores entre los dos puestos grandes, carrito de golosinas junto a
  la casa del oeste, cajones con flores, dos barriles y un banco contra la baranda sur.
- **Puerto**: pila de cajas, caja y barril junto a la primera casa, un banco frente al
  muelle y gaviotas sobre las barandas.
- **Estación**: banco de andén donde ya estaba la acción de sentarse, valija, bolso y
  carro de equipaje en la fila de atrás del andén, y dos macetas a los lados del edificio.
Las piezas del muelle usan el prefijo `wharf_`: el mapa (`villageWorld.ts`) no deja objetos
sólidos sobre tablas ni caminos, salvo estas, ubicadas a mano contra las barandas y bordes.
Quedan libres el pasillo, los mostradores, las bocas de los dos muelles y las puertas.

Jardín y barrio residencial (31/10/2026, `docs/limezu-jardin-barrio.png`):
- **Jardín**: estatua junto al estanque, banco con macetas en el césped, carrito con flores
  al lado de las huertas del este, dos casitas de pájaros y una regadera junto a la huerta oeste.
- **Barrio**: cada casa tiene buzón y tacho en los primeros casilleros de pasto libres junto a
  su sendero de entrada (se calculan después de trazar las calles, en `villageWorld.ts`), y una
  de cada dos casas tiene una casita de pájaros, alternando celeste, rosa y marrón.

Faro (31/10/2026, `docs/limezu-faro.png`): el faro del pack (`Example_Lighthouse`, 7×16 baldosas)
reemplaza al del juego. Para que la torre no tape las casas de la ribera ni el muelle, el islote
bajó hacia mar abierto (centro en 100,72), el muelle sigue hasta él y la puerta pasó a 100,75.
Con `?exteriors=classic` vuelven el islote y el faro anteriores.

## Interfaz: emotes de Modern Interiors y Sprout Lands UI

- **Burbujas de los personajes** (LimeZu, *Modern Interiors*, `4_User_Interface_Elements`):
  `scripts/build-ui-assets.py` junta en `src/assets/ui/emotes.png` los emotes animados
  (pensando, enojo, lágrima, carta, flecha) y burbujas quietas de `UI_16x16.png` (corazón,
  exclamación, alarma, zzz, nota, brillo). `Actor.emote` muestra la burbuja del pack para
  `!`, `!!`, `...`, `z`, `*`, `♪`, `ñam`, `té`; cualquier otra frase sigue como globo de texto.
- **Sprout Lands UI Pack** (Cup Nooble, versión básica gratuita: uso no comercial, sin
  redistribuir): cursor de pata de gato (normal, señalando sobre botones, apretando al hacer clic)
  y el indicador animado de "seguir" del cuadro de diálogo (`src/ui/sproutUi.css`).
