# Cocina física (estilo Overcooked / PlateUp!)

Rediseño de la cocina de Midnight Maki: se cocina caminando por el mapa, llevando objetos en las manos, en vez de abrir un minijuego modal.
Este documento fija el diseño; el código vive en `src/galley/` (modelo puro y probado) y `src/scenes/galleyView.ts` (dibujo y controles).

## 1. Qué había y por qué no servía

- La «cocina» era un pasillo de **5×2 casillas** (`x1..5, y3..4`) entre una hilera de equipos contra la pared (`y2`) y un mostrador (`y5`). Un mapache solo cabía; dos se bloqueaban.
- Todo el cocinado era un minijuego modal (tablero, pestañas, «por actos»). El mapa era un decorado.
- La bandeja de salida y los pedidos están del lado del salón, bajo el mostrador (`(6..8, 5)`).
- El salón (`x3..16, y6..12`) lo ocupan las mesas que coloca el jugador: **no se toca**.

## 2. Distribución nueva

La cocina ocupa `x1..12, y2..5` (12×4). Dos filas de estaciones (pared del fondo `y2` y frente `y5`) con un **pasillo de 2 casillas** (`y3..4`). El mostrador de entrega queda al centro y el pasillo lo rodea por arriba (`y2..3`), así no hay cuellos de botella.

```
      x: 0 1 2 3 4 5 6 7 8 9 10 11 12 13
 y=1     # # # # # # # # # # #  #  #  #      pared (cartel, faroles, estantes)
 y=2     # F C R H B . . . S b  D  K  P      estaciones de pared
 y=3     # . . . . . . . . . .  .  .  p      pasillo (usar desde acá)
 y=4     # . . . . . M M M . .  .  .  .      pasillo / mostrador de entrega (M)
 y=5     # c A A T . b b b . .  .  .  .      estaciones frontales y entrada al salón
 y=6       (salón)
```

| Marca | Estación | Zona | Detalle |
|---|---|---|---|
| F `(1,2)` | **Heladera** | Almacenamiento | Se abre y se elige el ingrediente. Segunda acción: Despensa (el panel de siempre). |
| C `(2,2)` | Mesada de apoyo | Apoyo | 2 lugares. |
| R `(3,2)` | **Arrocera** | Cocción | Tanda de 4 porciones (mejorable a 6). Vapor y barra de progreso. |
| H `(4,2)` | **Hangiri** | Cocción | Reserva de arroz cocido (6 porciones). |
| B `(5,2)` | **Tabla de cortar 1** | Preparación | Minijuego de reflejos. |
| S `(9,2)` | **Fogón** | Cocción | Para huevo, langostino, anguila (recetas con paso «cocinar»). |
| b `(10,2)` | **Tabla de cortar 2** | Preparación | Mejora `board2`; antes es una mesada de apoyo. |
| D `(11,2)` | Bebidas | Apoyo | La estación de bebidas de siempre. |
| K `(12,2)` | Fregadero | Decorado funcional | Reservado (limpieza / mejoras). |
| c `(1,5)` | Mesada de apoyo | Apoyo | 2 lugares. |
| A `(2..3,5)` | **Mesa de armado** | Armado | 2 casillas, 6 lugares. |
| T `(4,5)` | Tacho | Apoyo | Tira lo que sale mal. |
| M `(6..8,4)` | **Mostrador de entrega** | Emplatado y entrega | 3 lugares; los platos listos pasan a la bandeja de salida. |
| P `(13,2)` | Puerta del depósito | — | Sin cambios. |

- **Recorrido típico de un maki:** heladera (1,2) → arrocera (3,2) → *mientras cocina*: heladera → tabla (5,2) → armado (2..3,5) → mostrador (6..8,4). Cada tramo es de 2 a 4 casillas.
- **Espacio para crecer:** `y5, x9..12` queda libre para una segunda mesa de armado o estaciones automáticas; las casillas `b (10,2)` ya existen como mesada y se convierten en tabla 2 con la mejora. Una segunda arrocera cabe en `D`/`K` si se mudan las bebidas.
- **Accesos:** al salón por `(5,4)-(5,5)` y por todo el frente del este (`x9..12`). A la escalera y al depósito, por el pasillo `y3`.

