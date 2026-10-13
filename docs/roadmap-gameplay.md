# Hoja de ruta de juego: hacer sushi, que sea lo más entretenido

## Auditoría (lo que ya existía)
- Tablero de cocina con canvas (`src/restaurant/cooking.ts`): alga, arroz, rellenos, corte guiado, enrollado, porcionado, moldeado, cobertura, envoltura, decoración y emplatado. Eventos Pointer, tablero vertical en celular, modos Relajado / Normal / Desafío.
- Recetas con pasos de datos (`src/data/recipes.ts`), pedidos y entrega con platos listos en mesa (`orders.ts`, `service.ts`).
- Calidad 0/1/2 (aceptable / bueno / perfecto) con propinas, reputación y amistad.

Hallazgo principal: en modo Relajado (el predeterminado) casi todo plato salía "Perfecto" sin importar la técnica, así que no había nada en juego.

## Hecho
1. **Cocina continua**: el tablero de pedidos queda abierto entre platos, muestra la bandeja de salida (platos listos y su mesa) y se vuelve a usar para el siguiente.
2. **Consecuencias visibles y justas**
   - Arroz por capas: quedarse en un lugar suma arroz; hay un medidor con zona justa y un botón "Listo".
   - Enrollado con presión: arrastrar para enrollar y luego mantener apretado y soltar en la zona verde (flojo / firme / apretado).
   - Los cortes dibujan las piezas con el ancho real de cada corte.
   - Resumen del plato al final (arroz, relleno, enrollado, cortes) y toque para saltarlo.
   - El modo Relajado ahora premia la técnica con tolerancias amplias; nunca baja de "bueno".
3. **Dominio de recetas (0 a 5 estrellas)** por calidad constante, no por repetir. Con 3 estrellas aparece **Rápido** (un toque, calidad fija, no sube el dominio). Las estrellas se ven en pedidos y recetario.

4. **Corte de pescado con ritmo**: en las recetas con pescado o tamago, una marca oscila y se toca cuando pasa por el centro dorado. Fallar deja el corte irregular pero nunca reinicia el plato. Más lento en Relajado, más rápido en recetas difíciles (siempre con tope cómodo en pantallas táctiles).
5. **Nigiri, onigiri y gunkan**: el arroz se moldea con toques y luego con presión (mantener y soltar en la zona verde). **Temaki**: se arma un cono arrastrando en diagonal. Los platos terminados se dibujan como cada tipo de sushi.
6. **Plato final según calidad**: más cuidado se ve en el plato (alineación, jengibre, hojas y brillos).
7. **Recompensas por dominio**: +4 % de pago por estrella, bonus único de 100 monedas al llegar a 5 estrellas, y cuatro logros nuevos.
8. **Proyectos del pueblo** (cartelera de la plaza): cinco proyectos de dos etapas (plaza, faroles, muelle, claro del bosque, jardín). Cada etapa cuesta monedas y materiales, cambia el mapa (aparecen flores, bancos, faroles, bote, cerezos) y suma encanto al restaurante. Las áreas cerradas no aparecen hasta abrirse.
9. **Encargos de hoy**: hasta tres encargos diarios de vecinos y una meta semanal, con progreso por contadores del juego, recompensa en monedas, sin castigo ni rachas, y siempre los mismos durante el día.
10. **Evolución visual del restaurante** (4 etapas según el nivel: 1-2 heredado, 3-4 recuperado, 5-7 popular, 8-10 corazón de Villa Nori):
    - La fachada se redibuja completa (`src/art/storefronts.ts`): de madera gris con tejas rotas, ventanas tapiadas, musgo y maleza, a madera oscura con shoji encendidos, farolitos y noren; luego toldo y filas de faroles; y al final doble techo con detalles dorados y estrellas.
    - Más cosas fuera: barriles de sake (etapa 3 de la lista: nivel 5+) y bambú (nivel 8+).
    - Más mesas dentro: en cada etapa llegan mesas con sus sillas al salón (se colocan una sola vez, sin pisar los muebles del jugador ni la entrada; lo que no entre queda en el depósito). Más asientos significan más clientes a la vez.
    - Adornos de pared y rincones se suman por etapa; el desorden inicial desaparece.
    - Al subir a una etapa nueva se avisa y el salón se redibuja.
