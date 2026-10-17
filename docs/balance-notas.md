# Balance: lectura de los números (sin tocar valores)

Salen de `npm run balance` y `npx vite-node scripts/staff-economy.ts`. Son estimaciones: no incluyen viajes, duración real de cocina, pedidos cancelados, misiones ni propinas.

## Lo que muestran
- **Demanda mayor que la capacidad.** Un día medio trae unos 54 clientes (37 en una mañana de semana, 89 en un atardecer de fin de semana). Un cocinero contratado en nivel 0 hace unos 20 platos por jornada, y el nivel 4 unos 60. Con un cocinero y un mozo el salón sigue sin llegar a toda la demanda, así que el jugador sigue siendo necesario y no queda sin tareas.
- **Primer cambio importante.** Con 60 de experiencia se llega a nivel 2 (unos 6 platos). La primera mejora (Bandeja de servicio, 180 ● + 2 de madera) equivale a unos 18 platos de margen temprano: alrededor de una jornada.
- **Costo de personal.** Contratar: mozo 150, cocinero 220. Sueldos de 16 a 54 por día según nivel y puesto. Con 25 platos al día el margen es de unos 336 ●, así que un cocinero (22 ●/día) se paga solo.
- **Total a gastar.** Mejoras 7.720 ●, ascensos 2.480 ●, proyectos 5.450 ●: unos 15.600 ●. A 300 ●/día al principio serían ~50 días; con recetas de más precio (márgenes de 25 a 60 por plato) rinde mucho más. Es largo pero no abusivo.

## Lo que me llama la atención (para mirar jugando, no para cambiar a ciegas)
- Los platos baratos de arranque dejan margen muy chico: kappa 4–8 ●, onigiri 4–7 ●, california 5–11 ●. Si el comienzo se siente lento, el ajuste sería el precio o el costo de esos tres.
- Pasa al revés con los de nivel alto: spicy_beacon, rainbow o dragon dejan 50–90 ● por plato. La brecha entre el principio y el medio del juego es grande.

## Qué falta para cerrar el balance
Medir con partidas reales: cuántos platos hace por jornada alguien que juega, y en qué día compra cada mejora. Con eso se ajustan precios; sin eso, cambiarlos sería adivinar.
