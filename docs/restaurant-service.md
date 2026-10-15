# Punto 4 — Grupos, servicio físico y bebidas

Continuación del nuevo orden, tras identidad (2), experiencia móvil (6) y convivencia (3). Se amplía la máquina de estados del salón, los recorridos de visitantes y Pip, pedidos, cocina, economía y guardados existentes. No se reemplazan capítulos, escenas de historia, recetas, canciones ni sistemas de tiempo/iluminación.

## Grupos e identidades

- Grupos de 1–4 integrantes, limitados por las sillas reales de una mesa. Comparten llegada, recepción de Pip, mesa y salida; cada integrante conserva identidad, cara, paciencia, calidad recibida y pedidos propios.
- Los ocho clientes dibujados existentes —Oli, Toby, Fredi, Pipo, Po, Gigi, Nico y Leo— tienen identidad estable en el servicio. Los clientes anteriores permanecen disponibles; se reutilizan los ocho estilos gráficos. Una misma persona ya no cambia de sprite entre la calle, el salón o una recarga.
- Bolsa mezclada sin reemplazo. Se agota antes de volver a mezclar, evita repetición inmediata cuando hay alternativas y evita repetir personas o apariencias dentro del grupo. Se excluyen también las caras presentes en los grupos activos. Si no quedan candidatos apropiados, se sigue atendiendo el salón y se espera para una llegada posterior.
- Pip recibe grupos, los acompaña y regresa siguiendo el sistema de puestos del punto 3. Al recuperar una partida con un grupo caminando a su mesa, puede retomar el acompañamiento.
- Los pedidos se toman en la mesa y se crean por integrante. Sushi y bebida tienen UID propio, vinculados a persona, asiento, mesa y grupo, aunque varios pidan lo mismo. El límite anterior se aplica a grupos, con espacio para sus pedidos individuales.

## Atención y paciencia

Un indicador **!** por mesa cuando espera pedido, y un pequeño indicador del mismo estilo para la mesa de destino cuando Sofi lleva comida. Barra pequeña verde/amarilla/roja durante la espera.

En modo normal la paciencia llega a cero sin expulsar al cliente. Puede comentar brevemente que tiene hambre y pierde su propina; sigue siendo posible tomar, preparar y entregar su pedido. Cada integrante deja de esperar cuando recibió todos sus pedidos. El modo relajado conserva paciencia y propinas, y muestra la barra tranquila. Pausas, menús, cocina y escenas detienen el servicio junto con el reloj. La presentación de un plato terminado también pausa ahora, evitando consumir paciencia detrás de esa pantalla.

El cierre a las 23:00 detiene llegadas nuevas. Los pedidos tomados pueden terminarse. Dormir conserva los pedidos individuales pendientes y preparados para continuar después; no cobra automáticamente un plato que todavía está en la bandeja.

## Bandeja y entrega

Se añade un pequeño tramo de mostrador con una bandeja junto a la caja, conservando el mapa y las estaciones anteriores. La estación de bebidas está junto a la cocina.

1. Preparar sushi en la cocina o una bebida en su estación. El menú de pedidos permite preparar varios consecutivos.
2. Acercarse a **Bandeja de salida**. La lista muestra nombre del pedido, persona, número de mesa y calidad.
3. **Recoger** un pedido. Sofi lo muestra en sus manos y la mesa correcta recibe un marcador discreto.
4. Caminar hasta esa mesa y **Entregar**. Intentar otra mesa conserva el pedido y avisa. Cada UID se entrega una sola vez.
5. Si hace falta, volver a la bandeja y **Dejar el pedido**, sin gastar ingredientes nuevamente.

La capacidad inicial es un pedido por viaje. Las ampliaciones de bandeja corresponden a la progresión posterior. Los pedidos de historia y práctica continúan utilizando el mostrador y sus escenas anteriores; no se les impone el circuito del salón.

Cuando todo el grupo recibió sus pedidos, termina de comer, paga y sale. El cobro real utiliza la economía existente por plato/bebida y se suma en una cuenta compartida; la propina queda en la mesa hasta recogerla. Una sola presentación resume los cobros del grupo, conservando descubrimientos, regalos, recetas desbloqueadas y reforma visual al subir de nivel, evitando una escena obligatoria por cada pedido.

## Bebidas

Se habilitan desde nivel 2, tras el encuentro inicial. Interacciones breves, sin límite de tiempo ni fallos punitivos:

| Bebida | Preparación | Ingredientes | Precio base del pedido |
| --- | --- | --- | --- |
| Té verde | Elegir taza y dosificar | Hojas de té | 9 |
| Ramune | Sacar botella, abrir bolita y servir | Botella de ramune | 11 |
| Leche de frutilla | Mezclar y llenar | Leche y frutilla | 14 |

Taro vende los suministros nuevos y frutillas. Los clientes pueden pedir bebida con su sushi. Los ingredientes se consumen al completar la preparación; cerrar antes no consume. Se impiden preparaciones duplicadas y se revalida el pedido antes del consumo. Una bebida preparada utiliza la misma bandeja, transporte, destinatario, propina y pago que la comida. No se registra como receta de sushi ni adelanta objetivos que requieren servir sushi. Tiene estadísticas y XP/reputación propios. El resumen diario diferencia platos, bebidas y grupos recibidos.

## Guardados

