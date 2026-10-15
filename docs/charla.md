# Charla con personajes y vecinos

Al hablar con un personaje o vecino, después de su línea del día aparece el menú:
- **Charlar…** → *Charlar de lo que sea*, *¿Cómo andás?*, *¿Qué estás haciendo?*, *Contame del pueblo*, *¿Alguna novedad?*, *Hablemos del restaurante*.
- **Regalar…** (personajes) → *Un objeto de la mochila* o *Un mueble guardado* (si hay muebles guardados; si le gusta, `likes` del mueble, cuenta como regalo preferido). Un regalo por día, igual que antes. El botón contextual "Regalar" abre el mismo menú.
- **Más acciones…** → *Sacarnos una foto*, *Contarle un chiste*, y en los mapaches *Sentarnos juntos*, *Compartir una merienda*, *Jugar*, *Acariciar* y *Cambiar su atuendo*. Los vecinos tienen *Invitar a Midnight Maki* en el menú principal.
- En el cuadro de diálogo, **Historial** lleva un cuadernito.

## Cómo se eligen las líneas (`src/dialogue/topics.ts`)
Es una función pura: según el momento del día, la lluvia, la fiesta, qué está haciendo y mirando quien habla (act y lugar), el estado del restaurante (abierto, clientes, nivel, reputación), qué hacen otros vecinos en ese momento y si hay un plato favorito de un habitual, arma la respuesta. Preguntar de nuevo recorre otras líneas; la primera respuesta es la que mejor encaja con la situación. `{name}` es el nombre del jugador.
Hay sabor propio para los personajes (`FLAVOUR`, `WORK`) y los vecinos usan sus frases (`lines`) y su oficio.

## Para agregar texto
- Frases nuevas de un tema: las listas de `topics.ts`.
- Más chistes: `JOKES` (y `REACT` para reacciones por personaje).
- Línea contextual "de siempre" (por hora/zona/amistad/recuerdo): `dialogue/lines.ts`.
