# Prompts para las entregas restantes

Copiar cada bloque por separado. Los números corresponden al nuevo orden de Maki & Mapaches, no a la serie anterior de recetas y proyectos. La auditoría formal del punto 1 sigue aplazada.

## Punto 7 — Historias y vínculos de Pip, Spicy y Rigg

Implementá el punto 7 de Maki & Mapaches: historias personales, escenas cotidianas y vínculos de Pip, Spicy Beacon y Rigg con su hogar y el misterio de Akio.

Repositorio: santi-villa/midnight-maki. Antes de editar, revisá ramas remotas y estado local. La rama de trabajo autorizada es master-mgsshv; incorporá avances posteriores de forma segura, sin force push ni sobrescribir cambios ajenos. Publicá commits coherentes directamente en esa rama.

Primero leé docs/companionship.md, docs/restaurant-service.md, docs/progression-home.md y docs/roadmap-gameplay.md. Revisá la historia completa, secundarias, eventos de amistad, recuerdos de restauraciones y epílogo existentes. Identificá qué ya está hecho y ampliá esos sistemas sin duplicar misiones ni inventar contradicciones.

Objetivos:

1. Dar a cada mapache una progresión personal de hasta cinco hitos. Priorizá pocas escenas memorables sobre muchas tareas repetitivas.
2. Pip: amistad, tesoros, recuerdos y sentido de hogar. Spicy: creatividad y confianza como cocinero. Rigg: libros, responsabilidad y afecto por los otros dos, con humor sutil.
3. Conectar hitos con amistad, capítulos, actividades compartidas y las renovaciones/rincones existentes. No exigir rachas ni castigar ausencias.
4. Agregar escenas breves entre los tres: humor, pequeños accidentes, celebraciones y descanso. Deben ser opcionales cuando corresponda, tener condiciones claras y no repetirse constantemente ni interrumpir el servicio.
5. Dar recompensas que no sean solo monedas: receta cuando encaje, decoración, recuerdo, fotografía o actividad. Entrega única y persistente.
6. Integrar recuerdos de Akio en objetos y renovaciones sin adelantar pistas, abrir regiones anticipadamente ni alterar las revelaciones principales.
7. Conservar los ocho capítulos, las tres estrellas, el faro, el misterio central y el final. Complementar el epílogo con una cena cálida de los tres si falta. Revisar primero la dedicatoria a Sofi existente y conservarla, integrándola sin mostrarla antes de tiempo.
8. Mantener juego libre después del final, misiones anteriores, pedidos pendientes y partidas antiguas. Los jugadores avanzados deben acceder a nuevas escenas que les correspondan sin rehacer compras o capítulos.

Conservá el pixel art japonés cozy, personalidades y diálogos vigentes. Reutilizá pausa, escenas, amistad, cámara, álbumes y guardado. No cambies reloj, horarios, iluminación, estaciones, música o mapa salvo una necesidad demostrada de esta entrega.

Trabajá en cambios pequeños. Comprobá de forma focalizada desbloqueos, cancelación, pausa, retorno al puesto, entrega única de recompensas, guardado/recarga y compatibilidad antigua. Revisá PC y celular emulado. Ejecutá typecheck y build; dejá las suites completas de tests/E2E para el punto 8.

Al finalizar, documentá escenas/hitos, requisitos, recompensas, archivos modificados, cómo probarlos, comprobaciones reales y límites. Hacé commits coherentes y subilos a master-mgsshv. No avances al punto 8 sin mi confirmación.

## Punto 8 — Pulido, economía y comprobación final

Implementá el punto 8 de Maki & Mapaches: pulido y balance de las entregas recientes, seguido de las pruebas de regresión completas que dejamos para el final.

Repositorio: santi-villa/midnight-maki. Revisá ramas remotas y cambios locales antes de editar. Trabajá sobre master-mgsshv, incorporando avances posteriores sin perder trabajo. Subí commits coherentes directamente a esa rama; no hagas force push.

