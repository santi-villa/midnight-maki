# Ritmo de cocina, personal y servicio (notas por entrega)

## E1 · Ritmo de cocina

**Recorrido observado** (cocina física, mapa de `galley/layout.ts`; datos de las 28 recetas de `data/recetas` vía `billOfMaterials`):
- Las distancias son cortas (heladera, arrocera, tabla y mesa de armado están a ≤ 5 casillas); caminar no es el problema.
- Una receta pide en promedio 4,9 piezas y 2,1 piezas cortadas; las más largas: arcoíris (5 cortadas), rollo vegetariano, futomaki y tres estrellas (4). Cada pieza cortada son 5 barras de reflejos seguidas: 20 en un rollo vegetariano de 38 monedas, 5 en un kappa de 16.
- El arroz es la mayor fricción sin decisión: cada porción (4–6 por tanda) exige heladera → elegir → caminar → cargar, con una sola mano. Cuatro porciones son ~20 acciones por tanda y todas las recetas llevan arroz.
- No encontré esperas vacías: mientras el arroz cuece (22 s) se puede cortar y reunir lo demás.

**Cambios**
- Nuevo verbo `scoop` («Echar arroz»): en la arrocera, mientras carga, saca una porción directo de la despensa (consume el stock real, arranca la cocción, no usa las manos). Sigue existiendo el camino por la heladera y Spicy lo usa. Pasa por delante de «Tomar» mientras carga para que se pueda repetir con un toque.
- Modo **Relajado**: una barra de corte menos (4 en vez de 5; los cuchillos restan 1 cada uno, mínimo 2). Normal y Difícil siguen en 5. Las diferencias de velocidad/zona entre modos no cambian.
- El segundo cuchillo ahora también ensancha la zona (antes `knife2` no sumaba nada al ancho: `knife` era un booleano), como decía su descripción.

**Comprobación:** recorrido real en navegador (`mm_settings.cookMode = relaxed`): 2 porciones echadas con `E` (stock 4 → 2), pepino de la heladera, barra «1 de 4»…«4 de 4», nori, espera real de la cocción, armado, entrega: monedas suben. Solo se teletransportó a la casilla de cada estación. Tests: `galleyModel.test.ts` (scoop, cortes por modo, ancho por cuchillos).

**Limitaciones:** no se midió con jugadores; la reducción del modo Relajado es una estimación basada en la proporción de cortes por receta.

## E2 · Personal y mejoras

**Auditoría**
- **Cocinero contratado**: su tarea (`kind === 'cook'` en `restaurant/staff.ts`) solo corre con la cocina clásica (`!galleyOn()`). En la cocina física no tenía ninguna tarea y cobraba sueldo diario. Opción elegida: *definir disponibilidad*, no rehacerlo: ver abajo.
- **Spicy** en la cocina física no usa «un plato cada N s»: trabaja con sus dos mejoras (`rice_hand`, `cut_hand`); la pantalla de Personal decía lo contrario.
- **Esterilla**: solo acorta el armado 30 % (1,4 s → 1 s); la descripción hablaba de «enrollar», del tablero viejo.
- **Cuchillos**: `knife` y `knife2` restan un golpe cada uno; el ancho de la zona solo mejoraba una vez (la descripción de `knife2` prometía más). Corregido en `cut.ts` (cada cuchillo suma 0,05).
- **Segunda tabla**: la usa Spicy cortador (`BOARDS` en `galley/crew.ts`); no se decía.
- **Arrocera grande / reserva de Spicy**: coinciden con el código (6 porciones por tanda; Spicy mantiene 4 listas).
- **Timbre**: coincide (sin timbre el personal no retira platos en la cocina física).
- **Delantal vs bandeja**: son cosas distintas (manos en la cocina vs platos del mostrador a las mesas, `carryCapacity`); las descripciones ahora lo dicen.
- Los requisitos decían «Primero construí el rincón» incluso para cuchillos y Spicy.