## 3. Circulación (reglas que cumple el mapa; hay un test)

1. Todas las casillas de pie de cada estación son transitables y alcanzables desde la puerta de calle.
2. El pasillo mide **2 casillas** en todo el recorrido (`x1..5`: `y3..4`; `x6..8`: `y2..3`; `x9..12`: `y3..4`). Nunca hay un tramo de 1 casilla.
3. Ninguna estación tiene un mueble decorativo en su casilla de uso.
4. Los empleados usan las mismas casillas de pie: una estación admite una persona a la vez (reserva), el resto espera en el pasillo.

## 4. Jugabilidad

Manos: 1 objeto (2 con la mejora *Delantal con bolsillos*). El objeto se ve en las manos.

- **Heladera:** elige ingrediente (rueda de íconos con stock). Cada toma descuenta del inventario/despensa de verdad; devolver un ingrediente crudo lo reintegra.
- **Arrocera:** se cargan porciones de arroz crudo, se enciende, cocina ~22 s (la barra avisa), se retira de a una porción. Si se pasa, el arroz baja de calidad y, mucho después, se quema.
- **Tabla de cortar:** al llevar un ingrediente aparece una barra con un indicador que rebota; hay que frenarlo sobre la zona verde (cambia de lugar en cada intento). Resultado: Perfecto / Bueno / Regular / Fallido (un corte fallido deja el plato en «Aceptable»).
- **Fogón:** huevo, langostino y anguila se cocinan solos (~9 s) y se retiran; se pasan si se olvidan.
- **Mesa de armado:** se dejan las piezas; cuando coinciden con una receta aparece el cartel de la receta y se arma con una interacción breve (≈1,4 s). Sale un plato en la mesa.
- **Mostrador de entrega:** al dejar el plato se asigna al pedido que más urge y pasa a la bandeja de salida (lo que ya existe: el mozo o el jugador lo llevan a la mesa).
- **Tacho:** tira lo que se tiene en las manos.

Estados de los ingredientes: `crudo → cortado / cocido → (cortado y cocido)`; el arroz es `crudo → cocido`. Nada se duplica ni desaparece al dejarlo en una superficie.

## 5. Pedidos y dificultad

Hasta 3 pedidos simultáneos en los tickets (arriba a la derecha de la cocina). Cada ticket: receta, cantidad, mesa o cliente, tiempo (paciencia del grupo) y estado (esperando · en curso · listo para entregar).
Mediodía: más grupos chicos y recetas sencillas. Tarde: menos demanda, pedidos especiales. Noche: grupos grandes y recetas complejas. Una sola cocina y un solo modo de juego.

## 6. Empleados (arquitectura)

El modelo (`Galley`) expone las mismas operaciones para el jugador y para cualquiera: `take`, `put`, `use`. Un **empleado de cocina** es un agente con una cola de tareas (`GalleyTask`) que camina por el pasillo hasta la casilla de pie de una estación y llama a esas mismas operaciones. Roles previstos: **cortador**, **asistente**, **arrocero**, **cocinero**. Primer ayudante: el arrocero (carga, enciende y retira la arrocera y mantiene la reserva de arroz).

## 7. Mejoras

`knife` (zona verde más ancha), `bamboo` (armado más rápido), `rice_big` (arrocera 4→6 porciones), `board2` (segunda tabla), `galley_hands` (llevar 2 objetos), `fridge_plus` (la heladera ofrece más ingredientes a la vez y repone la reserva). Cada mejora cambia un mueble o una cantidad; ninguna obliga a rehacer el mapa.

## 8. Compatibilidad

- El tablero clásico y la cocina «por actos» siguen disponibles en Ajustes («Cómo cocinar») y los usa el invitado en el modo cooperativo (su cocina es el restaurante del anfitrión). Se actualizaron sus posiciones al nuevo mapa.
- Sin campos obligatorios nuevos en el guardado: `game.save.galley` es opcional; las partidas viejas cargan con la cocina vacía.

## Estado final (implementado)