11. **Locales con estilo propio**: panadería (ladrillo, chimenea, toldo, vitrinas con pan, canasto), ropa de Yuki (techo rosa, prendas en las vidrieras, noren), almacén de Taro (techo verde, estantes con frascos, cajones y barril), biblioteca (ladrillo, ventanas con libros) y galería (cuadros en las vidrieras).
12. **Corrección**: la cartelera fallaba al mostrarse cuando estaba disponible el pedido heredado de Sumi (alias viejo sin definición).

13. **Presentación del minijuego de cocina** (punto 2 de la mejora por etapas):
    - Sprites de cocina de 32×24 para arroz, alga, pescados, vegetales, tamago, langostino, shiitake y condimentos; caché compartida entre bandeja, arrastre y mesa. Los ingredientes menos comunes reutilizan su icono.
    - Cuchillo animado, respuesta al colocar ingredientes y deformación del arroz al presionar; partículas limitadas y alternativa sin animación con movimiento reducido.
    - Instrucciones y feedback en una repisa separada, contador de pasos y tipografía pixel; la mesa se reajusta al espacio disponible, incluso en pantallas pequeñas y horizontales.
    - Plato de cerámica con borde verde, piezas por tipo de sushi y presentación según la calidad existente. Resumen de técnica con texto ajustado al ancho.
    - Un arrastre cancelado o una salida limpian el ingrediente flotante, los listeners y el observador de tamaño. Durante el cambio de paso no se aceptan acciones repetidas.
    - Comprobación directa en Chromium: maki, nigiri, temaki, gunkan y onigiri en PC; preparaciones táctiles en celular. Verificación adicional en 320×568 (movimiento reducido) y 844×390. Se completaron platos de calidad básica y perfecta y no hubo errores de página en los flujos terminados.
    - `typecheck` y `build` correctos. No se ejecutó la suite de tests: se pospone al final de las etapas por pedido del usuario. Falta comprobar en un celular físico y ejecutar las suites finales.
    - Capturas: [plato básico en PC](art/cocina/plato-basico-pc.png) y [plato perfecto en celular](art/cocina/plato-perfecto-celular.png).

14. **Recetario coleccionable** (punto 3 de la mejora por etapas):
    - Las 23 recetas tienen una ficha ilustrada, ingredientes, secuencia de preparación, estrellas de dominio y totales de platos preparados a mano y vendidos. Buscador, categorías y filtros por recetas conocidas, preparadas, por descubrir y dominadas. Las recetas ocultas conservan su pista de desbloqueo y no revelan su nombre ni descripción.
    - Puntaje máximo, mejor calidad y día del récord por receta. Se registran al completar el minijuego en pedidos o cocina libre; Rápido y cancelaciones no generan récords ni variantes.
    - Las tres variantes existentes se coleccionan por ingrediente: sésamo en kappa, salmón en onigiri y wasabi en nigiri. Su ficha incluye ilustración, contador y récord. El extra puede agregarse antes de servir, de modo que el nigiri sin paso de decoración también permite usar wasabi. Solo se consume al completar el plato.
    - Presentaciones por receta: cerámica del pueblo desde el inicio, porcelana índigo a las 2 estrellas, flor de sakura a las 3 y plato de honor a las 5. Selección persistente desde la ficha; la vajilla se utiliza en el minijuego y al servir. Son premios visuales: mantienen los precios, puntajes y requisitos de dominio anteriores.
    - Campo opcional `recipeRecords`, con validación de los datos nuevos. Las partidas anteriores mantienen dominio, dinero e inventario; no se inventan puntajes ni variantes que antes no se registraban. También pueden elegir las presentaciones que ya les corresponden por dominio.
    - Acceso directo a **Recetario** desde el menú, además de la pestaña Recetas del Diario.
    - Comprobación directa en Chromium: un pedido de kappa con sésamo en PC y uno de nigiri con wasabi con gestos táctiles; registro, consumo único del extra, aumento de dominio, selección de sakura y vajilla al servir; exclusión de Rápido y cancelaciones; devolución de ingredientes; guardado y recarga con persistencia de récords, variantes y selección; compatibilidad con partidas sin el campo nuevo y limpieza de datos inválidos. Verificación de búsqueda, filtros, recetas ocultas, recompensas bloqueadas, plato de honor a 5 estrellas y conservación de un récord frente a un resultado peor.
    - UI comprobada en 1280×800, 390×844 y 320×568, sin desbordamiento horizontal. `typecheck` y `build` correctos; no se ejecutaron las suites de tests, reservadas para el final por pedido del usuario. Sigue pendiente un celular físico y las regresiones finales del guardado, la cocina libre y el servicio completo de mesas.
    - Capturas con progreso de ejemplo: [ficha en PC](art/recetario/ficha-pc.png) y [presentaciones en celular](art/recetario/presentaciones-celular.png).

