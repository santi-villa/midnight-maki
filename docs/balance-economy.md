# Economía y progresión · Punto 8

Informe reproducible: `npm run balance`. Lee directamente recetas, ingredientes, balance, mejoras y proyectos. No usa ni modifica partidas. No simula escenas ni presenta sus estimaciones como una partida jugada.

## Problemas medidos y ajustes

Todos los márgenes siguientes descuentan comprar los ingredientes a precio completo. Se excluyen extras, suministros gratuitos, propinas, amistad, encanto y dominio.

| Caso | Antes | Después |
| --- | ---: | ---: |
| California: precio de referencia | 25 | 32 |
| California: margen con pedido mínimo (90% del precio) | −1 | +5 |
| California: margen en cocina libre, calidad normal | −9 | +2 |
| California: margen en cocina libre, perfecto | −4 | +8 |
| Onigiri: margen en cocina libre, normal | −1 | +2 |
| Philadelphia: margen en cocina libre, normal | −1 | +8 |
| Primera mesa: precio | 500 | 300 |
| Cuchillo: precio | 600 | 350 |

Cocina libre paga ahora el 80%, 90% o 100% del precio según calidad, en lugar de 60%, 70% u 80%. No recibe primas del servicio por encanto, estrellas ni propinas. El panel muestra el intervalo real, sin sumar variantes opcionales. Todas las recetas con ingredientes comprables tienen margen positivo incluso en calidad normal. Los ingredientes de recolección se excluyen de esa garantía: su disponibilidad y valor de venta deben considerarse al elegir un plato.

Las mejoras iniciales pasan de 56/67 platos básicos buenos de ahorro a 30/34, con una mezcla uniforme de recetas iniciales y de nivel 2. Son referencias desde cero, sin gastar en otra cosa ni sumar encargos, objetos iniciales, propinas o recompensas de historia. No son requisitos de platos preparados. El precio del resto de mejoras se conserva.

## Ritmo de desbloqueo

Se conservan experiencia por nivel, experiencia por receta, reloj, temporadas, encargos y proyectos. Modelo de pedidos sin favoritos: 70% selección uniforme entre recetas conocidas + 30% entre las tres más caras. Calidad buena; desbloqueos por nivel; sin recetas especiales de historia ni dominio. Usa cantidades fraccionarias medias, no una secuencia de pedidos simulada.

| Nivel | Platos acumulados medios | Días sirviendo 6/día | Días sirviendo 10/día | Días sirviendo 16/día |
| --- | ---: | ---: | ---: | ---: |
| 2 | 5,6 | 0,9 | 0,6 | 0,4 |
| 3 | 15,2 | 2,5 | 1,5 | 0,9 |
| 4 | 25,4 | 4,2 | 2,5 | 1,6 |
| 5 | 36,9 | 6,2 | 3,7 | 2,3 |
| 6 | 49,4 | 8,2 | 4,9 | 3,1 |
| 8 | 74,9 | 12,5 | 7,5 | 4,7 |
| 10 | 108,0 | 18,0 | 10,8 | 6,7 |

Cinco pedidos perfectos de kappa dan exactamente nivel 2 (5 × 12 XP = 60). Los niveles posteriores permiten mejores márgenes. En el modelo, llegar a nivel 10 deja unas 3745 monedas netas del servicio, sin contar el dinero inicial ni fuentes extra.

Todas las mejoras cuestan 5300 monedas; las 22 etapas de proyectos, 5450, más materiales y colaboraciones. Comprar todo sigue siendo una meta posterior a los desbloqueos de nivel, no una exigencia de la historia. Los proyectos no requieren comprar las mejoras del restaurante: se puede elegir dónde gastar. No se abarataron todas las etapas ni se aceleró el tiempo para forzar completar todo a la vez.

## Compatibilidad y límites

- Los pedidos guardados conservan el importe acordado. California usa el nuevo precio en pedidos nuevos y cocina libre; no se reescriben recompensas de pedidos anteriores.
- No se descuentan mejoras ya compradas ni se altera progreso, cultivos, estilos, recuerdos o encargos previamente asignados.
- El modelo no incluye viajes, duración de minijuegos, órdenes abandonadas, prioridades del jugador, festivales, recursos estacionales ni barreras de historia. Los días dependen de cuánto se sirva; no se calculan minutos reales de juego.
- Pendientes: una partida orgánica prolongada para confirmar el ritmo y un celular físico. Las pruebas de navegador usan Chromium y emulación móvil.

## Verificación