- **Mapa**: cocina rediseñada (`src/galley/layout.ts`, `src/data/zones.ts`): zona de almacén (heladera + despensa), cocción (arrocera, hangiri, fogón), preparación (tablas), armado (mesa de 2 casillas), entrega (mostrador de 3 plazas que da al salón) y apoyo (mesadas, tacho, bebidas, fregadero). Pasillos de 2 casillas; cada estación se usa desde su casilla de parada.
- **Controles**: se camina libre; parado en la casilla de una estación aparecen sus acciones (E/F, «Más acciones…», botones táctiles): Abrir/Guardar, Dejar/Tomar, Cargar/Encender, Cortar, Armar, Entregar, Tirar. Solo se ven las acciones de la estación donde estás.
- **Heladera**: animación de puerta, sonido, selector con los ingredientes que hay (los que piden los tickets primero). Cada ingrediente sale del inventario real; guardarlo lo devuelve.
- **Manos**: 1 cosa a la vez (2 con la mejora «Delantal con bolsillos»). Lo que llevás se ve en pantalla y conserva su estado: crudo / cocido / cortado / plato.
- **Arrocera**: tandas de hasta 4 porciones (6 con «Arrocera grande»), vapor, barra de progreso, aviso al quedar lista y se quema si te olvidás. Fogón: igual para ingredientes cocidos.
- **Corte**: barra de reflejos con zona verde que cambia en cada intento; velocidad y tamaño según dificultad/momento del día y cuchillo. Resultados Perfecto / Bien / Regular / Fallo, con cuchillo, sacudida, partículas y destello.
- **Armado**: la mesa combina las piezas preparadas según la receta (cantidades reales de `RECIPES`), con una pausa corta animada (menos con la esterilla de bambú); el plato resulta con calidad 0–2.
- **Pedidos**: tarjetas con mesa/cliente, platos pendientes, ingredientes necesarios y paciencia (hasta 3 visibles). Entregar en el mostrador asigna el plato al pedido más urgente y sigue el flujo existente (bandeja → mesero/jugador → mesa, propinas, maestría, energía).
- **Compatibilidad**: guardado opcional (`save.galley`); ajuste «Cómo cocinar» (cocina física / por actos / tablero); el invitado del modo cooperativo sigue con la cocina anterior.
- **Mejoras nuevas**: `board2` (segunda tabla), `rice_big`, `galley_hands`, `rice_hand`; se suman a `knife` y `bamboo`.
- **Empleados** (`src/galley/crew.ts`): cada rol es un cerebro que devuelve el siguiente paso (estación + verbo) y la vista lo ejecuta con las mismas reglas que el jugador. Implementado: **ayudante arrocero** (mejora `rice_hand`): busca arroz, lo cocina y mantiene 4 porciones listas en el hangiri. Para sumar cortador/asistente/cocinero: una entrada nueva en `HANDS`.
- **Pendiente / límites**: los demás roles; la dificultad por hora del día usa la existente (velocidad del corte y demanda del salón) sin sistema nuevo de grupos; no se probó en un celular real.

## Bebidas y controles (añadido)

- **Bebidas físicas**: estante de *Vasos* (gratis, nunca se agota) y *Licuadora*. Llevás los ingredientes de la heladera (té, leche, frutilla, ramune) y un vaso a la licuadora; con la mezcla exacta de una bebida aparece «Licuar» (3,5 s, barra de progreso). La bebida se retira a mano de la licuadora y se deja a mano en el mostrador de entrega: no se entrega sola.
- **Mesa del cliente**: con la cocina física ya no ofrece «Cocinar»; el ticket en pantalla dice qué falta. El menú de pedidos no tiene botones de cocinar (solo informa).
- **Teclas**: **E** hace cosas (la mejor acción disponible que no sea hablar), **F** habla con personajes y vecinos, **Espacio** abre «Más acciones…» cuando F está hablando. Sin nadie cerca todo sigue como antes.

## Controles, máquinas automáticas y timbre (añadido)

- **Controles**: E = mejor acción que no sea hablar; F = hablar; Espacio = lista numerada con todo (1, 2, 3… eligen). Compañía/Regalar/Acariciar nunca son la acción principal. Una acción nueva se agrega siempre al final de la lista.
- **Máquinas automáticas**: arrocera, fogón y licuadora arrancan solas al cargar el primer ingrediente (la arrocera/fogón aceptan más porciones unos segundos, `COOK.*.grace`). Una sola barra por tanda: verde mientras cocina y en su punto, amarilla al pasarse (humo blanco), roja al estar por quemarse (humo negro y la máquina vibra); la marca indica cuándo está lista.
- **Timbre de servicio** (mejora `service_bell`): en la cocina física el personal solo retira platos del mostrador cuando se toca el timbre (hace falta la mejora, un plato esperando y un empleado libre).

