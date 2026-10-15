# Villa Nori: distribución completa de exteriores

Continuación de la [primera muestra](villa-nori-distribucion.md), autorizada después de revisar ese estilo. Esta entrega completa la distribución exterior de las **seis regiones existentes**, con una familia visual compartida para las casas y los negocios. Se mantiene la carga por zonas: no se convierte el mundo en una imagen única ni en un mapa gigante que tenga que procesarse entero en móvil.

## Resultado

| Región | Organización y detalles |
| --- | --- |
| Villa Nori | Centro cívico alrededor de la fuente; paseo de compras que rodea Taro; acceso propio a la florería de la ribera occidental; calle residencial con porches; patio compartido separado del sector de carga; pescaderías junto al puerto; paseo del río, terrazas de té y flores, y santuario con accesos despejados. |
| Playa | Mercado de pescado y conchas próximo a la llegada; área de descanso junto a la casa de Nami; circuito que rodea las cabañas; dos muelles de tablones; redes y mercadería a los costados. |
| Jardín | Cultivos y banco de semillas en su sector; casa de té al norte; florería con patio al sur; paseo continuo por delante de la entrada; cerezos agrupados sin tapar el acceso; camino al estanque y puente de madera. |
| Bosque | Sendero continuo entre cabaña, lago y santuario; suministros junto a la cabaña; faroles bajos en los cruces; puente sobre el arroyo. Se conserva el claro restaurable y sus actividades. |
| Estación | Andén público con bancos y señalización; patio de carga independiente, con cajones y bolsas junto al depósito; conexión transitable a ambos sectores. |
| Mercado Nocturno | Dos pasillos libres de compras; luces junto a los puestos y en el perímetro; descanso y utilería entre los puestos, con salida señalizada junto al torii. |

### Arte y mobiliario

- Yuki y la biblioteca se suman al kit de Midnight Maki, Bento y Taro: tejas con juntas, madera, revoque y detalles del oficio. Yuki tiene prendas y telas; la biblioteca, libros y devolución.
- Las **dieciséis casas** comparten esos materiales. Conservan sus entradas al frente o al costado y detalles distintos para vivienda, té, pesca y flores. El kit incluye 24 variantes al contar las cuatro etapas del restaurante y las orientaciones de las casas.
- Los faroles de calle tienen variantes de brazo izquierdo y derecho. Sus bases quedan junto a los caminos; las lámparas no ocupan los pasillos.
- Los bancos forman lugares de descanso; las bicicletas tienen lugares de estacionamiento; las bolsas, cajones y redes pertenecen a tiendas o sectores de carga.
- Se elimina la dispersión de flores de la plaza. Canteros, macetas y vegetación exterior usan posiciones definidas por sector.
- Los carteles de rutas quedan a los costados de los accesos; se revisa su visibilidad respecto de techos y torii.
- Se conservan las reformas compradas. Se reubican bancos y utilería que ocupaban edificios o recorridos públicos, sin volver a cobrarlos. El cajón de pescadores y su interacción quedan juntos, separados del punto de conchas.

## Imágenes

- [Vista de las seis regiones](art/villa-nori-distribuida/exteriores.png).
- [Villa Nori completa](art/villa-nori-distribuida/plaza.png).
- [Playa](art/villa-nori-distribuida/beach.png), [jardín](art/villa-nori-distribuida/garden.png), [bosque](art/villa-nori-distribuida/forest.png), [estación](art/villa-nori-distribuida/station.png), [mercado](art/villa-nori-distribuida/market.png).
- [Familia de fachadas](art/villa-nori-distribuida/fachadas.png).
- Capturas de juego: [barrio en PC](art/villa-nori-distribuida/barrio-pc.png), [Yuki en vertical](art/villa-nori-distribuida/yuki-movil.png), [jardín en vertical](art/villa-nori-distribuida/jardin-movil.png), [Yuki de noche](art/villa-nori-distribuida/yuki-noche.png).
- [Interior amueblado conservado al integrar los avances](art/villa-nori-distribuida/casa-interior.png).

Las imágenes completas son exportaciones diurnas del escenario con accesos habilitados y restaurante inicial. No representan todas las combinaciones de clima, hora, reformas o decoración del jugador. La vista general junta regiones separadas para revisarlas; no pretende que sean una sola superficie continua.

## Partidas y funcionamiento

Los IDs históricos de las casas se separan de sus coordenadas actuales en `houses.ts`. Se conservan su orden, nombres, oficios, vecinos e identidad del interior; ninguna casa se traslada a otra región. Se integran las habitaciones amuebladas, salidas laterales y regalos de muebles del avance `cc980f3`, sin sustituirlos por los interiores anteriores. Una partida que estaba dentro vuelve a su casa y sale por la entrada actual. Así se evita que una casa antes accesible permita entrar anticipadamente a una región cerrada por historia.

Se mantienen las coordenadas de Midnight Maki, Bento, Taro, Yuki, biblioteca, fuente, buzón y salidas de la historia. No se cambian capítulos, diálogos, pistas, horarios, canciones, velocidad del reloj, estaciones o iluminación. Las máscaras de ventanas de Yuki y biblioteca se ajustan al nuevo dibujo y reutilizan el sistema vigente.

No se cambia el formato del guardado ni se borran muebles, recursos, recetas, relaciones o mejoras. La recuperación de posición existente (`safeArrival`) resuelve una posición exterior antigua que ahora ocupa una construcción. No se usa para mover personajes durante sus rutinas normales. Los vecinos consultan las puertas actuales por sus IDs, y sus lugares de descanso siguen saliendo de los bancos del mapa.

## Archivos de código

