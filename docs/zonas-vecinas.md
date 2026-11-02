# Las zonas de alrededor: qué tienen y por qué

> **Reemplazado (02/11/2026):** el exterior ahora es un solo mapa vivo (ver [mapa-unico.md](mapa-unico.md)). Este sistema de
> imágenes de fondo solo sigue usándose desde el Bosque profundo, que es una zona aparte.

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
- **Dónde hay peces (y solo ahí):** un cardumen (de 2 a 4 sombras que nadan en círculos) en cada lugar de pesca, y cuatro en el mar de la playa, bien adentro (a 4 o más tiles de la orilla o del borde del mapa, separados entre sí). En el resto del agua no hay: ni en estanques sin lugar de pesca, ni en el puerto, ni en los ríos.
- **Siempre presentes:** están todos desde que entrás a la zona, y los de las zonas vecinas también, así no aparece ni desaparece nada mientras mirás ni al cruzar un borde. Los del mar son los mismos cada vez (se eligen por el mapa, no al azar).
- **Saltos:** cada 7 a 18 s un cardumen cercano a la vista salta: la mitad de las veces un pez, a menudo dos y a veces tres, con unos instantes de diferencia. Cada uno sale de donde está su sombra, con anillo y gotas al salir y al caer, y su sombra vuelve al caer. Como mucho seis saltos a la vez.
- **Agua elegida para cada lugar de pesca:** la más cercana que tiene agua en las ocho direcciones (y dos tiles de agua hacia arriba, porque un salto sube en pantalla), así no cruza la arena ni parece colgado sobre la orilla. Si un lugar no tiene agua a menos de 3 tiles, conserva los anillos de antes.
- **De noche** las sombras se desvanecen un poco.
- **Modo batería o movimiento reducido:** las sombras quedan quietas y no hay saltos.
