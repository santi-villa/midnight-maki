# Etapa 3 — Vida del pueblo

- Horarios personales para los vecinos y personajes: trabajadores tempraneros, nocturnos y excepciones como Hoshi. Regreso unos 30 minutos antes de dormir; con lluvia se adelanta 45 minutos. El reloj existente sigue siendo la única fuente de hora.
- Se reutilizan `Journey`, `TownLife` y `NeighborLife`: caminan por las puertas existentes, se acuestan al llegar y retoman el plan después de despertar. Narrativa, festivales, servicio forzado y Mercado Nocturno mantienen prioridad. Las ventanas y su luz sobre el suelo se apagan cuando todos los habitantes de esa vivienda llegaron y están durmiendo; una visita al restaurante mantiene la casa iluminada hasta su regreso.
- Se corrige también el retorno del cliente vecino al paseo: devuelve su posición real a la simulación, en vez de regenerarlo en su destino.
- Decisión: los ocho personajes sin domicilio nocturno usan viviendas existentes compartidas. Se agrega un futón en un espacio libre y conectado a la puerta, conservando camas, muebles y accesos previos. El UID queda en una bandera opcional para evitar duplicados; no se cobra nada ni se cambia el esquema de guardado. No se agregan edificios ni regiones.
- Recorridos cortos de gatos y perro dorado en `src/scenes/pets.ts`, con pausas largas, obstáculos del mapa y espera ante personas. Regresan a descansar de noche. Se conserva al perro dormilón; el gato procedural aleatorio se reemplaza por los gatos del atlas con recorridos definidos. Cambiar de período en la misma zona conserva las posiciones de las mascotas.
- **Miso**, gato siamés de Midnight Maki: descansa junto al tatami, pasea por el salón y se acerca a clientes cuando hay lugar. Acción contextual «Acariciar a Miso», con un corazón breve. Sin monedas, reputación, necesidades ni amistad obligatoria. Estado y movimiento locales, sin agregarlos a mensajes online.

## Verificación

- `npx tsc --noEmit`: aprobado.
- 45 pruebas puntuales aprobadas entre `residentSleep`, `neighbors`, `townLife`, `houseInterior` y `hours`. Incluyen horarios, lluvia, madrugada, ocho futones accesibles, idempotencia, prioridad narrativa/comercial y regreso sin teletransporte.
- Playwright: los dos casos de `e2e/resident-life.spec.ts` aprobados, más el caso de ajustes/ventanas de `e2e/light.spec.ts`, actualizado para esperar llegadas reales y conservar sus comprobaciones de luz.
- Capturas inspeccionadas en Chromium headless a 1280×800, `/?debug`, `perf: 'high'`: vecina de camino a casa, ventana apagada, sueño en la cama, mascotas paseando/descansando de noche y caricias a Miso. Se aceleran recorridos llamando a la simulación existente en las pruebas; no se afirma una espera de horas reales.
- Sin errores de página en los casos nuevos. Sin suite completa y sin prueba en teléfono físico.

## Archivos principales

`src/data/residentHomes.ts`, `src/systems/residentSleep.ts`, `neighborPlan.ts`, `neighborSpots.ts`, `neighbors.ts`, `npcs.ts`, `src/world/zoneRuntime.ts`, `contextActions.ts`, `src/scenes/pets.ts` y `WorldScene.ts`. Pruebas/capturas en los archivos citados y `docs/art/vida/etapa-3/`.

Pendiente de esta serie: etapa 4 (persianas, narrador y clientes); además de los arreglos de etapa 0 que se habían pospuesto. Los personajes sin domicilio propio usan las viviendas compartidas descritas arriba; no se diseñaron casas nuevas.