- `src/data/outdoorLayout.ts`: disposición exterior por región, caminos, veredas, patios y mobiliario con posiciones concretas.
- `src/data/houses.ts`: identidad histórica y ubicaciones actuales de las viviendas; senderos de entrada.
- `src/data/plazaMap.ts`: fachada de Yuki, corrección de una maceta de bambú restaurada y eliminación de la dispersión de flores.
- `src/data/zones.ts`: integración de la distribución y despeje de recorridos de playa y bosque.
- `src/data/projects.ts`: posiciones coherentes de las reformas y del cajón de pescadores.
- `src/data/props.ts`: metadatos de fachadas, faroles y puentes/muelles.
- `src/art/village.ts`: fachadas nuevas y variantes de viviendas por oficio y orientación.
- `src/art/objects.ts`: selección del arte y faroles de brazo lateral.
- `src/scenes/textures.ts`: máscaras de ventanas para las fachadas nuevas.
- `src/tests/outdoorLayout.test.ts`: identidad de las casas, umbrales, recuperación de guardado, recorridos despejados, puentes y combinaciones de reformas.

## Verificación

- `npm run typecheck`: correcto.
- `npm run build`: correcto. Vite mantiene los avisos de imports simultáneamente estáticos y dinámicos del proyecto.
- `npx vitest run src/tests/outdoorLayout.test.ts src/tests/zones.test.ts src/tests/villageSample.test.ts`: **37 pruebas correctas**. Incluyen las seis regiones, interiores de casas, salidas cerradas por historia, recorrido completo del ancho de los caminos y cuatro combinaciones de nivel/reformas hasta proyectos terminados.
- Tras integrar `cc980f3`, repetición de esas comprobaciones junto con `src/tests/houseInterior.test.ts`: **44 pruebas correctas**, incluidos amueblado, puertas laterales, regalos y compatibilidad del guardado.
- Exportación de las 30 zonas mediante Phaser sin errores de navegador.
- Dos comprobaciones adicionales de rutas de vecinos, seleccionadas de `neighbors.test.ts` y `townLife.test.ts` mediante `-t 'only use places that can be walked to|finish every neighbor journey'`: **2 correctas**, con las otras 14 pruebas de esos archivos sin ejecutar por el filtro. Comprueban destinos transitables y finalización de viajes entre períodos sobre los mapas actuales.
- Playwright con Chromium sobre `vite preview`, usando los archivos del build: **1366×768 y 390×844**. En ambas resoluciones se cargaron los 16 IDs históricos de viviendas y se salió caminando por sus puertas reales, comprobando cada destino exterior y que el tile de llegada estuviera libre. Se comprobó teclado en PC y joystick mediante eventos táctiles en vertical.
- Yuki: entrada, menú original y cierre; Taro y biblioteca: entrada/salida; Bento: compra de Tamagoyaki y recuperación del control. Recorrido a pie del puente del pueblo, estanque del jardín, muelle de playa, puente del bosque, estación y mercado. Se usó carga directa de zonas en el automatismo para omitir viajes largos entre regiones independientes; sus puertas y recorridos se ejercitaron por separado.
- Partida guardada dentro de `house_plaza_8_36`: conserva su interior y sale a (18,31). Guardado dentro de `house_garden_31_4`, recarga y Continuar: conserva monedas, artículo comprado y madera; sale a (19,20). En vertical, el cierre del recorrido conservó 996 monedas, 1 Tamagoyaki, 9 maderas y las banderas previas del prólogo/cartel restaurado.
- Partida exterior antigua en (12,28), ahora ocupada por una vivienda: Continuar la ubica en (12,27), transitable, conservando 721 monedas, 9 maderas y el cartel restaurado.
- Repetición final sobre el build integrado con `cc980f3`, en PC y vertical: las 16 casas amuebladas permiten salir al exterior correcto; guardado y Continuar conservan 1000 monedas, 9 maderas, 2 muebles del inventario y 1 regalo de mueble. El regalo puede quedar colocado automáticamente en la casa o pendiente según el espacio, de acuerdo con el sistema incorporado. Sin errores registrados, pausa retenida ni bloqueo de controles.
- Se observó la soga del Mercado Nocturno cerrada de día; para probar su acceso nocturno se habilitaron las condiciones de historia de la partida de comprobación. Captura nocturna de las ventanas de Yuki. Sin errores globales registrados ni controles bloqueados al finalizar las comprobaciones.

**Límites:** no se ejecutó la suite completa ni toda la regresión narrativa, respetando la postergación solicitada. La resolución vertical y los toques se probaron mediante emulación, no en un teléfono físico. No se midió el rendimiento en hardware móvil ni se comprobó cada combinación de clima, festival, decoración y hora. El arte de los hitos existentes (faro, santuario, estación y cabañas) se conserva; se ordenan sus entornos y accesos. La entrega completa la redistribución exterior y el kit de casas/comercios, sin afirmar que se haya reemplazado cada ilustración del juego.

## Cómo revisarlo jugando

1. Continuar una partida anterior: entrar y salir de alguna casa del barrio y comprobar los recursos y las mejoras.
2. Recorrer la plaza, Yuki, Bento, Taro y biblioteca. El paseo comercial pasa al costado de Taro, sin atravesar su edificio.
3. Bajar por la calle residencial al puerto; recorrer los dos muelles y probar los puntos de pesca.
4. Cruzar a la ribera: visitar la casa de té y la florería sin que los carteles o las macetas tapen sus entradas.
5. En el jardín, seguir el paseo frente a la florería y cruzar el estanque; los cultivos conservan su progreso.
6. Visitar el mercado, la estación y el bosque. Revisar también una partida que tenga proyectos restaurados.
7. Repetir en vertical con joystick y en PC con teclado; abrir y cerrar tiendas para comprobar que se recupera el control.
