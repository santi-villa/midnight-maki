# Iluminación

## Qué hace
1. **Ambiente por momento del día** (`src/scenes/lightmath.ts`, matemática pura y probada): mañana dorada y fresca, tarde luminosa, atardecer que pasa de dorado a rosa y a lavanda, noche azul profundo. Los interiores quedan cálidos para contrastar con la calle fría.
2. **Faroles** que recortan un charco de luz en la capa de oscuridad y tiñen de cálido el suelo cercano. La textura de luz ahora es de **6 bandas con tramado (dither) 4×4**, para que los charcos de luz se vean pixelados y no un degradé fotográfico.
3. **Variaciones naturales:** respiración lenta (±2 %) en faroles y parpadeo más vivo (±5–8 %) en llamas y faroles de papel.
4. **Ventanas iluminadas:** cada edificio recibe una capa con sus ventanas en ámbar (misma geometría que el sprite, `buildingLayout`), que aparece al atardecer y respira muy despacio.
5. **Restaurante por horario** (`restaurantPhase`): abierto = ventanas, farolitos rojos y puerta (noren) encendidos —la puerta se ve incluso de tarde—; cerrando = más tenue; cerrado = casi apagado. Adentro, el salón se ilumina más o menos según el horario.
6. **Lluvia:** velo gris azulado de día, azul más profundo de noche; faroles y ventanas siguen encendidos pero con halos más húmedos y menos intensos.
7. **Agua:** la luna y las estelas de faroles del agua usan los mismos niveles (`ls.moon`, `ls.lamp`), así reflejos y luces siempre coinciden.
8. **Sombras con profundidad:** las sombras proyectadas siguen al sol: a la derecha por la mañana, a la izquierda por la tarde, largas al atardecer, tenues de noche y suaves con lluvia (también las de los personajes). Los halos aditivos y las luces están por encima de la capa de oscuridad, por debajo de nada que los oculte: los personajes se ven siempre (hay una luz suave propia de Sofi) y las puertas se identifican.

## Rendimiento
- La capa de oscuridad **no se redibuja cada cuadro**: solo cuando cambia algo que la afecta (cámara, jugadora, color ambiente, horario del restaurante) o en los pasos de variación (~12 por segundo). Un contador (`lightRedraws`) lo comprueba en las pruebas.
- **Modo batería / movimiento reducido:** sin respiración ni parpadeo, sin halos aditivos y sin redibujado por variación (la escena quieta no se redibuja). Las luces, las ventanas y las sombras siguen ahí, estáticas.
- Los halos usan un grupo de imágenes reutilizadas; las ventanas son 1–2 imágenes por edificio, creadas una vez.

## Dónde queda
Primero la plaza y el exterior del restaurante; el mismo sistema ya vale para el resto de las zonas (todas pasan por `updateLighting`).

## Pruebas
- `src/tests/light.test.ts`: oscurece de tarde a noche, noche azul, atardecer cálido, interiores más cálidos que la calle, lluvia atenúa pero deja lámparas, luna solo de noche, restaurante por horarios, sombras según el sol.
- `e2e/light.spec.ts`: día / atardecer / noche / lluvia en la plaza (capturas en `docs/art/luces/`), brillo medido alrededor de Sofi, ventanas apagadas de día y encendidas de noche, puerta del restaurante, fachada y salón por horario, y modo batería y movimiento reducido.
