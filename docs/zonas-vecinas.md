# Las zonas de alrededor: qué tienen y por qué

El pueblo exterior es un solo lugar continuo, pero el juego solo mantiene **una zona viva** a la vez. Las demás se
dibujan como dos imágenes (el suelo y la escenografía) para que, al caminar hasta un borde, la zona siguiente ya esté
ahí y cruzar no necesite pantalla de carga (`updateBackdrop` en `src/scenes/WorldScene.ts`).

Una imagen plana no tiene vida propia, y antes eso se notaba al cruzar: la zona que dejabas seguía a la vista pero se
apagaba. Ahora lo que está **cerca de los bordes** (el alcance sale del tamaño real de la vista) recibe estas capas,
ubicadas según su posición en el mundo (`refreshNeighborDecor`):

| Capa | Cómo |
|---|---|
| Sombras proyectadas y de contacto | Siguen al sol como las vivas. Un objeto de reemplazo invisible les da lugar y forma. |
| Luces (faroles, puestos, faro y su haz) | Pasan por el mismo cálculo de iluminación. Cada una conserva la semilla que tiene en su zona, así se enciende en el mismo momento antes y después del borde. |
| Ventanas encendidas y luz que se derrama de casas y locales | Mismo sistema que la zona viva. |
| Props que se mueven | Árboles que se balancean, fuente (con sus cuadros y su rocío) y fogata: una copia visible sobre la imagen quieta, que además se ordena con las personas. |
| Agua animada | Capas de tiles con solo agua, orilla y bordes, sobre la imagen. Comparten el reloj del agua viva, así el mar no muestra costuras. Las barandas de los puentes se dibujan encima porque tapan el tile de agua vecino. |
| Reflejos | `WaterFx` con el origen de la zona: camino de luna, estelas de faroles y salpicaduras. |
| Personas | Ver abajo. |

Nada de esto cambia guardados, IDs ni colisiones: es solo dibujo. Con el modo batería o el movimiento reducido, los props y los
reflejos quedan quietos, como en la zona viva.

## Personas de las zonas vecinas
`TownLife` (vecinos de la historia y mapaches) y `NeighborLife` (vecinos ambientales) **ya simulan a todos en todas las
zonas**, esté o no el jugador ahí: cada uno tiene su recorrido, su posición y lo que está haciendo. Por eso no hizo falta una
simulación nueva "por detrás": quien está en una zona vecina cercana y dentro (o casi dentro) de la pantalla recibe un cuerpo
(`updateEchoes`) puesto donde está en el mundo. Camina y posa según la simulación (sin merodeo propio, ni charla) y, al cruzar,
cede el lugar al cuerpo real de la zona viva, que se crea en el mismo momento. Los que están lejos no tienen cuerpo.

## Lo que se procesa y lo que no
- Las luces ya se filtran por cámara. Se agregó el filtro por vista a los brillos de ventanas.
- El agua repinta solo los tiles de la vista (con margen); cuando cambia la lluvia, o con el modo batería, repinta todos.
- Las vecinas que no están cerca de la vista no reciben nada.

## Flecha de misión
Con el pueblo continuo, la flecha ya no apunta a la puerta de salida de la zona actual: `routeGoal` (`src/world/guide.ts`) la
lleva al punto donde la ruta sale a un interior (la puerta del restaurante, por ejemplo) o al lugar mismo si es exterior,
siempre en coordenadas de la zona donde está el jugador. Se recalcula en cuanto cambia la zona.

## Límites conocidos
- Las vecinas no tienen: insectos, bichos, nubes, lluvia propia, cultivos ni los NPC en movimiento libre (solo su recorrido).
- La imagen de fondo de cada zona se vuelve a dibujar cuando cambia de noche o de etapa del restaurante, como antes.

## Peces
Módulo `src/scenes/fishLife.ts`. Es solo dibujo: no cambia qué se pesca ni las probabilidades.
- **Lugares de pesca:** en vez de los anillos sobre la orilla, una sombra de pez da vueltas bajo el agua cerca del lugar y, cada 9 a 21 s, ese pez salta (con anillo y gotas al salir y al caer). La sombra se desvanece un poco de noche.
- **Dónde:** el agua elegida para cada lugar es la más cercana que está bien adentro (agua en sus cuatro lados y dos tiles de agua hacia arriba), así la sombra no cruza la arena ni el pez parece colgado sobre la orilla. Si un lugar no tiene agua a menos de 3 tiles, conserva los anillos de antes.
- **Saltos sueltos:** cada 4 a 11 s, en agua abierta dentro (o casi dentro) de la pantalla, también en las zonas vecinas. Como mucho dos a la vez.
- **Modo batería o movimiento reducido:** las sombras quedan quietas y no hay saltos.