**Cambios**
- Cocineros (`restaurant/staff.ts`, `ui/staff.ts`): con cocina física **descansan**: se conservan, con su nivel, pero no cobran (`payableWage`) y no se pueden contratar nuevos (mensaje claro). Al volver a la cocina clásica todo sigue como antes. No se despide a nadie ni se borra nada.
- Spicy en Personal: texto de la cocina física con sus mejoras.
- Requisito previo con el nombre real (`Primero: Cuchillo de Spicy`, `Primero: Spicy: arrocero`).
- Descripciones de esterilla, cuchillos, segunda tabla, delantal y bandejas.
- Beneficio claramente insuficiente corregido: el segundo cuchillo (4× el precio del primero) ahora también ensancha la zona. No se tocaron precios ni requisitos.

**Comprobación:** navegador con la cocina física (texto de Personal y de Mejoras) y `staff.test.ts` (cocinero conserva nivel, no cobra, no se contrata; vuelve a cobrar en la clásica).
**Limitaciones:** los cocineros contratados siguen sin función en la cocina física (decisión de producto pendiente: darles una tarea propia).

## E3 · Decisiones durante el servicio

**Ya existía:** reserva de arroz en el hangiri (anticipar), mesadas de apoyo, urgencia de los tickets por paciencia, timbre que despierta a Rigg/meseros, Spicy arrocero/cortador y modo Relajado sin penalización por paciencia. La paciencia no corre en pausa (`pumpFloor` y `galley.tick` salen con `clock.paused`).

**Faltaba:** el ticket no decía *qué ya estaba preparado*, y no había forma de elegir el orden.

**Cambios**
- Cada ticket indica lo ya listo en la cocina (mesa de armado, mesadas, tablas con corte terminado, hangiri y arroz hecho en la arrocera): chip `✓ Arroz…`, `½`/`n/m` parcial y, sin abrir la tarjeta, `· 2/3 piezas`. Una pieza cuenta para **un solo** ticket, en el orden de la lista (`allocateStaged`). No se guarda nada nuevo: se calcula del estado de la cocina.
- Botón **☆ / ★ Primero** en cada ticket: lo fija arriba y la heladera resalta solo lo que ese ticket necesita; Spicy cortador atiende primero los cortes de ese ticket (usa el mismo orden de `tickets()`). Es una pista de la sesión, no se guarda, se limpia al servirse o irse los clientes.
- Ninguna mejora quita participación: Spicy sigue manteniendo solo 4 porciones de arroz y corta solo lo que piden los tickets, nunca arma ni entrega.

**Comprobación:** recorrido real en navegador (arroz con `E` desde la despensa, espera real de la cocción, alga y arroz en la mesa): el ticket muestra `✓ Arroz` `✓ Alga`, `2/3 piezas`, y el botón fija el ticket. Test de reparto en `galleyModel.test.ts`.

**Limitaciones:** con un solo ticket el orden no se nota; la coordinación con Pip y Rigg sigue siendo la existente (Pip recibe, Rigg lleva platos al sonar el timbre).

## E4 · Clientes habituales

**Ya existía** (`docs/clientes-del-pueblo.md`): memoria por vecino (visitas, platos queridos, ánimo, esperas), el habitual repite su favorito el 65 % de las veces, frase de llegada según lo que recuerda, invitaciones y visitas planificadas.

**Cambios pequeños, sin monedas ni medidores nuevos**
- **Reconocer el favorito**: un plato es favorito tras ≥ 2 servicios buenos (`favouriteOf`). En el ticket aparece `♥` junto al plato y «su favorito» junto al cliente; al cobrarse bien, el cliente dice «¡Mi favorito de siempre!» con un ♥ flotante (en efectos bajos, solo el texto). Es solo un reconocimiento, no cambia la paga.
- **Visita anunciada**: al despertar, una línea de la mañana avisa de las visitas que invitaste para ese día («Hoy pasa por Midnight Maki: Kai (a la tarde)…»). No es una obligación: si no abrís, la visita queda pendiente.
- **Ocasión especial**: la 5.ª y la 10.ª visita contenta de un vecino dejan un pequeño regalo propio de su oficio (`OCCASION_GIFTS`: p. ej. Kai, fotógrafo → portarretrato; Tomo, pescador → telescopio) en el depósito de muebles y un aviso. Una sola vez por hito (`Regular.gifted`, campo opcional: los guardados viejos cargan igual).

