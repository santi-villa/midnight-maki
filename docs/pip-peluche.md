# Pip, mapache de peluche

Pip ya no usa las piezas compartidas de `src/art/folk.ts`: se dibuja con su propio generador, `src/art/pipPlush.ts`, activado por `plush: true` en su spec (`src/data/folkSpecs.ts`). El resto de los personajes no cambia.

## Qué cambió
- **Trazo en píxeles de salida.** Cada parte se pinta directamente en la grilla final (sin escalar un diseño más grande), con un contorno oscuro de 1 px por parte y sombreado por grupos: borde claro arriba a la izquierda, borde de sombra abajo a la derecha, 2 o 3 tonos por material, sin degradados.
- **Proporciones.** Cabeza ancha y redondeada (26 px), cuerpo compacto con una panza clara grande y redonda, brazos cortos y gruesos con manos oscuras, patas pequeñas y cola gruesa con anillos. El cuadro quedó en 34×39 px (`frameW: 45`; antes 32×39): el ancho extra es la cola, que se ve en todas las direcciones. La altura del cuadro y la línea de los pies no cambian.
- **Cara.** Antifaz en dos manchas más un puente, franja oscura en la frente (marca de Pip), ojos de 2×3 px con un brillo de 1 px, hocico y mejillas crema, nariz y boca de pocos píxeles.
- **Direcciones.** Frente, espalda (franja sobre la coronilla, orejas, cola sobre la espalda baja), y perfiles derecha e izquierda (la izquierda es el espejo exacto de la derecha, como en el resto de las hojas).
- **Los 30 cuadros** siguen en el mismo orden (`FRAMES` en `characters.ts`): caminar con pasitos y rebote, respiración, parpadeo, feliz, sorprendido, dormido, triste (cabeza caída, cejas), orgulloso (párpado pesado y sonrisa de lado), cocinar, saludar (patita levantada), leer (libro) y sentado.
- **Accesorios.** El sombrero y el accesorio de cuerpo que presta el creador de personaje se siguen dibujando.
- **Retrato.** Sale del cuadro frontal, así que también es nuevo.

## Cómo se verifica
`e2e/pip-sprite.spec.ts` comprueba en un navegador real: tamaño de la hoja (30 × 36×39), pies en las últimas filas, perfil izquierdo = espejo del derecho, cabeza simétrica de frente, ojos iguales a cada lado, sin ojos de espalda, cola visible en las cuatro direcciones y que caminar, estados de ánimo y acciones sean cuadros distintos.

`docs/pip-antes-despues.png` compara el sprite anterior con el nuevo.

## Ajuste de tamaño
La primera versión del peluche medía 32×34 px (ancho × alto de la figura) y se veía grande al lado del resto. El ajuste lo deja en **31×31**, siempre con los pies en la última fila:

| Personaje | Figura (ancho × alto, px) |
|---|---|
| Sofi (jugadora) | 20 × 29 |
| Spicy, Rigg | 22 × 28 |
| Taro | 22 × 30 |
| Bento | 20 × 32 |
| Momo | 20 × 36 |
| **Pip** | **31 × 31** |

Pip es el mapache más ancho y más grandote (3 px más alto que Spicy y Rigg, 9 px más ancho) sin pasar a Taro ni a Bento en altura.

Cómo se ajustó, sin escalar ninguna imagen: la cabeza pasó a elipse de radios enteros (24×16 px) centrada en un píxel exacto, así sus bordes caen justo entre píxeles y no hay medios píxeles; el torso (22 px), la panza (16 px), los brazos, las orejas y las patas usan centros y radios enteros o medios exactos, y la cola es más corta y más fina. Se conservan la cara, las expresiones, los 30 cuadros y la posición de los pies.

`docs/pip-ajuste-comparacion.png` muestra la versión anterior contra la ajustada, y `docs/pip-en-el-restaurante.png` a Pip dentro del restaurante junto a Sofi, Spicy, Rigg, Taro, Bento y Momo.
