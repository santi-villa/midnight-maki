# Mapaches de peluche: Pip, Spicy y Rigg

Actualización 29/10/2026: Rigg usa ahora una primera hoja de sprites ilustrados
con su atuendo habitual; el generador descrito aquí se conserva para sus atuendos
personalizados y como respaldo. Ver [la entrega de Rigg](rigg-sprites.md).

Pip, Spicy y Rigg ya no usan las piezas compartidas de `src/art/folk.ts`: se dibujan con un generador propio, `src/art/plushRaccoon.ts`, que se activa con `plush: { … }` en su spec (`src/data/folkSpecs.ts`). El resto de los personajes no cambia.

## Qué cambió
- **Trazo en píxeles de salida.** Cada parte se pinta directamente en la grilla final (sin escalar un diseño más grande), con un contorno oscuro de 1 px por parte y sombreado por grupos: borde claro arriba a la izquierda, borde de sombra abajo a la derecha, 2 o 3 tonos por material, sin degradados.
- **Proporciones.** Cabeza ancha y redondeada (26 px), cuerpo compacto con una panza clara grande y redonda, brazos cortos y gruesos con manos oscuras, patas pequeñas y cola gruesa con anillos. El cuadro quedó en 34×39 px (`frameW: 45`; antes 32×39): el ancho extra es la cola, que se ve en todas las direcciones. La altura del cuadro y la línea de los pies no cambian.
- **Cara.** Antifaz en dos manchas más un puente, franja oscura en la frente (marca de Pip), ojos de 2×3 px con un brillo de 1 px, hocico y mejillas crema, nariz y boca de pocos píxeles.
- **Direcciones.** Frente, espalda (franja sobre la coronilla, orejas, cola sobre la espalda baja), y perfiles derecha e izquierda (la izquierda es el espejo exacto de la derecha, como en el resto de las hojas).
- **Los 30 cuadros** siguen en el mismo orden (`FRAMES` en `characters.ts`): caminar con pasitos y rebote, respiración, parpadeo, feliz, sorprendido, dormido, triste (cabeza caída, cejas), orgulloso (párpado pesado y sonrisa de lado), cocinar, saludar (patita levantada), leer (libro) y sentado.
- **Accesorios.** El sombrero y el accesorio de cuerpo que presta el creador de personaje se siguen dibujando.
- **Retrato.** Sale del cuadro frontal, así que también es nuevo.

## Cómo se verifica
`e2e/pip-sprite.spec.ts` (una vez por mapache) comprueba en un navegador real: tamaño de la hoja (30 × 36×39), pies en las últimas filas, perfil izquierdo = espejo del derecho, cabeza simétrica de frente, ojos iguales a cada lado, sin ojos de espalda, cola visible en las cuatro direcciones y que caminar, estados de ánimo y acciones sean cuadros distintos.

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

`docs/pip-ajuste-comparacion.png` muestra la versión anterior contra la ajustada, y `docs/mapaches-en-el-restaurante.png` a los tres mapaches dentro del restaurante junto a Sofi, Taro, Bento y Momo.

## Spicy y Rigg (a partir de las imágenes de referencia)
Los tres comparten el mismo generador y cambian solo los datos de su spec:

| | Tamaño | Pelaje | Rasgos |
|---|---|---|---|
| Pip | `big` | gris cálido | franja ancha en la frente, cejas crema sobre el antifaz, orejas crema con interior marrón, panza crema |
| Spicy | `small` | gris cálido | dos manchas oscuras separadas en los ojos, orejas grises con interior crema, hocico y panza crema; conserva la bandana roja y el delantal |
| Rigg | `small` | naranja (panda rojo) | manchas negras separadas, mejillas crema, brazos y patas marrón oscuro, cola grande con anillos marrones |

Los colores salen de las imágenes de referencia (se muestrearon con una paleta de 10 a 12 colores). Spicy y Rigg ocupan 32×39 px de cuadro y su figura mide 29 px de alto; Pip, 34×39 y 31 px. Los tamaños del código están en `BIG` y `SMALL` (`plushRaccoon.ts`).

`docs/mapaches-referencia-vs-sprite.png` pone cada referencia junto a su sprite.
