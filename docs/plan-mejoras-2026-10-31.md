# Plan de mejoras (31/10/2026)

Pedido: los cambios 1–5 del análisis de assets y la lista de ajustes del mapa. Se ejecuta en este orden, con un
commit por bloque. Todo lo nuevo de packs mantiene su `?...=classic` para comparar.

## A. Arreglos rápidos que el usuario ve enseguida

1. **Puerto/mercado oscuros de día.** Causa: `WorldScene` trata a `market` como zona siempre oscura
   (`dark: ... || this.zoneId === 'market'`, y otros dos `!== 'market'`), resto del mercado nocturno que era una zona
   aparte. Ahora el mercado es la costanera: sigue la hora del día como el resto. Se mantienen la música y los puestos
   nocturnos.
2. **Aves.** Sacar todas las aves quietas de decoración (`pigeon`, `pigeon_peck`, `seagull`, `gull_left`,
   `gull_right`: props, piezas del atlas y ubicaciones). Reemplazar los tres pájaros al azar por **bandadas** en lugares
   con sentido, que se van todas juntas cuando te acercás: palomas en la plaza alrededor de la fuente, gaviotas en la
   arena de la playa y en el muelle del puerto, pajaritos en los claros del jardín y del bosque. Ninguna en estación,
   barrio, santuario ni mercado de noche.
3. **Mesas del restaurante.** El salón mide 18×14 y las mesas de cada etapa se meten entre las que ya hay. Ensanchar el
   salón hacia la derecha (sin mover cocina, puertas, escalera ni depósito) y ubicar las mesas en una grilla con
   pasillos de una baldosa: las iniciales, las de cada etapa y las que compra el jugador (lugares sugeridos libres).

## B. Interiores (punto 1 del análisis)

Modern Interiors completo (LimeZu): pisos y paredes del Room Builder y los temas Japanese interiors, Kitchen,
Grocery store, Clothing store, Classroom and library y Fishing.
- Pisos y paredes de todos los interiores con el Room Builder (madera, tatami, baldosa), en lugar de los pisos dibujados
  en código (lila con puntos, ajedrez).
- Casa del jugador y las 16 casas: tatami, shoji, kotatsu, futones, zabuton, biombos, bonsái. Las casas del barrio dejan
  de estar vacías (amueblado fijo, no del jugador).
- Comercios: panadería (vitrinas y estantes de cocina), Ropa de Yuki (percheros y estantes de la tienda de ropa),
  Almacén de Taro (góndolas y cajones del almacén). Mostradores reales en lugar de las cajas.
- Biblioteca (estanterías, mesas de lectura), faro (pesca/marino), depósito (cajas y estantes, con luz).
- El restaurante unifica estilo (hoy mezcla Bitglow, LimeZu y código).

## C. Exteriores (puntos 2–5 del análisis)

- **Casas del barrio (16)**: fachadas del pack completo de VectoRaith (casas con entrada lateral y casas de dos pisos,
  tres colores de techo), con la misma lógica de puerta/ventanas que los comercios.
- **Santuario**: torii, santuario de madera, pagoda y faroles de piedra de VectoRaith.
- **Caminos y agua**: tierra/piedra con bordes de VectoRaith (autotile según vecinos); agua de río y estanques que
  combine con el mar.
- **Árboles**: pinos japoneses y cerezos de VectoRaith en lugar de los dibujados en código.
- **Carteles y tablero**: los del pack.

## D. Ubicación con sentido (lista del usuario)

- **Faroles**: en esquinas, cruces y a los lados de puertas y puentes, no en medio del pasto ni tapando caminos.
- **Caminos**: revisar conexiones raras (tramos que terminan en nada, dobles, escalones de un tile) y dejarlos
  continuos.
- **Decoración**: cada cosa donde tiene sentido (macetas junto a puertas, cajones junto a puestos, bancos mirando a algo).
- **Bosque más grande y frondoso, pero transitable**: el bosque está encerrado en el mapa del pueblo (120×80); para
  agrandarlo sin correr todas las coordenadas, sumar un **Bosque profundo** como zona aparte conectada por el borde oeste
  del bosque actual, con senderos sinuosos entre árboles densos, un claro y puntos de recolección. El bosque actual se
  densifica en los bordes manteniendo caminos libres.
- **Mercado nocturno**: puestos más juntos formando una calle de mercado, y más puestos (comida, faroles, artesanías),
  con guirnaldas.

## Verificación

Typecheck, los tests existentes y capturas por zona (día y noche donde aplique). Sin tests nuevos salvo cuando un
comportamiento nuevo lo requiera.

## Estado al cierre (31/10/2026)

Hecho, con un commit por bloque:
- **A.** Mercado con la luz del día; aves quietas fuera y bandadas que se van juntas (`data/flocks.ts`); salón de 24 de
  ancho con mesas en grilla y pasillos, migrando las mesas de partidas viejas que siguen donde las puso el juego.
- **B.** Pisos de Room Builder para los diez estilos de piso (todos los interiores); casas del barrio con futones,
  andon, bonsái y faroles de papel.
- **C.** Santuario, torii, faroles de piedra, komainu, pinos japoneses y cerezos de VectoRaith; ríos y estanques con el
  agua animada del mar.
- **D.** Mercado nocturno en una calle con seis puestos; 31 faroles de calle en cruces, puentes y esquinas (en el pasto,
  nunca sobre la calle); faroles del puerto en las bocas de los muelles; caminos sin finales en el río, sin anillo
  duplicado ni calles que suben al pasto; Bosque profundo al oeste del bosque.

No hecho, y por qué:
- **Fachadas de las 16 casas del barrio**: cada casa tiene la puerta en un costado y su interior abre por ese lado; las
  fachadas del pack la tienen en otro lugar, y cambiarlas desalinearía entrada e interior. Las casas actuales ya están
  armadas con piezas de este mismo pack.
- **Muebles de las tiendas**: los mostradores y vitrinas de Modern Interiors son de supermercado moderno o muebles de
  frente que taparían al tendero detrás del mostrador. Las tiendas tienen los pisos nuevos; agrandarlas y amueblarlas
  queda pendiente.
- **Caminos con bordes (autotile)** y **carteles/tablero del pack**: el usuario dijo que los caminos están bien salvo las
  conexiones (arregladas), y los carteles del pack no llevan texto propio.

