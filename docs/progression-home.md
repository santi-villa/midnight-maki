# Punto 5 — Progresión y hogar

Entrega del nuevo orden de Maki & Mapaches. Se partió de master-mgsshv actualizado a 87b8532, incorporando antes los cambios remotos de mapa, reloj, NoriPhone, rutinas nocturnas y controles. Antes de publicar se integró también f49248e (entradas laterales y casas visitables) y se repitieron las comprobaciones afectadas. Se conservan estos avances.

## Comportamiento

- El nivel 2 sigue siendo automático y gratuito a los 60 XP, como antes. No se frena el prólogo para exigir una reforma.
- Desde nivel 3, **Restaurante → Mejoras → Ascender** permite comprar un nivel cuando alcanza la experiencia, reputación, monedas y materiales. No ocurre un ascenso con cada pedido ni se compran varios niveles con un solo toque.
- Se conserva la experiencia acumulada en el campo opcional **restaurant.totalXp**. El campo antiguo **restaurant.xp** sigue representando progreso dentro del nivel para compatibilidad. Un ascenso cambia ese progreso; nunca resta XP total ni reputación.
- Las cuatro etapas visuales se mantienen en niveles 1/3/5/8, con sus muebles y recetas actuales. Las renovaciones opcionales se compran aparte. No se cambian capítulos, mapa exterior, reloj, horarios, iluminación, estaciones o música.
- Las ocho mejoras existentes mantienen IDs y precios. Las nuevas compras requieren madera y/o piedra; una mejora ya comprada queda adquirida sin cobrar materiales retroactivamente.

| Nuevo nivel | XP total requerido | Reputación | Monedas | Materiales |
| --- | ---: | ---: | ---: | --- |
| 2 | 60 | — | 0 | — |
| 3 | 170 | 18 | 100 | 2 madera |
| 4 | 330 | 35 | 160 | 2 madera, 1 piedra |
| 5 | 540 | 55 | 220 | 3 madera, 2 piedra |
| 6 | 800 | 80 | 280 | 3 madera, 2 piedra |
| 7 | 1110 | 105 | 340 | 4 madera, 2 piedra |
| 8 | 1470 | 135 | 400 | 4 madera, 3 piedra |
| 9 | 1880 | 165 | 460 | 5 madera, 3 piedra |
| 10 | 2340 | 200 | 520 | 5 madera, 4 piedra |

Madera y piedra se obtienen en los puntos de recolección de la plaza; las provisiones restauradas siguen funcionando. Los costes son una primera configuración; el balance de una partida prolongada queda para el punto 8.

## Rincones de los mapaches

Se amplían sus habitaciones existentes, sin crear mapas ni mover sus muebles:

| Personaje | Primera mejora: nivel 2, 20 amistad | Segunda mejora: nivel 4, 100 amistad |
| --- | --- | --- |
| Pip | 140 monedas + 2 madera: zabuton y baúl | 180 + 2 madera: juguete y portarretrato |
| Spicy | 160 + 2 madera: mesita y hierbas | 200 + 2 madera + 1 piedra: té y cuadro de sushi |
| Rigg | 160 + 2 madera: escritorio y zabuton | 200 + 2 madera: portarretrato y constelación |

La segunda mejora requiere la primera. Amistad es un requisito, no un recurso que se descuenta. Se reutilizan ilustraciones, muebles y poses del catálogo actual.

Durante las pausas escalonadas de la tarde ya existentes, si tienen su rincón, caminan hasta él: Pip juega, Spicy merienda y Rigg lee. Luego regresan a recepción, cocina y administración. Se mantienen los destinos alternativos, reservas y rutas existentes, la prioridad de escenas/tutoriales y la limpieza/sueño al cierre.

La interacción con el baúl, mesa o escritorio abre un panel del rincón. Pip y Rigg permiten elegir zabuton rosa/índigo; Spicy, hierbas/bonsái. Solo cambia la pieza nueva identificada por UID, nunca muebles anteriores. Se puede sentar junto al personaje cuando está cerca y disponible. La segunda mejora agrega accesos a actividades existentes: memoria/fotos con Pip, merienda/recetario con Spicy y memoria/álbumes con Rigg. Las actividades conservan sus reglas y límites; no se otorgan monedas por abrir el panel o cambiar el detalle.

Antes de cobrar se comprueba espacio, huellas y caminos. Si un guardado tiene muebles en el área reservada, se rechaza la construcción sin consumir recursos ni desplazar esos muebles. No se habilita aquí edición libre de los cuartos de los mapaches: se eligen detalles del rincón.

## Bandeja de servicio

Nueva mejora **carry_tray**, desde nivel 2: 180 monedas y 2 madera. Permite transportar dos pedidos de comida o bebida, incluidos pedidos de mesas distintas.

- La bandeja de salida muestra capacidad y cada pedido transportado, con devolución individual.
- Cada pedido conserva UID, persona y mesa. Se entrega uno correspondiente a la mesa en cada interacción, independientemente del orden de recogida.
- Dos iconos acompañan al jugador y ambas mesas reciben un marcador discreto. El texto de entrega identifica al dueño del pedido, también dentro de un grupo.
- Guardado y validación utilizan el mismo límite: uno sin mejora, dos con ella. Recargar conserva ambos platos sin cobrarlos.

La comprobación móvil detectó que el nuevo NoriPhone tapaba el centro de **Entregar**. El teléfono comunica la altura real de su borde visible; acciones y joystick se ubican por encima en pantallas pequeñas. Se conservan apertura, personalización y controles del teléfono.

## Guardados y cobros

