# Ecos de la historia, pedidos especiales y momentos del pueblo

## Ecos (`src/story/echoes.ts`)
Cuatro elecciones de la historia vuelven días después, como una escena corta con el mismo personaje y un regalo que depende de lo que elegiste. Se juegan al hablarle (después de la escena de historia y antes de las charlas de vínculo), una sola vez (`echo_<id>`).

| Elección | Cuándo vuelve | Personaje | Qué cambia |
|---|---|---|---|
| Quedarte decidida / aprender (prólogo) | 2 días | Spicy | picante, o clase con arroz y nori |
| Pip: "hogar" / "recordar" | 3 días | Pip | siesta que recupera energía, o la caja de Akio con ingredientes |
| Bento: gratitud / pregunta | 2 días | Bento | dulces de la receta de Akio, o amistad y monedas |
| Rigg: apoyo / equipo | 3 días | Rigg | té de jazmín, o un libro y monedas |

Además, el final (promesa del faro) repite hasta tres líneas según estas elecciones y la del faro. Las decisiones se guardan con `recordDecision(clave, valor)`, que anota también el día (`<clave>_day`); los guardados viejos sin día cuentan como "ya pasó el tiempo".

## Pedidos especiales y platos flojos (`restaurant/orders.ts`)
- Desde el nivel 3, cerca de uno de cada siete pedidos de mesa trae un pedido especial (`Order.want`): **perfecto** (paga +40 % del precio si sale perfecto) o **rápido** (paga +40 % si se entrega con la mesa todavía paciente, al menos el 60 %). Se avisa al tomar el pedido y se ve en la cocina ("pide perfecto").
- El precio acordado siempre se paga. Un plato flojo ya no deja propina, suma 1 punto de reputación en vez de 2 y los buenos tienen más probabilidad de propina (30 % / 65 %).

## Momentos del pueblo (`systems/townMoments.ts`)
Siete vecinos reaccionan una vez a lo que hiciste con el restaurante (faroles, más mesas, personal, nivel 3 y 5, vitrina, reputación). Lo dicen en una burbuja cuando pasás cerca. Un vecino que ya comió en tu restaurante y tiene un plato favorito, al volver dice que volvió por ese plato.

## Menú de pausa en celular
El menú de pausa (el cartel de madera con Aventuras y Progreso, Guardar, Cargar, Ajustes, Cuenta y Guardar y salir) solo se abría con la tecla Esc. Ahora hay un cuarto botón redondo de pausa (ya subido por otra sesión) junto a Mochila, Misiones y Mapa, que abre el mismo menú; la ✕ lo cierra. En pantalla táctil hay un botón "Continuar partida" y no se muestran las teclas (I, M, J, Tab). La app "Más" del NoriPhone abre el mismo menú.
