# Entrega visual: restaurante, cocina física, mejoras, mapaches y portada

Objetivo: más claridad y satisfacción visual sin tocar historia, economía, iluminación ni mecánicas. Todo reutiliza lo que ya
existía (`galley/art.ts`, `scenes/galleyView.ts`, `restaurant/kitchen.ts`, `systems/npcMicro.ts`, `ui/title.ts`).

## Qué cambió

### 1. Ingredientes y platos (`src/galley/art.ts`, `src/scenes/galleyView.ts`)
- Todo ítem lleva un **contorno de 1 px** (oscuro sobre mesadas; **crema** cuando lo lleva Sofi), para no perder la silueta sobre
  madera oscura ni de noche. El canvas pasó de 18×16 a 20×18 (el contorno); el origen sigue abajo al centro.
- **Pistas de forma, no solo de color**: crudo = pieza entera; cortado = tres rodajas separadas + marca de cuchillo arriba a la
  derecha; cocido = tostado + volutas de vapor arriba a la izquierda; arroz cocido = cuenco; plato armado = sobre plato;
  bebida = vaso con pajita y color; vaso vacío = vaso transparente. El destello dorado de «perfecto» se movió para no chocar con
  la marca de cuchillo.
- **Animaciones breves** (se desactivan con efectos bajos / movimiento reducido, que ya cubre `lowFx()`):
  - recoger: la pieza sube desde su lugar en la mesada hasta las manos (≈160 ms);
  - dejar: la pieza se desliza de las manos a su lugar (150 ms) en vez de aparecer;
  - cortar, terminar y entregar ya existían (cuchillo, chispas, plato que se desliza al mostrador) y no se tocaron.

### 2. Estaciones y acciones (`galleyView.ts › drawFocus`)
- La estación donde estás parada muestra **cuatro esquinas** y una **flecha ▼** que sube y baja 1 px cuando se puede hacer algo.
- Cuando **no** se puede hacer nada (p. ej. llevar un plato a la reserva de arroz) las esquinas quedan cortadas, en tono
  apagado, y la flecha se reemplaza por una **✕** sobre un fondo oscuro. Se distingue por forma, no solo por color.
- Con algo en las manos, las estaciones que lo aceptarían muestran un **chevrón ▾** suave (según `Galley.verbs`, las mismas
  reglas del modelo, sin duplicar lógica).
- No se dibuja con la barra de corte, la heladera abierta ni mientras Sofi está ocupada.

### 3. Mejoras del restaurante (`src/restaurant/upgradePreview.ts`, `upgradeCelebration.ts`, `upgradeUi.css`)
- Cada tarjeta muestra una **miniatura** hecha con el mismo arte del mapa (`propCanvas`, nuevo en `scenes/textures.ts`, es la
  cadena de `propTexture` factorizada). La arrocera grande y la segunda tabla muestran **Antes → Después**. Las mejoras sin
  objeto físico (bandejas, delantal, timbre, etc.) conservan un ícono.
- Al comprar aparece una tarjeta **«¡Instalado!»** con la miniatura, qué muebles se colocaron en el salón y, si no hubo lugar,
  un aviso: *«No había lugar libre para …: quedó en el depósito»* (dura más). Se cierra tocándola; sin confeti con movimiento
  reducido.
- `buyUpgrade` guarda un `PurchaseReport` en memoria (`lastPurchase()`), no en el guardado. Precios, requisitos y beneficios no
  cambiaron.

### 4. Mapaches (`WorldScene.watchCrew`)
- Pip saluda con la mano (`wave`) y un ♪ cuando llega un grupo; Rigg levanta la vista (`look`) y anota ✎ cuando entra un pedido;
  Spicy se alegra (`happy`) con un ♪ cuando un plato sale bien. Reutiliza el estado de «gesto breve» de los vecinos: no
  camina, no cambia rutas ni colisiones, no abre diálogos, tiene 9 s de enfriamiento por personaje y se salta si ya hay un
  globo, si el personaje camina, duerme o está en una escena.

### 5. Portada (`src/ui/title.ts`, `title.css`)
- **Error corregido**: en horizontal, si el video no podía arrancar, el fondo quedaba vacío (la señal de «reintentar» se volvía a
  disparar en cada ajuste de pantalla). Ahora, tras un fallo, queda la ilustración fija; si el video arranca tarde, se muestra.
- El mensaje «Tocá para empezar» en horizontal pasó al camino, entre los tres mapaches y el restaurante, en vez de tapar al que duerme.
- Se conservó el nombre visible actual («Mapaches y Sushi»). No se cambiaron nombres técnicos, claves de guardado ni el nombre
  del restaurante.

## Archivos modificados
`src/galley/art.ts`, `src/scenes/galleyView.ts`, `src/scenes/WorldScene.ts`, `src/scenes/textures.ts`,
`src/restaurant/{upgrades,kitchen}.ts`, nuevos `src/restaurant/{upgradePreview,upgradeCelebration}.ts` y `upgradeUi.css`,
`src/ui/title.ts`, `src/ui/title.css`.

## Capturas (Playwright, emulación; viewport de 360×640, 412×915 y 915×412; UI al 100 % y 70 %)
Carpeta `docs/img/entrega-visual/`:
- Cocina: `antes-kitchen-*` / `despues-kitchen-*`, y `despues-focus-*` (estación usable, imposible y destino del plato).
- Ítems: `despues-items.png` (crudo, cortado, cocido, plato, bebida; arriba oscuro = en mesada, abajo = llevado).
- Mejoras: `antes-mejoras-*`, `despues-mejoras-*`, `despues-celebracion-std.png`.
- Mapaches: `despues-mapaches-land.png`.
- Portada: `antes-portada-*` / `despues-portada-*`.

## Comprobaciones realizadas
- `npx tsc --noEmit` y `npm run build` al cerrar.
- Comprobación visual con Playwright (`/?debug`, `window.mmDebug`, `mm_settings` con `perf: 'high'`) de las pantallas modificadas.
- No se corrió la suite completa ni los E2E. No se agregaron tests (los cambios son visuales).
- La emulación **no** reemplaza un celular físico: no se probó en ningún dispositivo real.

## Limitaciones pendientes
- El Chromium de pruebas no decodifica H.264, así que el video de la portada horizontal no se vio reproduciéndose (se verificó
  la ilustración de respaldo).
- Las etiquetas de texto dentro de la cocina («Para Mesa 1», «Listo: …») se siguen viendo borrosas a escala pequeña.
- La celebración de compra se solapa con el panel de mejoras en pantallas muy angostas.
- Las pistas de forma de los ítems miden ~9 px en el mapa; en cocina con 6 piezas en la mesa de armado quedan apretadas.
- Las reacciones de los mapaches dependen de poses ya existentes (no hay poses nuevas dibujadas).
