# Clientes del pueblo (etapa 8)

Los doce vecinos de Villa Nori (`data/neighbors.ts`) ahora también son clientes posibles de Midnight Maki. Las reglas están en
`src/restaurant/townClients.ts` (puras, con dados sembrados, testeadas) y el enlace con el juego en `townVisits.ts` y `townTalk.ts`.

## Cómo llegan
Cada vez que se abre la puerta (`WorldScene.pumpFloor`) se pregunta `nextTownGuest()` en este orden:
1. **Visita planificada** que ya toca (día y momento del día cumplidos) y cuyo vecino no está adentro.
2. **Habitual** (≥2 visitas y ánimo ≥1) que no vino hoy: ~1 de cada 4 llegadas, más probable cuanto más contento.
3. **Se le antoja** (18 % de las llegadas): sociables y noctámbulos (de noche) pesan más; los muy enojados (ánimo ≤ -3) no vuelven.
Si nadie, se usa el flujo de clientes genéricos de siempre (`chooseParty`). Un vecino adentro deja de pasear (`NeighborLife.hold`) y
vuelve a su lugar planificado cuando se va. El cliente se llama `nb_<id>`, usa el cuerpo del vecino y su nombre.

## Invitaciones
Hablar con un vecino que pasea (acción "Hablar" cerca de él) abre una charla corta con la opción **Invitar a Midnight Maki**.
La respuesta (`inviteResponse`) depende de personalidad (sociable ↑, tímido ↓, trabajador ocupado de mañana ↓), ánimo guardado
(una mala espera pasada lo hace dudar), una invitación por día y si ya tiene una visita planificada. Puede decir sí (ahora), "más tarde"
(noctámbulos: de noche; trabajadores: al atardecer) o no. Un sí queda en `save.clients.planned`.

## Memoria de habituales
`save.clients` (opcional, guardados viejos cargan sin él): por vecino `visits`, `likes` (platos que le gustaron, ×2 si salieron perfectos),
`mood` (-3..6), `waits`, `last`, `invited`. Un plato malo o una espera larga bajan el ánimo. Al pedir, un habitual repite su plato favorito
conocido el 65 % de las veces; al llegar dice una frase según lo que recuerda ("todavía me acuerdo del …", "espero no esperar tanto").
Cada visita que termina contenta suma +1 reputación (aparte de la de cada plato).

## Demanda dinámica
`demandFactor()` (0.4–2.2) divide el intervalo entre llegadas (26–34 s base): más gente al atardecer/noche, fines de semana, con fama
(reputación), encanto del salón, festivales y habituales; menos con lluvia y por la mañana.

## Pendiente / límites
- Los vecinos piden una sola cosa (un plato); no hay grupos de vecinos todavía.
- La libreta está en el NoriPhone, app **Clientes** (`ui/clients.ts`): vienen pronto, estado, corazones, plato favorito, visitas y esperas.
- Sin probar en teléfono real.
