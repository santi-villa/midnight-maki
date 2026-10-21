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
