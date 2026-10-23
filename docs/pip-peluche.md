# Pip, mapache de peluche

Pip ya no usa las piezas compartidas de `src/art/folk.ts`: se dibuja con su propio generador, `src/art/pipPlush.ts`, activado por `plush: true` en su spec (`src/data/folkSpecs.ts`). El resto de los personajes no cambia.

## Qué cambió
- **Trazo en píxeles de salida.** Cada parte se pinta directamente en la grilla final (sin escalar un diseño más grande), con un contorno oscuro de 1 px por parte y sombreado por grupos: borde claro arriba a la izquierda, borde de sombra abajo a la derecha, 2 o 3 tonos por material, sin degradados.
- **Proporciones.** Cabeza ancha y redondeada (26 px), cuerpo compacto con una panza clara grande y redonda, brazos cortos y gruesos con manos oscuras, patas pequeñas y cola gruesa con anillos. El cuadro pasó de 32×39 a 36×39 px (`frameW: 48`): el ancho extra es la cola, que ahora se ve en todas las direcciones. La altura y la línea de los pies no cambian.
- **Cara.** Antifaz en dos manchas más un puente, franja oscura en la frente (marca de Pip), ojos de 2×3 px con un brillo de 1 px, hocico y mejillas crema, nariz y boca de pocos píxeles.
- **Direcciones.** Frente, espalda (franja sobre la coronilla, orejas, cola sobre la espalda baja), y perfiles derecha e izquierda (la izquierda es el espejo exacto de la derecha, como en el resto de las hojas).
- **Los 30 cuadros** siguen en el mismo orden (`FRAMES` en `characters.ts`): caminar con pasitos y rebote, respiración, parpadeo, feliz, sorprendido, dormido, triste (cabeza caída, cejas), orgulloso (párpado pesado y sonrisa de lado), cocinar, saludar (patita levantada), leer (libro) y sentado.
- **Accesorios.** El sombrero y el accesorio de cuerpo que presta el creador de personaje se siguen dibujando.
- **Retrato.** Sale del cuadro frontal, así que también es nuevo.

## Cómo se verifica
`e2e/pip-sprite.spec.ts` comprueba en un navegador real: tamaño de la hoja (30 × 36×39), pies en las últimas filas, perfil izquierdo = espejo del derecho, cabeza simétrica de frente, ojos iguales a cada lado, sin ojos de espalda, cola visible en las cuatro direcciones y que caminar, estados de ánimo y acciones sean cuadros distintos.

`docs/pip-antes-despues.png` compara el sprite anterior con el nuevo.
