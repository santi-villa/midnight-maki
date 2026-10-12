# Menú principal (rama `menu-principal`)

## Qué hace
1. Al abrir el juego se ve **solo la ilustración** (con el logo de Midnight Maki incluido) y el mensaje sutil **«Tocá para comenzar»**.
2. El **primer toque, clic o tecla** desbloquea el audio del navegador (`audio.unlock()`), arranca la música del menú y hace aparecer los botones con un fundido suave.
3. Botones (pixel art, los mismos de madera del juego): **Continuar** (solo si hay partida), **Nueva partida**, **Cargar partida**, **Opciones**, **Créditos**.
   - Continuar / Nueva partida / Opciones / Créditos usan exactamente las funciones que ya existían (`loadGame`, `continueGame`, `openCreator`, `startNewGame`, `openSettings`).
   - Cargar partida abre un panel con: seguir con la partida del dispositivo, abrir un archivo de copia (`importSaveFile`) o pegar un código (`saveFromCode`).
4. El sistema de partidas no se tocó.

## Fondo
- `public/title/title-vertical.webp` (celulares en vertical) y `public/title/title-horizontal.webp` (PC y celular en horizontal).
- Salen de las imágenes de referencia; les saqué el texto «PRESS BUTTON 2026» y, en la vertical, cambié el subtítulo en inglés por el español.
- La ilustración se muestra **entera** (nunca recortada): se encaja en la pantalla y el sobrante se rellena con la misma imagen desenfocada. Así el logo no queda cortado en ningún tamaño.

## Animaciones (discretas y baratas)
Solo `opacity` / `transform` sobre unos 30 elementos: brillo de faroles y ventanas, estrellas que titilan, destellos en el agua y hojas que caen.
- **Movimiento reducido** (ajuste del juego o preferencia del sistema): todo queda estático.
- **Modo batería / FPS bajos**: se quitan hojas, agua y estrellas (quedan los brillos).
- Mientras la imagen está, la escena Phaser del menú viejo se duerme (no dibuja). Si la imagen no carga, vuelve a verse esa escena con el logo anterior.

## Música
- Canciones propias en **`src/music/`**; el nombre del archivo elige la escena: `main-menu-music.mp3` → menú, `introduction-music.mp3` → intro de la historia, `kitchen-minigame-music.mp3` → minijuego de cocina.
- Se reproducen en streaming (sin decodificar todo en memoria), en loop, con entrada suave, directo al volumen de música del juego (respeta el ajuste Música).
- Las escenas sin archivo, o si un archivo falla, siguen con la música generada. No se eliminó nada del sistema de audio.

## Resultados de las pruebas
- `tsc --noEmit`: sin errores.
- `npm test` (Vitest): 89/89.
- `npm run build`: OK.
- `e2e/title.spec.ts` (nuevo): 5/5 — solo ilustración + mensaje primero; el primer toque desbloquea audio y muestra el menú; botones de ≥44 px y dentro de pantalla en 390×844, 360×740, 844×390 y 1280×720 (la imagen nunca se sale); movimiento reducido apaga animaciones; panel de cargar (código inválido, créditos, opciones); Continuar carga la partida guardada.
- Prueba con las tres canciones reales: menú, intro y cocina arrancan, y al pasar a otra escena vuelve la música generada.
- `e2e/newgame.spec.ts`: ya fallaba antes de este trabajo en `master-mgsshv` (cambio de la cocina de otra persona: el paso «Servir todo» ya no existe como lo espera el test). No es del menú.
