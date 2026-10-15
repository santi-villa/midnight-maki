# Fachadas: casas, locales, decoración y luz

## Casas (`src/art/homes.ts`)
Las 16 casas se dibujan con una sola función (`drawHome`) y un solo `homeLayout` que da las ventanas y la puerta: el arte, el brillo nocturno y la puerta usan las mismas coordenadas. Ya no hay ventana en el hastial (techo): el lateral lleva tablas verticales y un pequeño respiradero redondo.
- Techo de tejas con luz y sombra, cumbrera, alero con sombra, estructura de madera, zócalo según el oficio (madera, azulejo azul, ladrillo), zócalo de piedra.
- Ventanas con postigos (o celosía de papel en las casas de té), cajas de flores, farol junto a la puerta, puerta con ventanita y alero con los colores del oficio.
- Por oficio: casa (chimenea, barril, maceta), té (noren, banco con tetera), pescadería (rejilla de pescado, cajones, azulejo azul), florería (baldes de flores, ladrillo).

## Locales: abiertos y cerrados
`drawVillageBuilding(..., closed)`. **Abierto:** puerta con interior cálido, toldo extendido, mercadería a la vista. **Cerrado:** postigos de madera en las ventanas, puerta tablada con candado, toldo enrollado, mercadería tapada. La escena cambia el dibujo sola cuando cambia el horario del local (`refreshShopFacades` en `WorldScene`; el restaurante sigue su horario de servicio). El restaurante y la biblioteca ya no tienen ventana de buhardilla: llevan adornos de cumbrera y un reloj.

## Decoración exterior por oficio (`src/art/shopdeco.ts`)
Bento: carrito de pan con toldo. Taro: cajones de verduras y pilas de sacos. Yuki: maniquí con kimono y percha con prendas. Biblioteca: carro de libros. Ren: pila de leña junto al puesto. Pescaderías: rejilla de pescado (playa). Florería: puesto de flores (puerto). También existe el parasol de té (`deco_teaparasol`), listo para ubicar. Se ubican en `data/outdoorLayout.ts`.

## Luz de noche
Casas: ventanas, vidrio de la puerta y farol encendidos desde el atardecer; ya entrada la noche algunas bajan la luz o se apagan (según la casa, siempre igual). Locales: luz mientras están abiertos, apenas un resto cuando cierran. Restaurante: sigue su horario de servicio.
