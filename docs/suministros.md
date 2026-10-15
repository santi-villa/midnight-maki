# Suministros, compras y despensa (etapa 2)

- **Comprar:** en el almacén de Taro hay una pestaña *Paquetes y cajas* (y en el puesto de Nami, *Cajas de pescado*) además de la compra por unidad (y ×5). Un paquete trae 3–8 unidades y una caja 8–20, con 10 % y 20 % de descuento respecto de comprar suelto (`PACKS` en `src/data/items.ts`). También se consiguen ingredientes recolectando y pescando.
- **Transporte:** los paquetes y cajas van en la mochila como cualquier objeto (varios juntos, sin peso).
- **Despensa de la cocina** (la "Despensa" del mostrador; `src/ui/pantry.ts`): *Guardar paquetes y cajas* los abre y guarda lo que contienen; *Guardar ingredientes sueltos* mueve los de la mochila. Capacidad 60 unidades; con la mejora "Despensa ampliada", 140. La vista muestra cuánto hay por categoría (base, pescado, verduras y frutas, huevos/lácteos/bebidas) y lo que todavía llevás en la mochila.
- **Cocinar:** consume primero la despensa y después la mochila (`game.consumeIngredients`); los números de las recetas cuentan ambas. Cancelar devuelve a la mochila lo que se había consumido, una sola vez.
- **Sin compra automática:** el botón "Comprar lo que falta" se quitó de pedidos y cocina libre. Ahora dice qué falta y dónde conseguirlo (`shortageText`).
- **Primeros días:** el inventario inicial alcanza para los primeros pedidos. Red de seguridad: si por la mañana no se puede cocinar nada y quedan menos de 30 monedas, Rigg deja arroz, alga y pepino (una vez por mañana en que haga falta).
- **Partidas viejas:** `pantry` es opcional; las partidas sin despensa cargan con 0 unidades y siguen usando su mochila.
- **Pendiente / decisión:** el depósito del fondo sigue siendo un lugar de historia (cerrado con llave al principio), por eso las existencias viven en la despensa de la cocina. Dejado para después: pedidos a proveedores, entregas programadas, reposición por empleados, y una app "Suministros" en el NoriPhone.

## Madera y piedra: Carpintería de Ren
La madera y la piedra (mejoras del restaurante, ascensos, proyectos del pueblo) ya no dependen solo de recolectar al azar: **Ren** atiende un puesto en la plaza (`REN_STALL` en `data/neighbors.ts`, comercio `ren` en `ui/shops.ts`) con horario comercial. Precios: madera 20, piedra 28. Ren pasa su jornada de trabajo en el puesto. El aviso "Falta" de mejoras y ascensos dice dónde conseguirlas. Los comercios ya no compran madera ni piedra (se vendían por 2 y 1 moneda). Seguir recolectando funciona igual; talar y picar queda para más adelante.
