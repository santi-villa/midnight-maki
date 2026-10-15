# Personal y cuadrilla (etapa 3)

**App Personal del NoriPhone** (`src/ui/staff.ts`, reglas en `src/restaurant/staff.ts`).

## Los mapaches (sin sueldo)
- **Pip** recibe a los clientes y los lleva a su mesa. Empieza más lento (×2,2 en cada espera) y mejora con la práctica y la capacitación.
- **Rigg** (amistad nivel 2 + "Pedirle que ayude"): lleva los platos de la bandeja a las mesas **de a uno** al principio, toma pedidos (9 s por mesa al empezar) y recoge propinas. Su **bandeja** se mejora con monedas: 1 → 2 → 3 platos por viaje (160 ● y 360 ●); con varios platos recorre las mesas una tras otra sin volver a la bandeja.
- **Spicy** (amistad nivel 2 + "Pedirle que ayude"): cocina los pedidos de comida del salón con la despensa. Un plato cada **34 s** al empezar, hasta 12 s en el nivel máximo. Calidad según su nivel. No cocina bebidas.
- Mejoran con **tiempo** (cada trabajo suma práctica, hasta el nivel 4 muy de a poco) y con **monedas** (capacitar sube un nivel en el acto: 120, 210, 300, 390 ●).
- Solo trabajan con el restaurante abierto, si están en él y si no están en una escena de la historia.

## Personal contratado
- **Mesero** (nivel 3 del restaurante, uno más en 5 y 7): toma pedidos y sirve platos, con orden de prioridad configurable. 150 ● de contratación, sueldo 16–40 ● por día.
- **Cocinero** (nivel 4): un plato cada 45 s al empezar (15 s con experiencia). 220 ● y 22–54 ● por día.
- Sin monedas para el sueldo, no trabajan hasta que se les pague. Solo practican solos hasta nivel 2; el resto es con capacitación.

## Para ti
- **Bandeja de servicio** (nivel 2): llevás 2 platos. **Bandeja grande** (nivel 4): 3. **Carrito de servicio** (nivel 6): 4.

## Reglas comunes
- Nadie le quita un trabajo a otro: cada tarea (mesa, plato, pedido) se reserva y se suelta si cambia la situación. Al cargar una partida no queda nada reservado.
- Lo que cocinás vos tiene prioridad: el equipo no toma un pedido que ya tenés abierto en la cocina.
- Todo lo guardado es opcional (`save.staff`): las partidas viejas cargan sin cambios.
