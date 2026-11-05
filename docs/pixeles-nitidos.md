# Píxeles nítidos en cualquier pantalla

Etapa 3 del plan de mejoras visuales (05/11/2026).

## El problema
El canvas del juego medía lo mismo que la ventana en píxeles CSS, y el navegador lo estiraba según la densidad de la pantalla (`devicePixelRatio`).
- En una PC (densidad 1) eso no se nota.
- En un Android típico la densidad es 2,625 o 2,75. Con zoom 2, cada píxel del juego quedaba en 5,25 píxeles reales, así que algunos medían 5 y otros 6.
- Los contornos se veían con escalones desparejos y las líneas rectas "temblaban" al caminar.
- Medido en una captura de un Pixel 7: solo el 37 % de los tramos de color tenía ancho par.

## La solución
El canvas ahora tiene **s píxeles por píxel CSS** (`src/core/pixelRatio.ts`), con `s = densidad / k` y `k` entero. El navegador estira el canvas exactamente `k` veces, y la cámara, que siempre usa zoom entero, cae en píxeles reales enteros.

`k` es el menor entero que deja `s` por debajo de un tope:
- **Normal (tope 2):** 2,625 da canvas ×1,3125 y 6 píxeles reales por píxel del juego; 3 da ×1,5; 2 da ×2; 1,25 da ×1,25.
- **Modo batería (tope 1):** 2,625 da canvas ×0,875. Son menos píxeles que antes (más liviano) y siguen nítidos.
- **PC con densidad 1:** no cambia nada.

## Detalles
- **Ancho y alto pares.** Phaser centra la cámara en la mitad del canvas. Con un lado impar, todo el mundo quedaba corrido medio píxel del canvas y en el borde de un personaje aparecía una línea del cuadro vecino de la hoja.
- **Medidas en píxeles CSS.** El alto del panel de decoración y los márgenes de las barras del HUD en la cocina se multiplican por `gamePx()` antes de que los use la cámara.
- **Desenfoques.** El desenfoque del brillo nocturno y el de los menús se escalan con `gamePx()`, así se ven igual que antes.
- **Modo batería.** Al cambiar de modo, el canvas se vuelve a dimensionar (`refitViewport`).
- **Entrada.** El mouse y el toque siguen bien: Phaser convierte con el rectángulo real del canvas. Medido: el punto CSS (100, 200) cae en (131,25, 262,5) del canvas, que es ×1,3125.
- **Encuadre.** Lo que se ve del pueblo casi no cambia: la regla de "al menos 11 casillas en el lado corto" ahora se calcula en píxeles del canvas.

Archivos:
- `src/core/pixelRatio.ts`
- `src/main.ts`: modo `Scale.NONE`, el canvas lo dimensiona el juego.
- `src/core/perf.ts`: `lowPower`.
- `src/scenes/WorldScene.ts`
- `src/scenes/cameraFx.ts`
- `src/ui/kitchenFrame.ts`

## Cómo se verificó
- **Unit tests:** `src/tests/pixelRatio.test.ts`. Para doce densidades, en modo normal y batería: cada píxel del canvas es un número entero de píxeles reales, nunca se pasa del tope, los lados son pares y la cocina sigue entrando entre las barras del HUD.
- **Capturas en el navegador**, en `.claude/skill-tests/stage3/`:
  - Pixel 7 (412×915, 2,625): pasó de 37 % a 99 % de tramos pares, y 93 % cae en la grilla de 6 píxeles reales.
  - También se probaron horizontal, PC (1280×800, densidad 1, sin cambios), retina (densidad 2) y modo batería, todo sin errores.
  - Cocina en el teléfono: antes zoom 1,5 (3,94 píxeles reales, desparejo); ahora zoom 2 en el canvas (4 píxeles reales, entero).

## Costo y límites
- **Más píxeles.** En un teléfono de densidad 2,625 el canvas tiene 1,72 veces más píxeles que antes, y los filtros de pantalla completa (brillo, color, ondas) trabajan sobre todos. En modo batería tiene menos píxeles que antes. Hace falta medirlo en un teléfono real.
- **Sigue habiendo movimiento suave entre píxeles.** Un personaje que camina puede quedar a un tercio de píxel del juego, ahora en pasos parejos de 2 píxeles reales. Es el movimiento suave normal de la cámara y ya pasaba antes.
