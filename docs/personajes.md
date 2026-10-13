# Personajes: estilo nuevo ("folk")

Los 15 vecinos y mapaches (Pip, Spicy, Rigg, Momo, Taro, Yuki, Kumo, Nami, Hoshi, Bento, Sumi, Kiki, Sora, Abuela Ume y Akio) usan el motor nuevo `src/art/folk.ts`. Sofi todavía usa el anterior hasta que llegue su imagen.

## Qué cambió
- Sprites de **24×39** (Pip, más ancho, 32×39), casi del tamaño de los anteriores (20×30), con cabeza grande y cuerpo corto para que sean más tiernos. Se diseñan en una grilla de 32×52 y se rasterizan a 0,75, así los píxeles quedan nítidos.
- Los rostros se dibujan directo en píxeles finales, para que los dos ojos sean siempre idénticos.
- Cada parte (cola, cuerpo, brazos, orejas, cabeza, pelo, sombrero) se pinta con 3 tonos y contorno propio, como en tu hoja de referencia.
- Las **30 animaciones de siempre** para todos: caminar en 4 direcciones, parpadeo, feliz, sorprendido, triste, canchero, dormido, respiración, cocinar, saludar, leer y sentarse.
- Retratos de diálogo generados con el mismo dibujo (nítidos, sin recortes borrosos de la hoja).
- El **ropero de los mapaches** sigue funcionando: sombreros y accesorios que les pongas se dibujan sobre el nuevo estilo.

## Cómo agregar uno nuevo (por ejemplo, clientes genéricos)
1. Agregá una entrada en `src/data/folkSpecs.ts` con la especie (`ears`: pointy / cat / round / long / none), colores, ropa (`top`, `legs`, `deco`), sombrero o pelo, cola.
2. Con `human: true` se dibuja una cara humana (sin hocico), con cejas y barba opcional.
3. Se ve en `docs/art/personajes.png` al regenerar las imágenes de referencia.

## Pruebas
- `src/tests/folk.test.ts`: que estén los 15 (ninguno de más ni de menos) y que todos los colores sean válidos.
- `e2e/folk.spec.ts`: los 15 generan las 30 cuadros sin vacíos, las 4 direcciones y expresiones se diferencian, los pies quedan en las últimas filas.

## Clientes del restaurante (8 animales de 28×40)
Oli (cerdito), Toby (koala), Fredi (zorro), Pipo (pingüino), Po (panda), Gigi (jirafa), Nico (capibara) y Leo (león), de `src/art/customers.ts` / `src/assets/clientes/`, ya son los clientes que entran al restaurante (antes eran humanos y animales genéricos del estilo viejo).
- Cada grupo de clientes usa siempre los mismos animales (estable por grupo, así una pareja no cambia de cara a mitad de la comida).
- `src/art/customerSheet.ts` los convierte al formato de 30 cuadros que ya entiende `Actor`, más 5 cuadros extra: comer (4) y respirar sentado (1).
- Animaciones: esperar y parpadear, caminar, sentarse y comer. Como solo hay vista frontal y de perfil, caminar hacia abajo usa el frente con un saltito alternado y espejado, y caminar hacia arriba usa el perfil. Sentados miran de perfil y se espejan si la silla mira a la izquierda.
- Pruebas: `src/tests/customers.test.ts` y `e2e/customers.spec.ts`; captura en `docs/art/clientes-en-juego.png`.
