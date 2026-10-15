# Villa Nori según la ilustración de referencia

La ilustración que se usa como guía está en `public/mapa/villa-nori.webp` y es **el mapa del menú** (`ui/worldmap.ts`, con los lugares marcados encima). El mapa jugable de Villa Nori (`plaza`) se rehízo en su costado este para seguirla:

| En la ilustración | En el juego (`src/data/plazaEast.ts`) |
| --- | --- |
| Cascada sobre las rocas, arriba | `waterfall` sobre un muro de roca (`C`) en x 34–46, y 0–2; el río baja desde ahí |
| Río con curvas que se parte alrededor de las casas | Dos brazos: el principal (x≈38–41) y uno que se separa al sur del molino y rodea la península de casas |
| Molino de agua junto al río | `mill` (5×3) pegado a la orilla, con la rueda hacia el agua |
| Colina con terrazas, escaleras y torii | Dos terrazas (y 0–6 y 10–13) separadas por muros de roca con escaleras (`stonestairs`); arriba, puestos del mercado y el torii |
| Casas rodeadas por el río, con vallas | Península con 3 casas (las del barrio de la ribera) y un huerto cercado |
| Cerezos con estanque e islote | Arboleda de cerezos con estanque, islote con puentecito, faroles y bancos |
| Costa con arena, botes y muelles | Franja de arena, orilla, mar con botes; los muelles del puerto viejo se conservan |

## Qué cambió de lugar
- La zona pasó de 58×44 a **72×44** casillas (`EAST.W`): la ilustración necesita ese ancho. Todo lo que está a la izquierda de x = 32 (restaurante, tiendas, fuente, biblioteca, calles de las casas) **no se movió**.
- La entrada al **Mercado Nocturno** ahora está arriba, en la terraza del torii (63–64, 0), como en la ilustración. La del **Jardín** sigue en la fila 12–13 pero en el borde este (71, 12–13). Las puertas de vuelta (mercado y jardín) se ajustaron.
- Casas: `house_plaza_46_15` (40,21), `house_plaza_50_20` (48,21), `house_plaza_30_27` (40,26). Los ids no cambian (guardados y vecinos siguen funcionando).
- Nuevo tile de roca (`C` → `cliff_top` / `cliff_face` / `cliff_foot`, según los vecinos) y tres props: `mill`, `waterfall`, `stonestairs`.

## Qué no se hizo
El resto de las regiones (bosque, estación, jardín, mercado, playa) siguen siendo mapas separados unidos por puertas, no un único mapa continuo como en la ilustración. Sus lugares y salidas siguen la misma geografía (bosque al norte, estación al oeste, jardín al este, playa al sur, mercado al noreste), pero el interior de cada región no se rehízo a partir de la imagen.