15. **Encargos y recompensas** (punto 6 de la mejora por etapas):
    - Quince actividades disponibles según el progreso: las nueve existentes, más cocina manual, variantes, riego, decoración, ordenar la despensa y entregas concretas. Los encargos diarios priorizan grupos de actividades distintos y mantienen el límite anterior de dos o tres encargos.
    - Una meta semanal estable durante los siete días del juego, con temas que rotan entre cocina, vecinos, naturaleza y hogar. Se omiten áreas cerradas, el depósito cerrado y encargos de proyectos cuando ya no queda una etapa accesible. Abrir nuevas áreas no cambia un encargo ya asignado.
    - Recompensas fijas desde la asignación y visibles en la cartelera: monedas, ingredientes, materiales, semillas cuando el jardín está abierto, amistad y un mueble en las metas semanales. Se mantiene la fórmula anterior de monedas; el balance completo queda para el punto 8.
    - Las entregas descuentan los objetos de la mochila al recibir el premio. Los contadores de cocina manual y variantes usan el dominio y los registros existentes del punto 3; cancelar o usar Rápido no los incrementa. El riego solo cuenta cuando una parcela pasa a estar regada.
    - Premios de encargos completados pendientes de cobrar se conservan al cambiar el día o la semana. Los progresos completados por contadores quedan congelados; una entrega pendiente sigue necesitando los objetos. No hay castigos ni rachas consecutivas.
    - Tres recuerdos decorativos de uso libre en Decorar: cuadro de agradecimiento al recibir una meta semanal, furin del vecindario a las tres y bonsái de los vecinos a las seis. Cada recuerdo se entrega una sola vez y queda en el depósito, sin modificar la distribución de los muebles del jugador.
    - Compatible con el JSON `daily_state` de partidas anteriores: conserva IDs, progreso, estado cobrado y monedas de encargos activos. Los premios nuevos aparecen en nuevas asignaciones y los hitos semanales se cuentan desde esta actualización. Marcador de cobro único para impedir premios o entregas duplicados, incluso ante eventos de inventario durante el cobro.
    - Comprobación directa en Chromium: generación determinista y rotación de ocho semanas; quince tipos y bloqueo por áreas; cocina manual, variantes y riego sin contar dos veces; entregas con descuento y rechazo de cobros repetidos/reentrantes; contrato numérico antiguo de cobro; premio pendiente al cambio real de día sin abrir la cartelera; hitos de una, tres y seis metas sin duplicar ni colocar muebles; proyectos terminados excluidos; exportación/importación, guardado y recarga.
    - Comprobación de UI en 1280×800, 390×844 y 320 píxeles de ancho: botones de entrega y premio, estado recibido, recuerdos y persistencia tras recargar la página; sin errores de página ni desbordamiento horizontal. `typecheck` y `build` correctos. Las suites de tests siguen reservadas para el final por pedido del usuario; faltan un celular físico y una partida prolongada para el balance del punto 8.
    - Capturas con progreso de ejemplo: [cartelera en celular](art/encargos/cartelera-celular.png) y [premios semanales en PC](art/encargos/premios-semanales-pc.png).

