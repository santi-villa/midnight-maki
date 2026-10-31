# PROGRESS — Midnight Maki

Registro de avances **verificados** (✅ probado en navegador o por tests) y pendientes.
Última actualización: sesión 1.

## Cómo continuar
1. `npm install` y `npm run dev` → `http://localhost:5173`.
2. Pruebas en pestañas en segundo plano: `?st&debug` (`st` = loop por setTimeout porque los navegadores
   pausan requestAnimationFrame en pestañas ocultas; `debug` = expone `window.mmDebug` con `game`, `world`,
   `clock`, `storage`). Para capturas, agregar la clase `reduce-motion` al body (las animaciones CSS
   quedan congeladas en pestañas ocultas).
3. `npm run typecheck` · `npm test` (21 pruebas) · `npm run e2e` (Playwright) · `npm run build` · `npm run icons`.
4. Ver "Pendiente" y `ROADMAP.md`.

## Verificado ✅
- **Serene Village (LimeZu), 30/10/2026:** dos bases de terreno y nueve sprites para diez IDs naturales existentes, con verdes suaves y sin añadir obstáculos ni decoración. Bosque, jardín y zonas verdes usan árboles frondosos, flores, arbustos, rocas y cercas del pack. Pinos y cerezos conservados. 44 pruebas de mapas/fachadas y tres de navegador pasan; capturas y procedencia en `docs/serene-village.md`.
- **Playa más despejada, 30/10/2026:** arena beige clara y ondas de menor contraste, incluida la orilla animada. Decoración del pack reducida de 17 a seis piezas, con un solo rincón de sombrilla y el centro libre de objetos sueltos. 39 pruebas de atlas, navegación y distribución pasan; comparación en `docs/playa-antes.png` / `docs/playa-ajustada.png`.
- **Japanese City FREE (GuttyKreum), 30/10/2026:** nueve piezas para expendedoras, letreros, postes y puestos del mercado. Atlas de 3,6 KB, extracción reproducible y crédito dentro del juego. Distribución compatible con calles, puertas y mejoras futuras (37 pruebas); carga y dibujos de respaldo verificados en navegador. Organización de los packs y recomendación de seguir con la versión gratis en `docs/japanese-city.md`. Modern Exteriors queda a cargo del usuario.
- **E2E Playwright** (Chromium, celular Pixel 7, gestos reales): nueva partida → carta → entrar al restaurante →
  tutorial de Spicy → cocinar el primer maki arrastrando/frotando/deslizando → servir → guardar → recargar → Continuar.
- Build de producción, typecheck y 21 pruebas (lógica de estado, guardado/migración, A*, integridad de
  todo el contenido: ids, recetas, mapas, props, ropa, preferencias, pistas). Las pruebas detectaron y se
  corrigieron 2 errores reales (recetas sin sésamo; la validación regalaba ítems al cargar).
- Título animado, editor de personaje, intro con carta, llegada a la plaza.
- Mundo: tocar para caminar (A*), cámara, puertas entre zonas, tocar un edificio lleva a su puerta,
  NPC con rutinas, clientes sentados en el restaurante, iluminación por momento del día.
- Las 10 zonas se renderizan bien (plaza, restaurante, habitaciones, depósito, playa, bosque, jardín,
  estación, mercado, faro).
- Diálogos con retratos, historial, opciones; conversaciones diarias, ofertas de misiones de vecinos, regalos.
- Restaurante: pedidos → cocina táctil (probados todos los tipos de paso: alga, arroz, relleno, enrollar,
  cortar, moldear, cubrir, envolver, decorar, emplatar) → entrega, monedas, experiencia, reputación.
- Tienda (comprar, pestañas), editor de decoración (colocar, validar), dormir → nuevo día.
- **Historia completa jugada de punta a punta** con un recorrido automatizado: prólogo, capítulos 1–8 y
  final (incluye restauración frotando, deducción en el cuaderno, puzle del reloj, puzle de estrellas,
  mercado nocturno por el torii, llave de la estación). Se corrigió un bloqueo (puerta de la estación).
- Guardado/carga en IndexedDB conserva historia, pistas, decoración, monedas y día.
- PWA: manifest, íconos (Pip), service worker con precache de todos los archivos del build.

