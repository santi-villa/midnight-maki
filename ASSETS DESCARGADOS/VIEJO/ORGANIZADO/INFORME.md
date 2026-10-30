# Midnight Maki: selección de arte y organización

Revisión del 16 de octubre de 2026. Entrega privada para el proyecto Midnight Maki.

**Mi elección es la combinación A: conservar la identidad del juego y renovar piezas concretas.** Mantendría a Sofi/Santiago, los mapaches, los vecinos animales, las fachadas japonesas, el restaurante y su iluminación. Mejoraría primero los muebles y la huerta; después evaluaría iconos de comida y pesca. No cambiaría todo por una colección de packs de granja: perderías lo que distingue a Midnight Maki.

## Qué se revisó

- Carpeta local indicada, incluidos código, documentación, capturas existentes y los 28 archivos de `ASSETS DESCARGADOS`.
- GitHub: [santi-villa/midnight-maki](https://github.com/santi-villa/midnight-maki), listado de ramas y revisión del estado de `master`.
- La copia local está en `1d97d328ddac6dbafd6af9a30aeb6a7bc789bdd7`, también publicado como cabeza de [master-mgsshv](https://github.com/santi-villa/midnight-maki/tree/1d97d328ddac6dbafd6af9a30aeb6a7bc789bdd7). La rama predeterminada `master` apunta a `c82e135b09c3b03d67edaa79dcc03c5455e3e67d`. La recomendación usa el código local, que contiene trabajo posterior al de `master`; no presupone que `main` sea la versión actual.
- Inventario y apertura/verificación técnica de todas las imágenes; comparación visual de láminas representativas y de capturas ya presentes en `docs/art`. El catálogo permite ver todas las imágenes. No se ejecutó una partida nueva ni se probaron los packs integrados en el juego.

El proyecto usa Phaser 3.88.2 según package.json, TypeScript, Vite y Capacitor para Android. La cuadrícula lógica es de **16×16**, pero eso no exige que cada personaje mida 16×16.

## Entrega

Abrir `ABRIR_CATALOGO.html` en un navegador, después de descomprimir todo el ZIP. Funciona localmente y no depende de servicios externos.

| Carpeta/archivo | Qué contiene |
|---|---|
| `biblioteca/` | Los 28 packs extraídos, agrupados en nueve categorías; se conserva el nombre y la estructura interna de cada proveedor |
| `combinaciones/A_evolucion_recomendada/` | Interiores Bitglow + huerta de Cozy Farm Lite; candidatos de sushi y pesca separados por licencia pendiente |
| `combinaciones/B_cabana_rustica/` | Naturaleza Pixel Tales + Cosy Cabin Simple y accesorios de sushi como candidatos |
| `combinaciones/C_pueblo_cozy_alternativo/` | Base alternativa Cozy Farm/Interior/Town y extras no comerciales, separados |
| `vistas/` | Hojas de comparación por pack y por combinación |
| `referencia_juego_actual/` | Copias de capturas/documentación visual existentes del proyecto para comparar |
| `inventario_archivos.csv` | Archivo, origen, dimensiones, transparencia, cuadros GIF, hash, duplicados y estado de licencia |
| `seleccion_por_combinacion.csv` | Lista exacta de cada imagen seleccionada y su ruta en la biblioteca |
| `manifiesto.json` | Catálogo completo legible por scripts |
| `duplicados_exactos.json` | Grupos idénticos por SHA-256 |
| `GUIA_INTEGRACION.md` | Puntos del código a modificar y criterios técnicos |

Se registraron **1.740 imágenes**, **1.815 archivos de biblioteca** y **261 copias seleccionadas** entre las tres combinaciones. Se encontraron **19 grupos de duplicados exactos**, con **49 copias adicionales**. Esos duplicados se conservan en la biblioteca para no romper la estructura de los packs. Las versiones ampliadas y los atlas frente a sprites separados también generan redundancia visual aunque no compartan hash.

Se omitieron 71 archivos de metadatos de macOS (`__MACOSX`, `.DS_Store`, `._*`), enumerados en `metadatos_omitidos.csv`. El RAR Tiny Farm tenía tres archivos que 7z no admitía; se recuperaron mediante libarchive y las 15 imágenes del pack se verificaron. Los originales en Downloads y el repositorio no se modificaron.

## A: evolución recomendada

**Es la mejor relación entre mejora visual, trabajo de integración y conservación del estilo.**

1. **Conservar personajes y mapaches propios.** Tienen siluetas, ropa, retratos, expresiones y poses conectadas a sistemas del juego. Los packs humanos y de gatos descargados no cubren esos mismos estados ni reemplazan la personalización.
2. **Interiores: Bitglow 19, 20 y 21 como una sola familia.** Cocina y salón del 21 primero; dormitorios del 20 después; baño del 19 cuando se necesite. Elegir maderas medias, crema y textiles discretos. Mantener los faroles, el cartel, el mostrador de sushi y los elementos japoneses creados para el juego.
3. **Huerta: Cozy Farm Lite 07 a 1x.** Incluye caminos, suelo húmedo, vallas y etapas de zanahoria, tomate y trigo. No reemplazar todo el terreno del pueblo: adaptar el borde de las parcelas y probar su vegetación junto al césped actual. La selección evita los personajes nuevos y las copias 2x/4x.
4. **Comida candidata: pack 14, sushi 16×16.** Es el candidato más directo para mochila, recetas y pedidos. Sus 22 iconos no garantizan cubrir las recetas existentes; hace falta mapearlos uno por uno. Por ausencia de licencia adjunta va a `90_candidatos_licencia_pendiente`.
5. **Pesca candidata: pack 16, sprites separados 16×16.** Tiene un vocabulario gráfico consistente. Elegí una sola familia de iconos y usa los PNG de tamaño base, o genera un atlas con esos mismos sprites. No cargues a la vez los tamaños 16, 32, 48 y 64. También queda pendiente comprobar su licencia.

**La combinación A no es una versión final ya integrada ni una aprobación de publicación de los candidatos.** Es una selección concreta para empezar la integración. Las imágenes se copiaron intactas: no se recolorearon ni se normalizaron pivotes o recortes.

## B: cabaña rústica y cocina ampliada

Usaría **Cosy Cabin Simple 05** como familia principal de una cabaña o habitación secundaria, junto a árboles/objetos y terrenos de **Pixel Tales 23**. El **sushi 13** aporta bandejas, sake, palillos y piezas mayores que funcionan mejor en la vista de cocina o emplatado.

El conjunto rústico ayuda a una zona acotada. Llevarlo a todo el juego implicaría rehacer interiores y revisar cómo convive con el exterior japonés. Cosy Cabin tiene láminas grandes y ejemplos completos: esos ejemplos no incluyen por sí solos colisiones, navegación ni objetos interactivos. La retícula efectiva debe comprobarse en sus láminas; no se infiere solo porque el ancho sea divisible por 16.

Cosy Cabin 05 y sushi 13 no incluyen texto de licencia suficiente en estos archivos. Pixel Tales 23 sí trae autorización de uso comercial y modificación según su readme.

## C: pueblo cozy alternativo

**Cozy Farm 06 + Cozy Interior 09 + Cozy Town 12** forman una alternativa visual cálida y de menor detalle. Tendría sentido si querés orientar todo el mundo a algo más simple. Las casas rurales no sustituyen automáticamente la arquitectura japonesa: habría que rediseñar fachadas y objetos distintivos.

Se incluyen como extras separados **Cozy Fishing 08** y una lámina de **Sprout Lands UI 25**, ambos limitados a uso no comercial según los textos adjuntos. No sustituiría el HUD actual por Sprout solo para utilizar el pack: tu interfaz ya tiene madera, reloj e iconos propios y el cambio afectaría muchas pantallas.

Es la opción que menos recomiendo para el estado actual: exige más trabajo para conservar el carácter de Midnight Maki. Las licencias de 06, 09 y 12 quedan pendientes; sus readme son mensajes de bienvenida, no permisos completos.

## Qué haría con los demás

| ID | Pack | Decisión |
|---|---|---|
| 01 | 100 Nature Things | Seis pequeños objetos en esta descarga, no cien; reserva no comercial |
| 02 | Animal Mega Pack | Pájaros/perro ambiental opcional; faltan estados equivalentes a los actores del juego |
| 03 | Cat Pixel Mega Pack | Un gato negro/marrón como ambiente; no variantes temáticas como elenco principal |
| 04 | Cornucopia | Alternativa para ingredientes; escoger un único contorno |
| 05 | Cosy Cabin | Opción B; comprobar retícula, licencia y tamaño de muebles |
| 06 | Cozy Farm | Opción C, no reemplazo directo de Villa Nori |
| 07 | Cozy Farm Lite | Selección A para la huerta, en tamaño 1x |
| 08 | Cozy Fishing | Reserva no comercial o extra de C |
| 09 | Cozy Interior | Opción C; poco contenido para amueblar todo el juego |
| 10 | Cozy Lands | Dirección pastel alternativa; versión adjunta no comercial |
| 11 | Cozy People | Conservar de referencia; no reemplazar la personalización actual |
| 12 | Cozy Town | Opción C o pequeños detalles urbanos |
| 13 | Sushi Pack, 20 piezas | Opción B para emplatado, bandejas y accesorios |
| 14 | Sushi 16×16, 22 iconos | Mejor candidato para recetas/pedidos; licencia pendiente |
| 15 | Farming Pack | Reserva; Free Tier no comercial, separar vistas previas premium |
| 16 | Fishing Icon Pack | Mejor candidato de catálogo de pesca a 16×16; licencia pendiente |
| 17 | Forest Nature | Bambú/arbustos puntuales; no mezclar todos los biomas |
| 18 | Island Top Down | Alternativa de costa completa tras adaptar paleta y agua |
| 19 | Bitglow Bathroom | Complemento de A para baño |
| 20 | Bitglow Bedroom | Dormitorios de A |
| 21 | Bitglow Living Room & Kitchen | Familia principal para renovar hogar/cocina en A |
| 22 | Pixel Lands Interiors Demo | Alternativa compacta a Bitglow; no mezclar ambos en la misma habitación sin adaptación |
| 23 | Pixel Tales | Naturaleza de B, opción de apoyo rural |
| 24 | Pixelart Interior v2 | Prototipo; no lo elegiría como biblioteca principal |
| 25 | Sprout Lands UI Basic | Reserva no comercial; conservar HUD propio |
| 26 | Super Retro World Interior | Alternativa retro más saturada; escoger atlas_16x, evitar copias ampliadas y capturas auxiliares |
| 27 | Tiny Farm RPG | Reserva rural; extracción completa recuperada |
| 28 | 🍣 Sushi! | Ilustraciones grandes para fichas si se verifica licencia; fuera del mapa y de iconos 16×16 |

## ¿Importa el tamaño?

**Sí. Una imagen se puede mostrar más grande o más chica, pero eso no garantiza que siga siendo legible o coherente.**

- **Cuadrícula y sprite son cosas distintas.** Un suelo puede medir 16×16 y un árbol 32×48. Un personaje puede ocupar 24×39 y seguir caminando sobre celdas de 16×16. Importan los pies y la huella lógica, no que todos los PNG tengan el mismo ancho.
- **Pixel art pequeño:** ampliarlo 2x, 3x o 4x con vecino más cercano conserva los píxeles. Usar un sprite de 16 px dentro del mundo a su tamaño nativo y dejar que la cámara amplíe suele ser más limpio que guardar cuatro versiones.
- **Reducción:** de 32 a 16 se pierde información. Si el dibujo original tenía detalles de un píxel, no se recuperan con una opción del motor. A menudo conviene redibujar y simplificar.
- **Escalas fraccionarias:** pueden producir píxeles de anchos desiguales o vibración al moverse. `pixelArt` y `roundPixels` ayudan, pero no arreglan una densidad de dibujo incompatible ni todos los factores de escala del dispositivo.
- **Lámina no equivale a cuadro.** Un PNG 192×384 puede contener muchas animaciones pequeñas. Hay que identificar el tamaño de cada cuadro, filas, columnas, separaciones y orden. No se debe encoger toda la lámina para que “entre” un personaje.
- **Límites del PNG:** algunas láminas de interiores tienen medidas como 752×405 o 231×256. No corresponde dividirlas ciegamente en todas las celdas de 16×16: pueden tener piezas de tamaños distintos, márgenes o una fila parcial. Es más seguro definir recortes explícitos por objeto.
- **Sushi grande del pack 28:** hay recortes de cientos de píxeles y láminas de 1536×1024. Mostrarlos como iconos de 16 px borraría detalles y no unificaría su píxel aparente con el del mundo. Si se usan, probarlos como ilustraciones grandes, con tratamiento uniforme y licencia verificada.
- **Memoria:** el peso comprimido del PNG o del ZIP no es la memoria de textura. Como estimación base, RGBA usa ancho × alto × 4 bytes antes de posibles copias/mipmaps. Una textura 1536×1024 ronda 6 MiB; una de 16×16, 1 KiB. Para Android importa no precargar toda la biblioteca.

## Qué falta para el juego final

Primero integraría una muestra acotada: una zona de cocina/hogar, una parcela con sus cuatro etapas y unos pocos iconos de recetas. Compararía proporciones con el protagonista, lectura de día/noche, muebles ocupados por clientes, pivotes, colisiones y tacto en móvil. Después extendería la familia elegida a más espacios.

Ningún conjunto descargado cubre automáticamente todas las necesidades de la historia japonesa: mostrador de sushi, utensilios interactivos, letreros de Midnight Maki, poses de cocina/servicio, mapaches y todos los estados de recetas siguen necesitando arte propio o adaptación. Conservar ese trabajo evita rehacer sistemas que ya están conectados al juego.

## Licencias: evidencia incluida en las descargas

Este apartado registra lo que dicen los archivos recibidos. No se consultaron condiciones nuevas en tiendas ni se verificaron compras o permisos externos.

| Estado | Packs | Evidencia |
|---|---|---|
| Uso comercial permitido según texto adjunto | 07, 19, 20, 21, 22, 23 | LICENSE/readme de cada pack; conservar restricciones y créditos |
| Solo no comercial según texto adjunto | 01, 08, 10, 15, 25 | Licencia de versión Free/Basic/Free Tier |
| No hay licencia de uso suficiente adjunta | 02, 03, 04, 05, 06, 09, 11, 12, 13, 14, 16, 17, 18, 24, 26, 27, 28 | Verificar página original y términos de la descarga concreta |

Las vistas previas premium de Farming Pack se conservan en la biblioteca para poder identificar qué venía en el archivo; no están seleccionadas como arte del juego. No son prueba de que se haya adquirido la versión premium.

El ZIP es una copia de trabajo para el mismo proyecto y su equipo. Varios proveedores restringen la redistribución de los sprites sueltos: no publicar el ZIP como un nuevo pack ni subirlo íntegro a un repositorio público. Para una publicación del juego, conservar y cumplir los permisos de cada proveedor y resolver primero los candidatos pendientes.