16. **Ampliación de proyectos del pueblo** (punto 5 de la mejora por etapas):
    - Seis proyectos y 22 etapas: las cinco restauraciones originales pasan de dos a cuatro etapas, y se suma Rincón de lectura con dos. Se mantienen los IDs, precios, materiales, flags y cambios de mapa de las diez etapas originales.
    - Las etapas nuevas incluyen participación: cocina manual, regalos, recolección, fotografías guardadas, pesca, bichos, juegos de memoria, riego, cosecha y lectura. **Comenzar colaboración** registra el contador actual sin cobrar; solo cuentan las actividades posteriores. No vence. **Construir etapa** cobra los materiales y monedas cuando todos los requisitos están cumplidos. Índice de etapa y bloqueo de construcción impiden cobros repetidos desde un botón viejo o eventos reentrantes.
    - Beneficios utilizables: mesa de té y memoria con Pip en la plaza, puesto de materiales y minijuego de ordenar, provisión para cocina en la playa, memoria con Rigg en el bosque y banco de semillas en el jardín. Las provisiones son una vez por día, persistentes al recargar; los juegos reutilizan sus recompensas y límites diarios existentes. El taller también habilita encargos de ordenar.
    - Orilla cuidada y Sendero de recolección suman dos puntos diarios de recolección por zona. Los índices, semillas y marcas de los puntos anteriores se conservan; los nuevos usan objetos comunes y no modifican la aparición de objetos narrativos.
    - Bancales nuevos amplía el jardín de seis a ocho parcelas. Las dos nuevas están en posiciones libres de la segunda fila y tienen marcos de madera. Se conservan todas las plantas existentes; plantar, regar, crecer y cosechar utilizan el sistema anterior, con la misma velocidad y condiciones. Una partida que ya tenga el flag de finalización recupera sus parcelas adicionales si le faltan, sin reemplazar cultivos.
    - El club de lectura añade amistad con Kumo una vez por día al leer, a través del mismo control de atención comercial de 08:00 a 23:00. Los diálogos y las excepciones narrativas de la biblioteca siguen usando el flujo anterior.
    - La cartelera muestra la próxima etapa, la participación, el costo y el beneficio, con las demás etapas plegadas. Cobrar un encargo actualiza inmediatamente los materiales y botones de construcción de la misma cartelera.
    - Verificación directa en Chromium: construcción de las 22 etapas con requisitos y cargos exactos, colaboración sin pago ni progreso retroactivo, rechazo de cobros reentrantes y botones viejos, cultivos preservados, nuevas parcelas plantadas/regadas/cosechadas, suministros únicos con reinicio diario, lectura diaria, recolección sin duplicación, exportación/importación y carga de partidas con las diez etapas antiguas completadas. Caminos hacia todas las puertas e interacciones y posiciones de servicios/parcelas comprobados en las cinco zonas de los proyectos.
    - Recorrido real desde la cartelera en 1280×800 y 390×844: iniciar participación, construir y actualizar el mapa, retirar provisión, visitar plaza/playa/bosque/jardín/biblioteca, respetar el cierre de la biblioteca, plantar y cosechar desde el menú de una parcela adicional, abrir el juego de memoria del claro y conservar proyectos/cultivos al recargar la página. Comprobación de actualización de construcción tras cobrar un encargo. Sin errores de página en estos recorridos.
    - `typecheck` y `build` correctos. No se ejecutaron las suites de tests por pedido del usuario; se reservan para el final. Pendientes: celular físico, balance de costos/beneficios en una partida prolongada (punto 8) y conexión narrativa de las restauraciones (punto 7).
    - Capturas de una partida de ejemplo: [colaboración en celular](art/proyectos/colaboracion-celular.png) y [jardín ampliado](art/proyectos/jardin-ocho-parcelas.png).

## Compatibilidad
- Guardados viejos: `recipeMastery` es opcional y se completa vacío al cargar (`validateSave`).
- Sin cambios en los capítulos de la historia ni en los contratos de calidad 0/1/2.

## Pendiente
1. Conectar los resultados de las restauraciones con pequeñas escenas y recuerdos (punto 7).
2. Ejecutar las regresiones de los puntos 2, 3, 6 y 5 al finalizar la serie de mejoras (suites pospuestas por pedido del usuario).
3. Probar todo en un celular real: hasta ahora solo se probó en un navegador emulado en vertical.

## Criterios de aceptación de esta etapa
- Un plato bien hecho y uno descuidado se ven y se pagan distinto, sin llegar nunca a "fallar".
- Cerrar la cocina entre platos no duplica ingredientes ni recompensas.
- Todo funciona con mouse y táctil; las pruebas (`vitest`, `tsc`, `build`, e2e `newgame`) pasan.
