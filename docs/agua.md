# Sistema de agua

## Qué se ve
- **Colores:** tres tonos de azul (poco profundo, intermedio, profundo) con manchas claras y oscuras que cambian según la variante del tile; así no se nota la cuadrícula.
- **Ondulaciones suaves:** crestas claras con sombra que suben y bajan 1–2 px.
- **Corrientes discretas:** hilos finos que se deslizan 4 px por cuadro (un ciclo completo = un tile).
- **Brillos animados:** un destello por cuadro; en agua poco profunda a veces es una pequeña cruz.
- **Orillas:** en la playa la ola sube y baja sobre la arena mojada con espuma cortada; en lagos y estanque la espuma del borde de pasto late entre dos cuadros y tiene un degradé de aguas bajas.
- **Luna (noche):** una senda de destellos por cada cuerpo de agua grande.
- **Faroles:** una estela cálida debajo de cada farol que esté a ≤ 6 tiles sobre el agua (máx. 6 por zona).
- **Salpicaduras:** de vez en cuando un anillo + 4 gotitas.
- **Lluvia:** otro juego de tiles más gris y picado, con anillos de lluvia dibujados en los tiles, más anillos sueltos sobre la superficie; luna casi apagada y estelas a la mitad.
- **Día:** solo ondas y brillos de los tiles; la luna no aparece y los faroles recién se reflejan desde el atardecer.

## Cómo funciona
| Pieza | Dónde | Costo |
|---|---|---|
| Tiles `wt<c|r><s|m|d><variante>_<cuadro>` (3 variantes × 4 cuadros × 3 profundidades × 2 climas) y `shore0-3`, `bkb<máscara>` | `src/art/nature.ts`, `src/art/tiles.ts` | se generan una vez en el tileset |
| Animación: cada ~0,45 s se reescriben los tiles de agua / orilla / borde (`putTileAt`, unos cientos) | `WorldScene.updateWater` | casi nulo |
| Reflejos y salpicaduras | `src/scenes/waterFx.ts` | 1 imagen por lago + ≤ 6 estelas + 10 anillos reutilizados + 1 emisor |
Las colisiones no cambian: todos los tiles de agua siguen siendo sólidos y el mapa (`ground`) no se tocó. La pesca y la navegación no se modificaron.

## Modo batería (`lowFx()`) y movimiento reducido
- **Se desactivan:** animación de tiles (queda un solo cuadro), anillos, gotas, emisor, cambio de cuadro de los reflejos.
- **Se mantiene:** la luna y las estelas de faroles, estáticas (son 1–7 imágenes) y el cambio a tiles de lluvia cuando llueve.

## Verificaciones
- `src/tests/water.test.ts`: 4 cuadros por tipo, solidez, variantes, tono intermedio, y que cada celda de agua de todas las zonas use el tile calmo correcto.
- `e2e/water.spec.ts`: día, atardecer, noche y lluvia en playa, bosque y jardín (capturas en `docs/art/agua/`); luna apagada de día y fuerte de noche; anillos con lluvia; animación en modo normal; todo quieto en modo batería y con movimiento reducido.
- La plaza no tiene superficie de agua (solo la fuente, que quedó afuera a pedido); el río/lagos/mar de playa, bosque y jardín son los que se mejoraron.
