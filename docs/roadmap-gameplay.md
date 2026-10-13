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

## Compatibilidad
- Guardados viejos: `recipeMastery` es opcional y se completa vacío al cargar (`validateSave`).
- Sin cambios en los capítulos de la historia ni en los contratos de calidad 0/1/2.

## Pendiente
1. Más proyectos por área y más tipos de encargo con pequeñas escenas.
2. Recompensas de dominio visuales (estilos de presentación) además del pago y los logros.
3. Probar todo en un celular real: hasta ahora solo se probó en un navegador emulado en vertical.

## Criterios de aceptación de esta etapa
- Un plato bien hecho y uno descuidado se ven y se pagan distinto, sin llegar nunca a "fallar".
- Cerrar la cocina entre platos no duplica ingredientes ni recompensas.
- Todo funciona con mouse y táctil; las pruebas (`vitest`, `tsc`, `build`, e2e `newgame`) pasan.