## Implementado (verificación parcial)
- Pesca (la lógica corre con requestAnimationFrame; no se pudo simular en pestaña oculta).
- Insectos, macetas (fusión), ordenar despensa, memoria contra mapaches, puzle del tocón.
- Jardín con cultivos visibles por etapa (plantar, regar, cosechar; nunca mueren).
- Eventos del calendario como escenas: Festival de las Flores, del Sushi, Día de los Mapaches,
  Noche de Faroles, Mercado de la Luna, Día de la Lluvia; cumpleaños de los mapaches.
- 27 misiones secundarias + 5 tareas; 18 logros con premios; cámara y álbum; post-historia
  (carta y visitas de Akio, rincón secreto, receta Maki Secreto, escena especial para Sofi).
- Vecinos que se refugian de la lluvia en el restaurante y charlan entre sí.

## Sesión 2 (pedidos de Santi)
- Mapaches rediseñados según los peluches: Spicy (chiquito gris, arriba), Rigg (mujer, marrón rojiza con
  brazos negros, medio), Pip (grandote gris con franja, abajo). Textos de Rigg en femenino.
- Iluminación nueva: gradación por momento del día, resplandor cálido en faroles/ventanas/guirnaldas,
  luz de ventanas sobre la calle, viñeta, sombras de objetos y bajo paredes, rayos de sol por las ventanas,
  sombras de nubes, salpicaduras de lluvia y charcos.
- Más detalle: máquinas expendedoras, bicicletas, macetas, pizarra de menú, toldos, guirnaldas, carteles.
- Animaciones: respiración en reposo, rebote al caminar, globos con rebote, NPCs que te miran, polvo al
  caminar, monedas flotantes, logo con ola, menú escalonado, paneles con rebote.
- Pantallas de carga: al abrir (HTML con tips) y tarjeta con nombre de zona al viajar.
- Menú principal con los tres mapaches frente al restaurante, estrellas fugaces, halos y cámara que se mece.
- Android: proyecto Capacitor en `android/` (pantalla completa, sin zoom, botón atrás = cerrar ventana o
  abrir menú, ícono de Pip). En la web también se bloquean zoom y "atrás".
  Generar APK (requiere JDK 17 + Android SDK): `npm run apk` → `android/app/build/outputs/apk/debug/app-debug.apk`.

## Sesión 3
- Intro animada antes de la carta (CinematicScene): ciudad lluviosa → carta bajo la puerta → carta →
  tren al amanecer junto al mar → llegada a Villa Nori. Subtítulos tipo cuento, se puede saltar.
- Look "3D": todos los objetos pasan por `art/shade.ts` (luz arriba-izquierda, sombra abajo/derecha,
  contorno); sombras proyectadas con la silueta de cada objeto y personaje (siguen la animación);
  empedrado y pasto con relieve.
- Noche nueva: capa que MULTIPLICA (colores saturados) + charcos de luz cálida + halo aditivo.
- Puestos del mercado rehechos (toldo con volumen, interior iluminado, mercadería colgando) y mercado decorado.
- Diálogo con borde doble y estrellitas.

## Exteriores con Modern Exteriors (LimeZu)
- Playa hecha: arena, paseo de arena compacta, mar animado y orilla del pack; sombrillas, toallones, castillos, gaviota, boyas y rocas en el mar. `?exteriors=classic` compara. Ver docs/asset-credits.md.
- Plaza hecha: fuente con agua, bancos, faroles (su luz nocturna sale de la linterna), buzón, macetas, canteros sobre el empedrado y dos palomas. Bancos, faroles, buzón y macetas cambian en todas las zonas porque son los mismos objetos.
- Siguen: faro, plaza, mercado, calles, alrededores del restaurante, estación.

## Pendiente / próximos pasos
- Jugar varias horas reales para afinar balance (precios de pescados ya reducidos).
- Más líneas de diálogo por vecino y escenas de amistad niveles 4–5.
- Animaciones específicas (sentarse en sillas, comer) y más variedad de clientes.

## Mapa jugable aprobado — 30/10/2026
- Integrado el boceto 02: plaza despejada, parcelas privadas, barrio al este, bosque y jardín al oeste, santuario/estación al norte, costa y puerto al sur.
- Nueve distritos en coordenadas compartidas; dieciséis casas conservan sus IDs e interiores. Caminos, puertas, NPCs, misiones, comercios, cultivos y proyectos reubicados.
- Migración única de posiciones exteriores antiguas sin borrar progreso. El paseo del mercado se recorre de día y sus actividades respetan el horario nocturno.
- Validación: 643 pruebas, compilación y recorrido real automatizado con partida antigua, cruces, restaurante, noche y celular. Documentación: docs/villa-nori-mapa.md.
