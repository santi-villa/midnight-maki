# Phaser 4 y sus mejoras visuales

04/11/2026. El juego pasó de Phaser 3.88.2 a **Phaser 4.2.1**. Actualizar en sí casi no pidió cambios (una línea en la capa
del mapa). Encima se agregaron cuatro mejoras que solo existen en Phaser 4.

## 1. Suelo del pueblo en la GPU (`TilemapGPULayer`)
- El piso del pueblo (120×80 casillas) se dibuja de una sola vez, con un shader, en lugar de casilla por casilla. Los
  interiores son chicos y siguen con la capa clásica.
- **El agua se mueve sola en la GPU.** El tileset lleva una tabla de animación (`src/scenes/groundAnim.ts`): cada casilla
  de mar, laguna, orilla y borde de pasto dice qué casilla le sigue y cada cuánto (mar 225 ms, lagunas 450 ms, bordes 900 ms).
  Así el juego ya no reescribe cientos de casillas por segundo; solo las vuelve a escribir cuando empieza o para la lluvia.
- **Verificación automática** (`src/scenes/gpuProbe.ts`): algunos navegadores sin placa de video (WebGL por software)
  ejecutan ese shader sin errores pero no dibujan nada, y el piso quedaría negro. Mientras está la pantalla de título, el
  juego dibuja una casilla con la capa en GPU durante un solo cuadro, en una cámara de 8×8 píxeles en la esquina, y lee ese
  píxel de la pantalla. Solo si la casilla aparece usa la capa en GPU; si no, la clásica, que siempre funciona.
- `?nogpu` en la dirección fuerza la capa clásica (para comparar).

## 2. Clima denso en la GPU (`SpriteGPULayer`)
`src/scenes/gpuWeather.ts`: miles de partículas sobre todo el pueblo en una sola llamada de dibujo. Cada una cae, deriva con
el viento y gira con animaciones que corre la GPU sola, en bucle y cada una desfasada, así que el procesador no hace nada
por cuadro.

| Clima | Cuándo | Cantidad aprox. en el pueblo |
|---|---|---|
| Nieve | invierno sin lluvia | ~3.500 copos (antes, un emisor liviano) |
| Lluvia | cuando llueve | ~4.700 gotas, además de los charcos y salpicaduras de siempre |
| Hojas de otoño | otoño, de día, sin lluvia | ~600 |
| Pétalos | primavera, de día, sin lluvia | ~400 (además de los que caen de los cerezos) |

Con movimiento reducido o en modo batería no aparecen (queda lo anterior, más liviano).

## 3. Filtros de cámara y del agua
- **Color según la hora** (`src/scenes/grade.ts`, `cameraFx.ts`): mañana apenas cálida, tarde neutra, atardecer dorado
  y noche más azul; la lluvia apaga un poco los colores. Cada parte del día pasa a la siguiente en su último tercio, sin
  saltos. Los interiores quedan neutros (tienen su propia luz).
- **Brillo de noche (bloom):** se toma lo más luminoso de la imagen (faroles, ventanas, linternas), se desenfoca y se
  suma encima en un tono cálido. Crece a medida que se encienden las luces.
- **Desenfoque detrás del celular y los menús:** al abrir el celular o un menú, el mundo de atrás se desenfoca suavemente;
  la interfaz queda nítida (es HTML encima del juego).
- **Agua que ondula** (`src/scenes/waterRipple.ts`): las casillas de agua se dibujan una segunda vez en una capa propia,
  con un filtro de desplazamiento alimentado por un patrón fino de ondas que cambia cada 150 ms. El agua y lo que se
  refleja en ella se mueven; la tierra queda quieta.

Modo batería: sin color, sin brillo y sin ondulación. El desenfoque de menús queda (no se mueve nada).

## 4. Luces 2D sobre los personajes
La escena del mundo enciende las luces de Phaser 4 con ambiente blanco (de día no cambian nada). De noche, los 10 faroles
encendidos más cercanos al jugador pasan a ser luces reales que solo toman los personajes. Quien camina bajo un farol,
junto a un farolito o frente a una ventana iluminada se ve con un toque cálido según la distancia, cabeza incluida (antes
solo se iluminaba el piso). El color es la mitad entre el del farol y el blanco, para que no quede un tinte amarillo.

## Cómo se verificó
- **Compilación y tests:** compila sin errores y pasan todos los tests unitarios, salvo `residentSleep` (*resumes a
  returning restaurant visitor*), que ya fallaba antes de este cambio con Phaser 3. Hay tests nuevos en
  `src/tests/phaser4Fx.test.ts` y `src/tests/grade.test.ts`.
- **Capturas en el navegador de pruebas:**
  - el clima con nieve, hojas, lluvia y pétalos;
  - el color por hora;
  - el brillo de noche;
  - el desenfoque con el celular abierto;
  - el agua ondulando con la arena quieta;
  - el jugador junto a un farol con y sin la luz.
- **Límite:** el navegador de pruebas no tiene placa de video. Ahí la capa de suelo en GPU no se ve, la verificación lo
  detecta y usa la clásica. Por eso la versión en GPU del suelo y de su agua animada no se pudo ver funcionando: hay que
  confirmarla en un equipo con placa de video.