- Campo opcional `dining`: grupos, integrantes, tickets, fase, paciencia, mesas, propinas, bolsa de clientes y resumen de turno. Los recorridos continuos de calle siguen siendo temporales; se recuperan los grupos que ya llegaron al salón desde su fase guardada.
- Pedidos conservan su formato anterior, con `kind` opcional para bebidas, vínculo de servicio opcional y estado de plato preparado/transportado/entregado. UID, receta, destinatario y calidad permanecen asociados.
- Se conserva progreso parcial: comida entregada, bebida en manos de Sofi, otros pedidos preparados o por preparar, y propinas todavía no recogidas. Cargar no paga ni cocina automáticamente esos pedidos.
- Los cobros siguen siendo idempotentes por UID. Se recuperan grupos y propinas, sin volver a pagar lo que ya salió de la lista de pedidos.
- Las reformas que agregan mesas conservan el salón activo y sus tickets. No se reinicia el servicio al cambiar la lista de muebles.
- El validador acepta partidas anteriores sin los campos nuevos. Rechaza enlaces o estados nuevos incoherentes antes de importar/guardar, para evitar perder platos o duplicar transporte. La versión técnica y las claves de almacenamiento no cambian; la extensión es opcional.
- Los platos preparados del formato anterior sin vínculo de mesa mantienen la recuperación anterior en el mostrador. Monedas, inventario, amistad, recetario, dominio, muebles, proyectos e historia permanecen en sus estructuras existentes.

## Archivos modificados

- Datos y guardado: `src/core/types.ts`, `src/persistence/validate.ts`, nuevo `src/persistence/dining.ts`.
- Servicio: `src/restaurant/floor.ts`, `src/restaurant/service.ts`, `src/restaurant/orders.ts`, nuevo `src/restaurant/customers.ts`.
- Cocina, bandeja y bebidas: `src/restaurant/kitchen.ts`, nuevos `src/restaurant/tray.ts`, `src/restaurant/drinkData.ts`, `src/restaurant/drinks.ts`.
- Mundo y acciones: `src/scenes/WorldScene.ts`, `src/world/contextActions.ts`, `src/data/zones.ts`.
- Suministros y presentación: `src/data/items.ts`, `src/ui/shops.ts`, `src/art/icons.ts`, `src/ui/styles.css`, `src/ui/daySummary.ts`.
- Documentación: este documento, `docs/roadmap-gameplay.md` y capturas de `docs/art/restaurante-servicio/`.

## Comprobaciones realizadas

No se ejecutaron las suites unitarias/E2E completas, por pedido del usuario. Se realizaron comprobaciones focalizadas con partidas controladas:

- Typecheck y build correctos; Vite mantiene los avisos de importaciones estáticas/dinámicas ya existentes.
- Modelo con mesas reales: cuatro integrantes, cuatro sushis y cuatro bebidas; capacidad y destinatarios; platos idénticos con UID distinto; rechazo de otra mesa, recarga con plato transportado, entrega parcial, espera agotada sin abandono, conservación al dormir y cobro único. Cuenta del grupo igual a los cobros reales. Separación de estadísticas de sushi/bebidas.
- Bolsa: 18 identidades antes de repetir, siguiente selección sin repetición inmediata y grupo sin caras repetidas.
- Grupo de tres en nivel 1: sin bebidas anticipadas; espera prolongada en modo relajado conserva paciencia y propina. Recoger propina dos veces cobra una sola vez. El caso anterior de pareja también crea dos identidades/pedidos y termina sin pedidos huérfanos.
- Interfaz en Chromium a 1366×768 y móvil emulado 390×844: recepción/acompañamiento, pedido desde el HUD, cocina de varios sushis, las tres bebidas, cancelación a mitad de té sin gasto, consumo único, bandeja con botones táctiles, transporte visible, entrega por destinatario y liquidación del grupo. Sin incidencias en la auditoría interna del servicio ni errores de página/manejador global en las comprobaciones completadas.
- Build de producción en móvil emulado: continuar desde IndexedDB tras recarga real con una entrega parcial, té transportado, otro sushi preparado y té pendiente. Conservó cuatro pedidos, identidades, inventario y monedas. Se completaron entregas y bebida; subió de nivel 2 a 3 y reconstruyó los props de la reforma. Cobró, recogió 4 monedas de propina una sola vez y otra recarga conservó monedas/estado sin repetir pagos.
- Partida anterior sin `dining` aceptada; snapshot inconsistente rechazado por el validador.

Capturas de partidas controladas, con recursos de prueba, no de una partida del usuario. No se probó celular físico, PWA instalada, APK ni sesión extensa.

## Pendientes del plan

Punto 5: costes/progresión, renovaciones y rincones personales, incluyendo ampliaciones de transporte si corresponde. Punto 7: misiones y narrativa de los mapaches. Punto 8: pulido, balance conjunto y suites completas, adaptando las expectativas anteriores de abandono por paciencia y entrega sin recoger al comportamiento nuevo. El punto 1 continúa aplazado.

## Ajustes de la etapa 1 (plan maestro)
- **Mesas opacas:** los comensales sentados ya no atraviesan el "ver a través" de los muebles; solo los que caminan (o Sofi y los vecinos) hacen transparente lo que tienen delante. Un cliente sentado queda parcialmente detrás de su mesa, como corresponde.
- **Clientes sentados:** del lado de arriba de la mesa miran a la cámara, del lado de abajo le dan la espalda (sprites propios para cada vista, con respiración y animación de comer) y en los extremos se sientan de perfil.
- **"!" amarillo sobre cada cliente** que espera que le tomen el pedido (sube y baja un poco). La mesa solo se marca en dorado cuando es el destino de un plato.
- **Flecha de entrega:** mientras Sofi lleva comida, la flecha dorada apunta a la mesa más cercana de destino y cada destino lleva su cartel ("Mesa 2 · Ebi nigiri"; con dos platos para la misma mesa se unen). Con la bandeja doble se ven ambas mesas. Fuera del restaurante apunta a su puerta. La misión sigue activa y la flecha vuelve a ella al entregar (`src/world/delivery.ts`).
