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