246 tests unitarios en 31 archivos, typecheck y build pasaron. Incluyen compatibilidad de pedidos anteriores, cobro único, margen de recetas comprables, ritmo inicial y conservación de progresión. Se reprodujo además una compra reentrante que cobraba dos veces la misma mejora; el bloqueo durante la transacción corrige el problema y libera el intento incluso si falla.

Preparación real de kappa con sésamo en PC y nigiri con wasabi mediante gestos táctiles en emulación móvil: pago correcto por calidad y variante, extra descontado una sola vez. Dos casos E2E nuevos verifican la conexión entre premio de encargo, botón de construcción, recuerdo opcional, intervalo de pago y guardado/recarga. La suite existente también se ejecutó; la primera corrida obtuvo 51/56 y cinco fallos. La recarga en caliente durante cambios invalidó el contexto de inicio y produjo instancias distintas del servicio en las consultas de algunos tests. Los cinco casos pasaron en ejecuciones focalizadas con servidor limpio y código estable. El caso de jornada también amplía el límite de espera para visitantes físicos bajo carga del navegador. Resultado agregado: los 56 casos existentes y los dos nuevos verificados; no se presenta como una única corrida completa de 58/58.

Archivos de implementación: `src/core/balance.ts`, `src/data/recipes.ts`, `src/restaurant/economy.ts`, `src/restaurant/kitchen.ts`, `src/restaurant/upgrades.ts`; análisis en `scripts/balance-report.mjs` y `package.json`. Regresiones en `src/tests/progression.test.ts`, `src/tests/restoration.test.ts`, `e2e/progression.spec.ts`, `e2e/hours.spec.ts`; comentario de etapas actualizado en `src/data/projects.ts`.

## Personal, insumos y clientes del pueblo (etapas 2, 3 y 8)

Modelo reproducible: `npx vite-node scripts/staff-economy.ts` (lee recetas, precios, sueldos y la demanda del código). Es una estimación, no una partida jugada.

- **Día de servicio:** 08:00–23:00, a un minuto mostrado por segundo real = unos 900 s con la puerta abierta. Llegadas base cada ~30 s (26–34 s), divididas por `demandFactor` (0,4–2,2): mañana de semana ×0,7, atardecer de fin de semana ×1,7, lluvia ×0,85, con fama y habituales hasta ×2,2. Con grupos de ~1,75 personas son unas 54 personas/día en un día medio sin fama, 37 a 116 según el caso.
  **Es un techo de llegadas, no de platos servidos:** el límite real es el salón (mesas, tiempo de comer, quién atiende), que este modelo no simula.
- **Capacidad de cocina por turno completo:** Spicy 26 platos/día en nivel 0 → 75 en nivel 4; cocinero contratado 20 → 60 (arranca más lento a propósito). Un cocinero en nivel 0 no alcanza para un día medio, así que el jugador sigue cocinando.
- **Márgenes:** recetas iniciales y hasta nivel 3 (11 recetas): precio medio 28,8; ingredientes comprados sueltos 15,4 → margen ~13,4 por plato (los paquetes y cajas bajan el costo). Con 25 platos/día son ~336 de margen.
- **Sueldos por día:** mozo 16→40, cocinero 22→54, cajero 18→42, ayudante 14→34 según nivel; contratar 150–220, entrenar 90–300. Un cocinero contratado en nivel 0 (20 platos/día, ~270 de margen) cuesta 22 al día: se paga solo en el primer día.

### Hallazgos y qué no se tocó
1. **Los sueldos son muy bajos frente al margen** (≈8 % en el caso del cocinero). Contratar es casi siempre rentable; lo que frena es el nivel del restaurante (`staffLimit`, `cookLimit`) y el costo de contratar, no el sueldo. Si se quiere que contratar sea una decisión, hay que subir sueldos (por ejemplo ×2–3) o hacer que un empleado sin trabajar cueste. No lo cambié sin medir una partida real.
2. **Los insumos comprados a precio completo se comen ~53 % del precio;** por eso los paquetes y cajas (con descuento) son la forma sana de comprar, y la despensa importa.
3. **La demanda dinámica puede superar al salón** en fines de semana con fama: las llegadas esperan en cola/afuera. Es el comportamiento buscado (más gente que mesas), pero conviene mirarlo en una partida larga.
4. Los vecinos que vienen suman reputación (+1 por visita contenta) además de la de cada plato; con muchos habituales acelera la subida de nivel de reputación. Sin medir en juego largo.

Pendiente: partida orgánica prolongada para confirmar ritmo, y teléfono físico.
