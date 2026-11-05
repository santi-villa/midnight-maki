# Humo, vapor y vía de la estación

Primera etapa del plan de mejoras visuales (05/11/2026). Son tres cambios chicos, sobre sistemas que ya existían, y se ven igual con o sin los packs privados.

## 1. Bocanadas de humo y vapor (Pixelbolt)
**Antes.** Cada partícula era un cuadrado liso (2×2, 3×3 o 4×4), y además se agrandaba con escala no entera. Pasaba en tres lugares: la chimenea de la cabaña del bosque, el vapor sobre el techo de Midnight Maki y el vapor de la cocina adentro del restaurante.
- El resultado se veía como una mancha o una estela borrosa.
- El humo de la chimenea casi no se veía.
- Había un error de fondo: el vapor de afuera y el de adentro usaban la misma clave de textura (`steam`) con tamaños distintos, así que el que se creaba primero pisaba al otro.

**Ahora.** Cada partícula es una bocanada de pixel art de 8×8 en 6 cuadros. Nace chica, toma volumen con luz arriba a la izquierda y se deshace en píxeles sueltos.
- El crecimiento está dibujado: ya no hay escala no entera.
- Cada partícula reproduce los 6 cuadros una vez durante su vida (animación de partícula de Phaser 4).

Colores, tomados de `src/art/palette.ts`:
- humo: blanco, `stoneL` y `stone`;
- vapor: blanco, `cream` y `cream2`.

**Archivos**
- `src/art/fx/puff.recipe.json`: receta de Pixelbolt y fuente del dibujo. Para verla:
  `npx -y pixelbolt@0.11.0 inspect src/art/fx/puff.recipe.json --out frames.png`
- `src/art/puff.ts`: lee los cuadros de la receta y los pinta en una tira.
- `src/scenes/textures.ts`: `puffEmitter(scene, 'smoke' | 'steam', vidaMs)` devuelve la textura y la animación.
- `src/scenes/WorldScene.ts`: chimeneas y vapor de la cocina.
- `src/world/restaurantBreath.ts`: vapor del techo del restaurante.

El vapor del techo ahora sale del borde real de la fachada (`restaurantFacadeLayout`), tanto con la fachada clásica como con la de VectoRaith. Antes salía de una altura fija y quedaba flotando sobre el techo.

En modo batería o con movimiento reducido no hay humo ni vapor, igual que antes.

## 2. Vía de tren que se lee como vía (Pixel Art Studio)
**Antes.** El tile `rail` dibujaba los rieles en vertical, pero las filas `R` del mapa van de izquierda a derecha. Desde arriba, la vía parecía una cerca.

**Ahora.** Hay dos rieles a lo largo de la fila (canto claro y lado oscuro) con su sombra sobre el balasto. Encima van cuatro durmientes cruzados, más óxido y algo de pasto, porque es una estación abandonada. El tile se repite sin cortes.
- Lo pinta `rail()` en `src/art/tiles.ts`.
- El diseño se hizo con Pixel Art Studio; el script queda en `.claude/skill-tests/stage1/rail/build.py`.

## 3. La vía sigue hacia el este
Antes la vía terminaba en la hilera de árboles (x 103) y la franja de x 104 a 119 era pasto vacío. Ahora la vía cruza esa franja y sale del pueblo por el borde este (`installVillageWorld`, `src/data/villageWorld.ts`).
- Se puede caminar sobre ella, como sobre el resto de la vía.
- No hay nada encima.
- No se movió ningún lugar, puerta, NPC ni interacción.

## Cómo se verificó
- **Compilación:** `npm run typecheck` y `npm run build`.
- **Tests del pueblo, la luz y el ambiente:** `village`, `villageSample`, `villageDress`, `zones`, `worldmapLayout`, `habitats`, `townAmbience`, `light`, `phaser4Fx` y `shopArt`.
- **Test nuevo `src/tests/ambientArt.test.ts`:**
  - la receta respeta su contrato: 8×8, solo los colores de la bocanada, nace chica, crece y se deshace;
  - la vía cruza todo el distrito, se puede caminar y nada sólido se apoya en ella.
- **Capturas antes y después en el juego, con el mismo encuadre:** `.claude/skill-tests/stage1/compare-*.png`. En el navegador de pruebas (sin placa de video) el tiempo de juego corre más lento, así que las capturas de efectos esperan 12 s.

## Límites
- Las capturas son del arte de respaldo, porque los packs privados no están en el entorno de pruebas. Las tres mejoras no dependen de los packs: el humo, el vapor y el tile de vía se dibujan en código, y la fachada del restaurante se mide en las dos versiones.
- Con packs, el único humo de chimenea del pueblo es el de la cabaña del bosque. La casa del santuario que también echa humo solo aparece sin el pack de edificios japoneses.
