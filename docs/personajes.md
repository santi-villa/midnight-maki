# Personajes: estilo nuevo ("folk")

Los 15 vecinos y mapaches (Pip, Spicy, Rigg, Momo, Taro, Yuki, Kumo, Nami, Hoshi, Bento, Sumi, Kiki, Sora, Abuela Ume y Akio) usan el motor nuevo `src/art/folk.ts`. Sofi todavía usa el anterior hasta que llegue su imagen.

## Qué cambió
- Sprites de **32×52** (la figura mide 44 filas y el resto es aire para orejas largas y sombreros; Pip usa 42 de ancho). Antes eran 20×30.
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