Leé los documentos de identidad/móvil, convivencia, restaurante, progresión/hogar, narrativa y balance existentes. Revisá el código actual antes de asumir qué está implementado. La auditoría formal del punto 1 sigue aplazada; el objetivo ahora es cerrar y verificar estos cambios.

Objetivos:

1. Balancear monedas, ingredientes, materiales, XP, reputación, ascensos manuales y renovaciones. Incluir grupos, bebidas, propinas, bandeja doble y rincones. Actualizar el informe reproducible de economía para reflejar costes reales y XP total conservada. Explicar supuestos y distinguir estimaciones de sesiones jugadas.
2. Evitar bloqueos tempranos: nivel 2 gratis, materiales accesibles y suficientes ingresos para elegir una primera mejora. Conservar niveles, compras y muebles antiguos. No cambiar todos los precios indiscriminadamente.
3. Pulir animaciones, indicadores y feedback donde haya problemas concretos: preparación, platos transportados, destino de mesas, paciencia, descansos y escenas. Conservar estilo cozy; evitar carteles grandes, globos superpuestos o efectos invasivos.
4. Revisar móvil vertical (320, 390 y un tamaño intermedio), horizontal y PC: botones, textos, scroll, áreas seguras, teclado/mouse, táctil, NoriPhone, pausas, movimiento reducido y audio. Medir rendimiento cuando se afirme una mejora. No afirmar prueba en celular físico si solo hubo emulación.
5. Revisar resumen diario: grupos, sushi, bebidas, cobros y propinas, progreso del ascenso y materiales necesarios. Reutilizar el resumen existente y mantenerlo breve.
6. Comprobar que Pip recibe y acompaña grupos; los tres llegan a sus rincones y regresan; no bloquean puertas, cocina o clientes; escenas y compañía no dejan controles o tiempo bloqueados.
7. Comprobar pedidos individuales y varios pedidos iguales, platos/bebidas, bandeja doble, devolución y entrega en orden inverso a mesas distintas. No cruzar clientes, consumir ingredientes dos veces ni duplicar cobros/recompensas. Patiencia agotada no expulsa; modo relajado y pausa no penalizan.
8. Verificar partida nueva desde intro/salto, prólogo automático, comienzo dentro del restaurante, reloj/HUD, horarios 08:00–23:00 y entrada/salida de interiores. Conservar cambios recientes de mapa y controles. No alterar velocidad del tiempo, iluminación, estaciones o música sin demostrar un defecto y documentar la corrección.
9. Verificar historia, secundarias, hitos personales, pistas, regiones y epílogo. Escenas/recompensas importantes se guardan y no se repiten indebidamente.
10. Probar exportación/importación, IndexedDB, recarga y migraciones: apariencia, inventario, monedas, XP total, niveles, restauraciones, decoración, servicio activo, pedidos preparados/transportados/parcialmente entregados, recetas/dominio, amistad, fotos, misiones e historia.

Ahora sí ejecutá suites unitarias, typecheck, build y E2E disponibles. Revisá expectativas antiguas de ascenso automático, mejoras solo con monedas, inicio en plaza, expulsión por paciencia o entrega sin recoger. Adaptá pruebas al comportamiento autorizado; no debilites assertions, ocultes fallos ni cambies lógica solo para hacer pasar tests. Agregá regresiones que cubran defectos y contratos relevantes.

Corregí fallos reproducidos y repetí las comprobaciones afectadas. Separá problemas del producto y del entorno. No des por terminado el punto solo porque compila. Evitá dependencias pesadas y refactors ajenos al objetivo.

Entregá archivos/correcciones, balance antes/después, pruebas ejecutadas con resultados y conteos reales, limitaciones, fallos pendientes y comandos de reproducción. Actualizá documentación y subí commits pequeños a master-mgsshv. No inicies funcionalidades nuevas fuera de este cierre sin mi confirmación.
