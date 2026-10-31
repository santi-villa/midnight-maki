# Japanese City gratis en Villa Nori

Integración del 30 de octubre de 2026. Alcance: GuttyKreum para los detalles
comerciales japoneses de la plaza y el Mercado Nocturno.

## Reparto de los packs

Esta tabla organiza los roles previstos; no supone que todos los packs estén
comprados, descargados o integrados.

| Pack | Función principal | Zonas / estado |
| --- | --- | --- |
| [VectoRaith — Traditional Japanese Buildings](https://vectoraith.itch.io/traditional-japanese-buildings-tileset-pack) | Arquitectura tradicional y fachadas | Casas, restaurante exterior y edificios principales. Conservar las fachadas ya elegidas. |
| [LimeZu — Modern Interiors](https://limezu.itch.io/moderninteriors) | Muebles y objetos de interior | Restaurante, cocina, casas y tiendas. Integración existente. |
| [LimeZu — Modern Exteriors](https://limezu.itch.io/modernexteriors) | Terreno costero e infraestructura exterior | Playa, paseos, plaza y estación. Trabajo del usuario, fuera del alcance de esta entrega. |
| [LimeZu — Serene Village](https://limezu.itch.io/serenevillagerevamped) | Naturaleza y ambiente rural | Bosque, jardines, senderos y zonas verdes: [integrado](serene-village.md). |
| [GuttyKreum — Japanese City FREE](https://guttykreum.itch.io/free-japanese-city-game-assets) | Acentos urbanos y comerciales japoneses | Plaza y mercado: integrado en esta entrega. |
| [Willosuna — Cozy Villagers Animals](https://willosuna.itch.io/cozy-villagers-animals) | Posible colección de vecinos animales | Opcional; comprobar escala, direcciones y animaciones antes de sustituir personajes existentes. |

VectoRaith define la arquitectura del pueblo. GuttyKreum aporta acentos localizados;
no se importan sus calles completas ni sus edificios encima de las fachadas actuales.
Modern Exteriors y Serene Village tienen funciones previstas distintas: espacio urbano/costero
y naturaleza rural, respectivamente. Seleccionar una sola familia visual por material.

## Piezas incorporadas

- Expendedoras roja y blanca. Los IDs históricos `vending_red` y `vending_blue`
  se conservan; el segundo ahora muestra la máquina blanca del pack gratuito.
  Aparecen en sus ubicaciones existentes, incluido el Mercado Nocturno.
- Dos postes eléctricos, con y sin transformador, situados en bordes de las calles
  comerciales y del mercado. En la plaza sustituyen dos faroles existentes;
  no se añaden cables que crucen la pantalla.
- Dos letreros comerciales suspendidos, junto a Yuki, Taro y los nuevos toldos del mercado.
  Son decoración sin colisión ni sombra; los nombres legibles y horarios siguen
  perteneciendo a los comercios del juego. No se atribuye una traducción a los glifos del pack.
- Un expositor de comercio de dos celdas delante de Taro, junto a los sacos y
  en el lugar del antiguo expositor de verduras, sin tapar su puerta.
- Dos puestos de toldo azul y rojo en la ampliación oriental del mercado.
  Cada uno combina un toldo y un expositor de la versión gratis. Los puestos
  con compras, minijuegos y adivinación mantienen sus posiciones y comportamiento.

Las baldosas fuente son de 32 px. Se extraen objetos completos con sus píxeles nativos,
sin reducir indiscriminadamente la hoja a 16 px ni estirar objetos para ocupar celdas.
El atlas ocupa 256×128 px y 3.635 bytes de PNG. Solo se quita el margen transparente;
la paleta original se conserva. Los postes tienen una huella de una celda y un dibujo alto.
Las ubicaciones decorativas se mantienen en `src/data/outdoorLayout.ts`, el plano
de calles que utiliza el juego; los dos puestos fijos se definen en `src/data/zones.ts`.

## Reproducción y comparación

```
python scripts/build-japanese-city-assets.py
```

El script acepta `JAPANESE_CITY_SRC` apuntando a `Free_Version` y usa exclusivamente
`Tilemap/Tilemap.png` de la descarga local. El catálogo de
`src/assets/japanese-city/catalog.json` registra los rectángulos, composición, recorte,
hash SHA-256 y ubicación de cada pieza. La lámina de previsualización paga no se utiliza.

El atlas se instala en BootScene antes de generar los props. Si falta, se usa el
dibujo por código de cada objeto. `?japaneseCity=classic` permite comprobar esos
dibujos de respaldo; mantiene la distribución nueva del mapa.

Validación: build de producción, las 37 pruebas existentes de zonas y distribución
(puertas, interacciones, recolección, calles despejadas y mejoras futuras) y pruebas de navegador para los recortes,
el atlas ausente y la comparación. Capturas de plaza de día y mercado de noche
en `docs/japanese-city-*.png`.
El Mercado Nocturno conserva su iluminación nocturna permanente.

## ¿Comprar el completo?

Recomendación para este reparto: **seguir con el gratuito**. La versión gratis ya
cubre las expendedoras, postes, letreros y los toldos seleccionados. El completo
se solapa con la arquitectura que se quiere resolver con VectoRaith.

La [página gratuita](https://guttykreum.itch.io/free-japanese-city-game-assets) anuncia
379 tiles estáticos; la [completa](https://guttykreum.itch.io/japanese-town) anuncia
637 estáticos y ocho tiles animados. El 30/10/2026 la completa figura a USD 5,99
en oferta, con precio habitual de USD 7,99. Considerarla cuando hagan falta
apartamentos modulares, más fachadas comerciales o las animaciones del pack;
no hace falta para esta integración. Precio y oferta pueden cambiar.

## Uso y créditos

La licencia publicada por GuttyKreum permite modificaciones y uso dentro de juegos
comerciales o gratuitos; prohíbe redistribuir los recursos sueltos y usarlos como
logo o marca. La descarga completa sigue en la carpeta ignorada de fuentes.
El juego carga únicamente los recortes usados y menciona al autor en Créditos.
