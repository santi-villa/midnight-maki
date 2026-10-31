# Serene Village para la naturaleza de Villa Nori

Integrado el 30/10/2026 desde la descarga local `Serene Village/SERENE_VILLAGE_REVAMPED`.
Se usa `Serene_Village_16x16.png` de la versión 1.9, a resolución nativa.

## Función y zonas

Serene Village pasa a ser la familia visual de la naturaleza común: árboles
frondosos, arbustos, flores, piedras, cercas, césped y caminos de tierra. Se aplica
a los IDs existentes, por lo que aparece en el Bosque Susurrante, el Jardín de los
Faroles, los parques y las zonas verdes de Villa Nori, además de los elementos
naturales equivalentes de las otras zonas.

Se sustituyen dibujos en sus ubicaciones actuales. No se añaden filas de árboles,
adornos ni obstáculos; la densidad y las huellas lógicas quedan iguales. Se mantienen
las puertas, los senderos, los puntos de recolección, la pesca y las mejoras futuras.
Los pinos, los cerezos rosados y el árbol otoñal conservan su arte: la lámina no
incluye equivalentes de esas especies. Tampoco se importan las casas ni el agua.
La playa conserva su arena beige y su decoración despejada.

| Pieza de Serene | ID del juego / uso |
| --- | --- |
| Árbol salvia | `tree`: parques, jardines y bordes verdes |
| Árbol de bosque | `tree_dark`: bosque y límites del mapa |
| Arbusto bajo | `bush` |
| Arbusto rosado | `bush_flower`, `bush_berry`: variantes decorativas; no cambian las recompensas de recolección |
| Margaritas | `flowers` |
| Flores azules | `flowers_lav`: mantiene el ID histórico, ahora con flores azules del pack |
| Piedra pequeña | `rock` |
| Grupo de piedras | `bigrock` |
| Tramo de cerca rural | `fence`: límites de huerta y jardines |
| Césped y tierra | Bases de los tiles existentes; conservan las variaciones discretas, bordes y pequeños detalles propios del juego |

## Escala y paleta

Los nueve sprites se dibujan sin escalarlos: se elimina solo el margen transparente
y se apoyan en el mismo pivote inferior que los props anteriores. Los árboles
frondosos son más compactos que los dibujos originales. El atlas mide 256×128 px,
ocupa 4.721 bytes e incluye además las dos bases de terreno.

Se adaptan los verdes y la tierra a la paleta suave del pueblo, para que el césped
encaje con los bordes existentes y el suelo no gane una saturación amarilla intensa.
Los mechones y detalles discretos propios del juego siguen encima de las nuevas
bases de terreno; el césped oscuro usa una sombra suave sobre la base del pack.
El catálogo registra cada sustitución de color. Las formas y los píxeles de los
objetos mantienen la resolución nativa.

## Archivos y reproducción

```
python scripts/build-serene-assets.py
```

El script encuentra la carpeta local por defecto. También acepta `SERENE_SRC`
apuntando a `SERENE_VILLAGE_REVAMPED`.

- `src/assets/serene/atlas.png`: únicamente las piezas seleccionadas.
- `src/assets/serene/catalog.json`: rectángulos de origen, recortes transparentes,
  hash SHA-256 de la lámina fuente, adaptación de paleta e IDs sustituidos.
- `src/assets/serene/CREDITS.txt`: atribución, fuente, licencia y modificaciones.
- `src/art/serene.ts`: carga y dibujo de los recortes.

BootScene instala el atlas antes de generar terreno y texturas de objetos.
`?serene=classic` permite comparar con los dibujos anteriores. Si el atlas no
carga, se usan esos mismos dibujos de respaldo, sin cambiar el mapa.

## Validación

- Typecheck y build de producción.
- 44 pruebas existentes de zonas, distribución exterior y fachadas: accesos,
  senderos completos, interacciones y renovaciones futuras.
- Tres pruebas de navegador: píxeles de los diez IDs idénticos a los recortes
  del atlas, bases de terreno completas, continuación de una partida y respaldo
  con el atlas desactivado o ausente.
- Capturas revisadas: `docs/serene-forest.png`, `docs/serene-garden.png` y
  `docs/serene-plaza.png`.

## Autor y licencia

[Serene Village revamped, de LimeZu](https://limezu.itch.io/serenevillagerevamped).
La página oficial identifica el pack bajo
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/),
revisado el 30/10/2026. El juego atribuye autor y pack en Créditos, enlaza fuente
y licencia e indica los recortes y la adaptación de paleta. El catálogo y
`CREDITS.txt` conservan esa información junto al atlas.
