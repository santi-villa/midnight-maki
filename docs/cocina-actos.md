# Cocina por actos (prototipo)

Dentro del restaurante, al cocinar la cámara enfoca la cocina real y Sofi camina entre estaciones (tabla, arroz, plancha, plato) animando cada paso. Abajo, un panel con un solo gesto grande por vez:

- **Tocar** cuando el aro se cierra sobre el círculo (ritmo de 1 o 3 toques).
- **Mantener** y soltar en la marca dorada.
- **Elegir** ingredientes (con señuelos fuera del modo relajado).
- **Esperar** olla/plancha (botón «Ir a la olla/plancha»).

Código: `src/kitchen/beats.ts` (reglas y puntaje puros, con tests), `src/kitchen/act.ts` (`KitchenAct`, mismo contrato `DishBoard` que el tablero), `WorldScene.cook*` (cámara y pose). Puntaje final con `judgeCook`; el modo relajado nunca falla.
Ajuste «Cómo cocinar»: `cookStyle` = `act` (por defecto en el restaurante) o `board` (tablero clásico). Test: `e2e/cook-act.spec.ts` (escritorio y celular).
Pendiente: extender a todas las familias de recetas (hoy probado con maki) y retirar el tablero cuando se apruebe.