Sin cambios de versión, claves, rutas o identificadores técnicos. Al cargar una partida sin totalXp se suma a su XP restante lo que ya utilizó para alcanzar su nivel. Ejemplo: nivel 8, XP restante 73 → XP total 1543, mismo nivel, dinero, muebles y mejoras. La migración es idempotente.

Los costes se verifican juntos y se confirman con la propiedad adquirida antes de emitir eventos de monedas/inventario. El bloqueo compartido evita otra compra o ascenso desde un listener síncrono; el nivel esperado rechaza botones antiguos. Cada compra se cobra una vez. Los muebles añadidos al salón comprueban huellas/caminos, entrada, posición guardada del jugador y sillas ocupadas; si no hay sitio se conservan en el depósito.

## Cómo probar

1. Usar una partida tras el prólogo. Cocinar hasta nivel 2; entrar a **Restaurante → Mejoras**.
2. Revisar XP total, coste y requisitos del ascenso a 3. Reunir materiales en la plaza; ascender. Confirmar receta/etapa, dinero y XP.
3. Construir un rincón con suficiente amistad. Subir a las habitaciones y revisar que siguen sus muebles anteriores.
4. Visitarlo durante la pausa de la tarde; observar llegada, actividad y regreso. Elegir un detalle y recargar.
5. Comprar Bandeja de servicio; preparar dos pedidos y recogerlos en la bandeja física. Entregarlos en orden inverso a mesas diferentes.
6. Guardar con ambos transportados y recargar. Terminar el servicio; comprobar cobro único. Abrir/cerrar NoriPhone y entregar mediante toque en celular.

## Comprobaciones realizadas

Sin ejecutar las suites unitarias ni E2E completas, por pedido del usuario:

- **Typecheck y build:** correctos. El build final con los avances remotos integrados transforma 177 módulos; Vite informa 16 avisos de importación estática/dinámica mixta, sin errores.
- **Modelo en Chromium:** XP antigua y migración repetida; conservación de nivel/compras/muebles; nivel 2 gratuito; ascenso explícito, coste exacto, XP/reputación conservadas y rechazo de doble toque/listeners reentrantes; seis etapas de rincones; detalles en las tres habitaciones; rutas hasta cada rincón y regreso al restaurante; rechazo sin cobro ante un mueble preexistente.
- **Servicio dirigido:** dos mesas, límite sin/con mejora, guardar con dos platos, rechazar un guardado sin la mejora correspondiente, devolver el segundo sin tocar el primero, entrega inversa, rechazo de otra mesa y pago único.
- **Interfaz real con fixture de progreso:** 1366×768, 390×844 y 320×844. Ascensos 2→3→4, cambio de etapa, siete compras desde botones, XP total 560 conservada, monedas 5000→3520; cambio del zabuton de Pip, caminata hasta su cuarto y regreso; apertura/cancelación de memoria sin dejar pausa o controles bloqueados; IndexedDB y recarga desde Continuar. Sin desbordamiento horizontal ni errores de página/globales.
- **Versión compilada, móvil emulado 390×844 y 320×568:** recarga desde Continuar con dos iconos/platos; recorrido a mesas y entregas táctiles en orden inverso; dos cobros, dos platos servidos, XP 90→114, nivel 2 conservado; recarga sin segundo pago; apertura/cierre táctil del NoriPhone.
- **npm run balance:** funciona y muestra costes de ascensos, materiales y amistad. Los días estimados se etiquetan como mínimos de XP; excluyen recolección, viajes, bebidas y escenas. El análisis integral queda para el punto 8.

Los recorridos utilizan fixtures controlados y simulación dirigida del tiempo, no representan una partida orgánica completa. No se probó un celular físico, instalación PWA ni Android.

Capturas de ejemplo: [mejoras en PC](art/progresion-hogar/mejoras-pc.png), [rincón en móvil](art/progresion-hogar/rincon-celular.png), [bandeja doble en móvil](art/progresion-hogar/bandeja-doble-celular.png).

## Archivos de la entrega

- Estado/compatibilidad: src/core/state.ts, src/core/types.ts, src/persistence/validate.ts.
- Progresión/renovaciones: src/restaurant/progression.ts (nuevo), orders.ts, upgrades.ts, kitchen.ts; scripts/balance-report.mjs.
- Rincones: src/restaurant/corners.ts y cornerPanel.ts (nuevos); src/data/raccoons.ts, src/data/zones.ts, src/world/zoneRuntime.ts, src/ui/menus.ts.
- Transporte: src/restaurant/carry.ts (nuevo), service.ts, tray.ts; src/world/contextActions.ts, src/scenes/WorldScene.ts.
- Accesibilidad de entrega móvil: src/ui/hud.css, src/ui/phone/phone.ts.
- Documentación/capturas: este documento, docs/roadmap-gameplay.md, docs/prompts-puntos-7-8.md y docs/art/progresion-hogar/.

## Pendientes

Punto 7: hitos personales, escenas cálidas, integración narrativa y epílogo. Punto 8: balance de sesiones completas, pulido y regresiones. Las expectativas antiguas de ascenso hasta nivel 10 por XP y compras solo con monedas en src/tests/progression.test.ts deben actualizarse al nuevo comportamiento autorizado cuando se ejecuten las suites. También corresponde revisar el resto de usos antiguos de transporte único y entrega inmediata.

Probar celular físico/PWA/Android, rendimiento prolongado y necesidades de edición libre del salón quedan fuera de esta entrega. Los precios existentes se conservan; los costes nuevos pueden ajustarse con evidencia en el punto 8.