**Comprobación:** `townClients.test.ts` (favorito, regalos por hito sin repetir, guardado sin `gifted`); en navegador, el ticket con ♥ y «su favorito» (ticket sintético: UI únicamente). **No verificado en un recorrido completo**: el comentario ♥ en la mesa y el regalo al irse (requieren varias visitas reales).
**Limitaciones:** los regalos son muebles existentes elegidos por oficio, no arte nuevo; no hay conversación obligatoria al recibirlos.

## E5 · Encargos con consecuencias

**Ya existía**: motor de misiones secundarias (`quests/side.ts`, `side()`), tablón, recompensas (monedas, objetos, muebles, ropa, recetas, amistad), convivencia con los mapaches (`systems/companionship.ts`: «Compartir una merienda») y contadores en `stats`.

**Nuevo (cuatro encargos pequeños, todos opcionales, sin plazos ni rachas)**
| Encargo | Quién | Qué pide | Recompensa visible |
|---|---|---|---|
| Merienda para tres | Pip | compartir una merienda con Pip, Spicy y Rigg | Chabudai + zabuton rosa |
| Una torta para Pip | Spicy (nivel 2) | 3 platos perfectos servidos | guirnalda + peluche de mapache |
| Una reunión en la mesa larga | Rigg (amistad 2) | servir bien a 3 vecinos del pueblo | mesa larga + té |
| Té de la tarde en Midnight Maki | Ume (tras «Té para la abuela») | servir 2 bebidas | kotatsu + 60 ● |

- Los muebles van al depósito (se ubican desde la edición del salón). Se suman `friend +25` con quien los pide (como el resto de los encargos).
- Contadores nuevos en `serveOrder` (un único punto para ambos modos de cocina): `perfectServed` y `neighborsServed`. Los pedidos nuevos cuentan **desde que se aceptan** (`since()` fija la línea base la primera vez que se evalúa el paso; un total viejo no los completa).
- Cada dador sigue teniendo un encargo a la vez (`giverBusy`): estos quedan detrás de los existentes de Pip, Spicy, Rigg y Ume, no los reemplazan ni tocan capítulos.

**Comprobación:** `quests.test.ts` (línea base, avance, recompensa una sola vez, ida y vuelta de guardado) y navegador: aparecen en el tablón, se aceptan y avanzan con `serveOrder` real; guirnalda entregada una vez. **Limitación:** la comprobación del servicio usó el camino real de `serveOrder`, pero sin una partida completa de cocina física con calidad perfecta; no se probó en el diálogo de cada dador.

## E6 · Mejoras vinculadas al hogar

**Ya existía**: los rincones de Pip, Spicy y Rigg (`restaurant/corners.ts`) con sus pausas de la tarde y las escenas de vínculos que cuelgan de ellos (`story/bonds.ts`: `pip_corner`, `spicy_corner`, `rigg_corner`…), con flag `bond_<id>` (día visto), recompensa en un solo bloque y panel de Vínculos con pistas.

**Nuevo** — tres escenas cortas de las renovaciones de *cocina y servicio*, con el mismo motor (se guardan con su flag, no se repiten, no se pagan dos veces, se pueden reproducir desde el panel):
| Escena | Condición | Recompensa |
|---|---|---|
| `spicy_rice` · La primera tanda | «Spicy: arrocero» comprado + amistad 2 con Spicy | recuerdo + 4 arroz y 3 nori |
| `rigg_bell` · El timbre de las ocho | «Timbre de servicio» + amistad 2 con Rigg | recuerdo + reloj de pared |
| `pip_tray` · La bandeja nueva | «Bandeja de servicio» + amistad 2 con Pip | recuerdo + peluche de gato + foto en el álbum |

Todas exigen el prólogo terminado (`intro_done`) y no mueven el misterio principal; no hay diálogos obligatorios: aparecen al hablar con el mapache.

**Comprobación:** `bonds.test.ts` (solo con mejora *y* amistad, una vez, recompensas) y recorrido real en navegador: compra de «Bandeja de servicio» con `buyUpgrade` (monedas y madera descontadas), hablar con Pip, escena completa con los controles de diálogo, recuerdo guardado, un peluche y una foto, y al volver a hablar no se repite ni se paga otra vez. **Limitaciones:** el flujo se probó con la bandeja; las otras dos escenas se comprobaron por test, no en navegador. El prólogo se saltó con `intro_done` (la condición real de la escena).
