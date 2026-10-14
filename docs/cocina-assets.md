# Imágenes para la cocina (para pedir a una IA o dibujar)

Todas son **PNG con fondo transparente**, pixel art de **mayor detalle que el resto del juego** (la pantalla de cocina es aparte), vista cenital/3-4 como el resto, luz desde arriba a la izquierda, contorno marrón oscuro `#2b1d17` de 1 px, paleta cálida y tomada de la imagen de referencia. El motor las dibuja con el tablero a **2× la resolución actual** (640×480 horizontal, 440×600 vertical), así que los tamaños de abajo son los finales en píxeles. Mientras no estén, el juego usa el dibujo por código.

## Prompt maestro (poner al inicio de cada pedido)
```
Detailed pixel art sprite for a cozy sushi-cooking minigame, top-down three-quarter view, transparent background,
crisp 1px dark brown outline (#2b1d17), soft 3-tone shading with light from the top-left, warm saturated colors,
clean readable shapes, no anti-aliasing blur, no text, no drop shadow baked in, centered, same style across the set.
```

## Lista (nombre del archivo → tamaño → qué es)
**Escenario**
- `mesa.png` 128×128 → madera clara, se repite sin cortes (tileable).
- `esterilla.png` 340×220 → makisu de bambú con hilos.
- `tabla.png` 380×230 → tabla de cortar de madera clara con vetas.
- `plancha.png` 360×220 → plancha metálica gris con tres perillas y un borde (como la imagen).
- `sarten-tamago.png` 220×160 → sartén rectangular de tamagoyaki con mango.
- `freidora.png` 260×200 → olla de aceite con canasto.
- `bandeja.png` 380×200 → bandeja de madera con seis compartimientos (3×2).
- `tacho.png` y `tacho-abierto.png` 64×72.
- `plato.png`, `plato-largo.png`, `plato-hondo.png` 160×120 → tres emplatados.

**Comida (cada una en estados)**
- `alga.png` 230×180 · `arroz-capa.png` 220×170 (granos, tileable) · `arroz-bocado.png` 120×90 (para cucharear).
- Ingredientes: salmón, atún, pepino, palta, tamago, langostino, kanikama, queso crema, mango, anguila, huevas, cebolla de verdeo, zanahoria, shiitake, tempura (copos), sésamo, wasabi, jengibre, umeboshi, pétalos de sakura, frutillas, carambola, perla de luna. Cada uno: `x-entero.png` 96×72 y `x-corte.png` 96×72 (rodaja/tira).
- Cocción (salmón, langostino, anguila, tamago, tempura): `x-crudo.png`, `x-listo.png`, `x-quemado.png` 96×72 cada uno.
- `rollo.png` 300×64 (rollo cerrado, horizontal) y `rollo-corte-a/b/c/d/e/f.png` 56×56 (el corte visto de frente, 6 rellenos distintos: salmón-palta, pepino, atún, tamago, langostino, mixto).
- `nigiri-base.png` 72×48, `gunkan.png` 72×64, `temaki.png` 80×110.

**Herramientas**
- `cuchillo.png` 140×30 y `cuchillo-sucio.png` (con arroz pegado).
- `trapo.png` 64×44 y `trapo-mojado.png`.
- `espatula.png` 70×90, `pinzas.png` 70×90, `salero.png` 40×56, `aceite.png` 40×64, `cuchara-arroz.png` 80×50.

**Interfaz**
- `banner.png` → rollo de pergamino para las instrucciones, 9-slice (96×64, esquinas de 20 px).
- `boton.png` y `boton-pulsado.png` 9-slice 72×40; `cerrar.png` 56×56 rosa con una X.
- `pestana-pendiente/actual/hecha/ocupada.png` 9-slice 80×36 (gris / naranja / verde / con reloj).
- `barra-marco.png` 160×22 → marco de las barras de punto de cocción y de tiempo.
- `ticket-pedido.png` 9-slice 160×80 → globo de pedido junto al retrato.
- Partículas: `vapor-1/2/3.png`, `humo-1/2/3.png`, `chispa.png`, `grano.png`, `gota.png` (16–32 px).
- `check.png`, `llama.png`, `reloj.png` 32×32.

## Cómo pasármelas
Una carpeta por grupo, con los nombres de arriba. Con 5–10 piezas ya puedo probar el sistema; el resto se reemplaza de a poco. Si alguna no se parece al resto, pasame esa y la reviso.