## Ajustes de uso (añadido)

- **Teclas**: E y F = las dos mejores acciones; **Espacio** = hablar; **Q** = lista numerada con todo (1, 2, 3… eligen). Compañía/Regalar/Acariciar solo están en la lista.
- **Para quién es cada plato**: el plato (en la mesa de armado, en la licuadora, en las manos o en el mostrador) muestra «Para Mesa N»; el cartel de arriba dice «Llevás: plato → Mesa N · cliente». Con un plato en las manos solo hay acciones del plato (dejar, entregar, tirar).
- **Corte**: 5 cortes seguidos al principio (4 con el Cuchillo de Spicy, 3 con el Cuchillo afilado `knife2`); el resultado es el promedio.
- **Armado**: sobre la mesa un cartel dice «Listo: receta. ¡Armalo!» o «receta: falta X», y «Armar» pasa a ser la primera acción cuando se puede.
- **Primera lección** (`src/galley/tutorial.ts`): tarjeta paso a paso con dos platos (Kappa maki y Nigiri de salmón), con sus pedidos de práctica; se puede omitir. Sumar platos = agregar pasos a `TUTORIAL`.

## Salón, espera y pausa (añadido)

- **Editar el salón**: «Editar salón» (en la lista Q, parado en el salón) abre el editor de decoración para mover mesas, sillas y adornos. Solo con el salón vacío de clientes.
- **Clientes sin mesa**: la fila de espera tiene paciencia (barra sobre el cliente); al agotarse se van.
- **Pausa**: con menús, celu o tablero de pausa abierto se congelan movimiento, tweens, partículas, lluvia y agua. Diálogos, escenas y transiciones siguen corriendo.
- **Arroz/fogón**: la barra tiene menos margen tras estar listo (arroz: 4 s en su punto, 8 s amarillo, quema a los 12 s).

## Spicy en la cocina, mejoras visibles y cartel (añadido)

- **Quién hace qué**: Spicy es el cocinero: con `rice_hand` camina por la cocina y mantiene arroz cocido listo; con `cut_hand` (necesita `rice_hand`) también corta lo que piden los tickets y lo deja en las mesadas de apoyo (5 s por pieza). Rigg lleva los platos con el timbre (`service_bell`) y Pip recibe a los clientes. Spicy usa el movimiento del pueblo (`town.duty`), no un cuerpo aparte; trabaja durante el servicio y solo si está en el equipo. En la cocina física el «cocinar» abstracto del personal queda apagado.
- **Mejoras caras y visibles**: `rice_big` cambia el prop de la arrocera por una más grande y dorada (`k_ricepot2`, ver `alt` en `galley/layout.ts`), `board2` agrega la segunda tabla. Precios 900–3200.
- **Cartel interior**: el cartel de la pared del salón muestra el nombre que eligió el jugador (dos líneas).
- **Plaza**: gatos y perros recorren la plaza con más frecuencia (esperas de 4–13 s).
- **Música**: al aire libre de noche no suena música (grillos/olas como ambiente); la música vuelve de día y en interiores.

## Retoques (añadido)

- **Flecha de la lección**: durante la primera lección una flecha señala la estación a la que ir en cada paso (`tutorialStation`); el objetivo de misión de «preparar el primer sushi» ya no apunta al mostrador viejo sino a la cocina.
- **Playa**: `src/audio/beach-waves.mp3` (olas, viento, gaviotas) reemplaza el oleaje sintético; de noche suena más bajo.
- **Perros**: se quitaron los dos perros de la plaza (el arte no era del estilo del juego).
- **Menú principal**: aparece directo, sin «tocar para entrar»; el primer toque o tecla inicia la música.
- **iPhone (app en el inicio)**: la página queda fija (sin desplazamiento) y el lienzo cubre también la zona del indicador de inicio.
- **Luces**: los halos aditivos son más suaves y se atenúan entre sí para que la noche no parezca de día.
