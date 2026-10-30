# Integración propuesta en el código actual

Referencia: copia local y commit `1d97d328ddac6dbafd6af9a30aeb6a7bc789bdd7` de [santi-villa/midnight-maki](https://github.com/santi-villa/midnight-maki/tree/1d97d328ddac6dbafd6af9a30aeb6a7bc789bdd7). Esta entrega no modifica el código.

## Por qué copiar los PNG no cambia todavía el juego

`src/scenes/textures.ts` genera y registra texturas desde canvas. Llama a `buildTileset`, `drawObject`, `iconCanvas` y distintos generadores de personajes. Por eso añadir un archivo a `public` no sustituye automáticamente lo dibujado por el código.

| Parte | Archivo/punto actual | Cambio propuesto |
|---|---|---|
| Suelos | `src/art/tiles.ts`, `ensureTileset` en `src/scenes/textures.ts` | Adaptar el atlas externo a los índices que esperan los mapas, o registrar un atlas nuevo con una tabla explícita de equivalencias |
| Muebles | `src/data/furniture.ts`, `furnTexture` en `src/scenes/textures.ts` | Elegir PNG/recorte por ID de mueble y rotación, preservando tamaño lógico e interacciones |
| Objetos del mundo | `src/data/props.ts`, `propTexture` | Cambiar la representación por objeto sin perder estado abierto/cerrado, variantes o etapas |
| Iconos | `src/art/icons.ts`, `iconTexture` | Usar icono externo solo donde exista equivalencia verificada y mantener fallback al icono propio |
| Personajes | `charTexture`, `lookTexture`, `customerTexture` | Conservar los generadores existentes; cualquier sustitución requiere adaptador de cuadros y estados |
| Poses y anclaje | `src/entities/Actor.ts`, `src/art/characters.ts` | Mantener pies, direcciones, expresiones, lectura, saludo, cocina y postura sentada |
| Apariencia | `src/art/hero.ts`, `heroRender.ts`, `folk.ts`, `src/systems/appearance.ts` | Preservar pelo, ropa y accesorios conectados a las partidas guardadas |
| Escena/estado | `src/scenes/WorldScene.ts` | Verificar cultivos por etapa, servicio, sillas/camas y orden de profundidad |
| Pixel art | `src/main.ts` | Ya declara `pixelArt: true` y `roundPixels: true`; conservarlos y revisar escala/cámara en dispositivos reales |

## Contratos que hay que respetar

`Actor.ts` exporta `TILE = 16`. Posiciona los pies con `tx * TILE + TILE / 2` y `ty * TILE + TILE - 2`; el sprite usa `setOrigin(0.5, 1)`. Una imagen alta no implica agrandar la cuadrícula ni su colisión.

Los sprites existentes usan varias dimensiones. `characters.ts` toma `FW/FH` de `chibi.ts` (20×30); `folk.ts` calcula por defecto 24×39 y admite variantes de ancho; los clientes tienen otro generador. Algunos comentarios heredados mencionan 16×24, pero las constantes y el generador efectivo son la referencia. No cambiar dimensiones basándose solo en un comentario.

El layout común de actores tiene **30 cuadros**: movimiento en cuatro direcciones, parpadeos, emociones, sueño, respiración, cocina, saludo, lectura y sentado. `Actor` usa esos índices, así que no puede recibir sin adaptación una lámina de caminar 3×4 o una tira de gato de perfil.

`src/data/furniture.ts` distingue la huella lógica `w/h` en tiles y la altura visual `sh` en píxeles; también contempla rotación. Conservar esos datos y ajustar recorte/anclaje. Revisar que una silla nueva tenga asiento a la altura esperada y que el personaje no aparezca delante del respaldo cuando debería estar detrás.

## Flujo de adaptación

1. Elegir A y resolver los permisos pendientes de sushi/pesca antes de incorporarlos a una distribución. Se puede empezar con los recursos que sí tienen texto comercial adjunto.
2. Crear un manifiesto de runtime pequeño con `id`, ruta, rectángulo de recorte, tamaño de cuadro, pivote, huella lógica y variantes. El manifiesto de esta entrega es un inventario: no sustituye ese contrato de runtime.
3. Recortar las piezas necesarias desde las láminas de Bitglow. Mantener PNG con transparencia y coordenadas enteras. Una lámina de muebles no debe tratarse automáticamente como spritesheet de animación uniforme.
4. Cargar imágenes/atlas con Phaser y registrar claves estables. Añadir reemplazo selectivo en `furnTexture`, `propTexture` o `iconTexture` manteniendo la representación propia como fallback. No reutilizar una clave ya cacheada con dimensiones diferentes sin gestionar esa caché.
5. Para la huerta, emplear PNG `1x` del pack 07 y mapear estados al progreso real del cultivo. El pack incluye tres cultivos y cuatro etapas: no asumir cobertura de todos los cultivos ya definidos por el juego.
6. Para recetas y pesca, construir una tabla por ID del juego; los números de iconos del pack 16 no son identificadores semánticos de las especies del juego. Revisar contenido y nombres antes de asignarlos.
7. Recolorear solo lo necesario para acercar maderas, sombras y verdes a la paleta actual. Conservar contornos de grosor parecido; probar con la iluminación del juego porque una textura con sombra horneada muy intensa puede oscurecerse en exceso.
8. Cargar solo los recursos seleccionados y usados. Excluir ejemplos, capturas, 2x/4x, formatos Unity/RPGMaker y vistas premium del bundle de Phaser.

## Tamaños prácticos

| Uso | Punto de partida |
|---|---|
| Suelo/camino | Celdas 16×16, sin estirar bordes de tiles de forma independiente |
| Iconos de sushi/pesca | Arte base 16×16; ampliar en UI con vecino más cercano cuando convenga |
| Árbol/mueble alto | PNG de varias celdas; pivote en la base, huella independiente de la copa o del respaldo |
| Personaje | Dimensiones del generador actual; mantener el conjunto completo de estados |
| Fichas de cocina | Recursos mayores del pack 13 tras comprobar escala y contorno; pack 28 solo como ilustración si se decide adoptar ese tratamiento |

No convertir todos los recursos a 16×16. Una cama necesita varias celdas y un árbol debe superar la altura de una persona. La consistencia depende de proporciones, densidad de detalle, perspectiva, contorno, color y luz.

## Validación al implementar

Integrar primero una habitación y una parcela. Comprobar caminar detrás/delante del mobiliario, puertas, navegación, giros, sillas ocupadas, cama, bebidas/platos transportados, cambios de etapa, recarga de partida y alternancia día/noche. Revisar escritorio y móvil/Android con los ajustes habituales de cámara.

Tras modificar el código, ejecutar los checks del proyecto pertinentes (`typecheck`, build y pruebas afectadas) y capturar la misma escena antes/después. En esta entrega no se hicieron cambios de implementación y no se declara haber pasado esos checks para una integración inexistente.
