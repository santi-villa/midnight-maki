# Pueblo vivo: vecinos ambientales (etapa 7)

Doce vecinos sin misiones que llenan Villa Nori de vida (`src/data/neighbors.ts`): Ren, Mika, Haru, Tomo, Nene, Goro, Fuyu, Sato, Mame, Kai, Rin y Oto. Cada uno tiene nombre, oficio, aspecto, rasgos de personalidad, lugares favoritos, amigos, casa propia (una de las casas con interior) y frases para cuando pasa alguien.

## Cómo deciden
- `src/systems/neighborPlan.ts` reparte el día en 8 momentos (cuatro períodos, dos mitades) y decide para cada uno: **casa, trabajo, rato libre, paseo o charla**. Son reglas con dados fijos por día: el mismo día siempre sale igual, sin azar entre ejecuciones.
- **Personalidad:** el tímido charla y pasea menos; el sociable charla mucho y se junta en la plaza (hasta 3); el aventurero va a lugares lejanos (playa, bosque, jardín); el trabajador respeta su comercio; el nocturno duerme de mañana y sale de noche; el deportivo pasea más.
- **Clima:** con lluvia salen mucho menos (los aventureros algo más) y más se quedan en casa; los que leen siguen yendo a la biblioteca.
- **Noche:** casi todos duermen en su casa; salen los nocturnos (mercado, bancos, paseo).
- **Amigos:** a veces dos amigos que están afuera pasan el momento juntos, uno al lado del otro y charlando.
- **Lugares** (`neighborSpots.ts`): bancos (sentados, también en la biblioteca para leer), la fuente, la orilla del mar, jardín, bosque y mercado (solo si ya están abiertos), calles y paseos, el interior de su comercio y su casa. Nadie comparte casillero.

## Cómo se mueven
- `src/systems/neighbors.ts` usa los mismos recorridos entre mapas que el resto del pueblo (`Journey`): caminan por puertas y calles, siguen su rutina aunque Sofi esté en otro mapa y solo se dibujan cuando están en el mapa actual (la simulación fuera de pantalla es solo posición y tiempo, sin animación).
- **Bicicleta:** Mika, Sato y Rin pedalean al doble de velocidad cuando pasean; se ve la bici debajo y queda estacionada a su lado cuando se detienen.
- **Sin teletransportes:** al cambiar el momento del día caminan hasta su nuevo lugar. Solo al cargar una partida aparecen directamente donde les toca.

## Pruebas
`src/tests/neighbors.test.ts`: doce personas distintas con casa propia y amigos reales; plan idéntico para el mismo día, sin casilleros compartidos y siempre alcanzables; lluvia, noctámbulos, charla y amigos juntos.

## Personajes de la historia con más vida
- **Gestos** (`systems/npcMicro.ts`): cuando un personaje espera en su lugar hace de vez en cuando algo propio unos segundos: cocinar, leer, tomar té, pintar, mirar el cielo, regar, saludar. Cada uno tiene los suyos y la lluvia y la noche suman otros ("¡Cómo llueve!", "Qué noche linda."). Nunca despiertan a quien duerme.
- **Pasitos:** al aire libre, quien se queda "quieto" (sin recorrido propio) da unos pasos alrededor de su lugar.
- **Frases al pasar:** si te acercás, dicen algo sobre lo que están haciendo o viendo (`dialogue/topics.ts`), una vez cada ~30–50 s.
Ver `docs/charla.md`.
