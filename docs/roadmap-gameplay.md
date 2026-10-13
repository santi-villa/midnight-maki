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

## Compatibilidad
- Guardados viejos: `recipeMastery` es opcional y se completa vacío al cargar (`validateSave`).
- Sin cambios en los capítulos de la historia ni en los contratos de calidad 0/1/2.

## Pendiente (en este orden)
1. Corte de pescado con ritmo (marcador oscilante) solo en recetas con pescado, con el modo relajado ampliado.
2. Nigiri y temaki con pasos propios (presión del arroz, cono).
3. Arte del plato final según calidad (cortes dispares, rollo abierto) en la pantalla del plato.
4. Recompensas por dominio (presentaciones, decoración, clientes habituales).
5. Un tablón único de proyectos para el restaurante y el pueblo.
6. Encargos diarios de vecinos, cortos y con historia.

## Criterios de aceptación de esta etapa
- Un plato bien hecho y uno descuidado se ven y se pagan distinto, sin llegar nunca a "fallar".
- Cerrar la cocina entre platos no duplica ingredientes ni recompensas.
- Todo funciona con mouse y táctil; las pruebas (`vitest`, `tsc`, `build`, e2e `newgame`) pasan.
