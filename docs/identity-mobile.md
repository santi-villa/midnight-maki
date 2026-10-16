# Mapaches y Sushi · Identidad y experiencia móvil

Entregas 2 y 6 del nuevo orden. La auditoría formal del punto 1 se aplaza por pedido del usuario.

## Identidad

El videojuego se presenta como **Mapaches y Sushi** en carga inicial, portada, fallback sin ilustración, créditos, metadatos web, nombre de instalación PWA y etiquetas Android/Capacitor. El restaurante conserva **Midnight Maki** y el pueblo, **Villa Nori**. No se renombraron appId, repositorio, claves de guardado, rutas de navegación ni paquetes.

Portadas vertical y horizontal adaptadas mediante edición generativa de las ilustraciones originales de `docs/canvas/01-menu/arte-original/`. Conservan la composición nocturna, los tres mapaches, el restaurante, río y faroles; el título nuevo sigue el estilo pixel art. Los originales permanecen disponibles. Los WebP publicados pesan aproximadamente 214 y 220 KiB. No se cambiaron ilustraciones de la historia, sprites del juego ni canciones.

La caché del service worker pasa a v2 con el mismo prefijo técnico para actualizar las ilustraciones y el manifiesto. Guardados y ajustes siguen en sus almacenes actuales.

Archivos: `index.html`, `public/manifest.webmanifest`, `public/sw.js`, `public/title/title-{vertical,horizontal}.webp`, `capacitor.config.ts`, `android/app/src/main/res/values/strings.xml`, `src/scenes/BootScene.ts`, `src/ui/title.ts` y estilos compartidos. Se actualiza la expectativa del título de carga en `e2e/boot.spec.ts`.

## NoriPhone y controles

- El botón del HUD y el botón Atrás de la aplicación abren NoriPhone. El menú anterior sigue en Más, con personaje, descanso, guardado y salida.
- Aplicaciones: Cámara, Fotos, Mapa, Misiones, Amigos, Colecciones, Recetario, Restaurante, Calendario, Recuerdos, Pistas, Mochila, Ajustes y Más.
- Reutilizan las pantallas y datos actuales. La galería de fotos se comparte con Colecciones; Amigos enlaza fotos y recuerdos. Cámara cierra el teléfono antes de capturar el mundo.
- Las aplicaciones se abren sobre el teléfono. Cerrarlas vuelve al teléfono; cerrar este libera la pausa. Los tiempos y la fecha vienen del reloj existente, y se refrescan también al descansar desde Más.
- Apertura breve, alternativa de movimiento reducido, botones táctiles y grilla que reduce columnas con pantallas pequeñas o texto grande. No hay notificaciones nuevas ni un segundo reloj.
- El teléfono impide aperturas duplicadas. Los errores asíncronos se registran mediante runTask; el usuario conserva el cierre y puede reintentar.
- Se restaura el foco al cerrar ventanas. Los accesos del HUD se distribuyen en dos filas en pantallas de 320 px para conservar blancos táctiles de 44 px.
- Acciones contextuales con icono y texto: hablar, regalar, puertas, pedidos, cocinar, servir, propinas y examinar/comprar. Atención y entrega dentro del alcance reciben una preferencia de medio tile frente a acciones casuales; distancia y orientación siguen influyendo.

Archivos: `src/ui/noriPhone.ts`, `src/ui/menus.ts`, `src/ui/hud.ts`, `src/ui/hud.css`, `src/ui/styles.css`, `src/ui/dom.ts`, `src/ui/skin.ts`, `src/world/contextActions.ts`, `src/main.ts`.

## Vibración opcional

Desactivada inicialmente. Ajustes guarda una preferencia adicional sin reemplazar opciones anteriores. Usa navigator.vibrate cuando existe, con pulsos breves para corte perfecto, preparación excelente, recompensas y desbloqueos. Límite de frecuencia de 350 ms y ausencia de pulsos con la página oculta. Falta de soporte o rechazo del navegador no impiden jugar. Una excepción real se registra de forma acotada, sin notificación global por fallar un efecto opcional.

No se añadió Capacitor Haptics: el plugin no estaba instalado y esta entrega mantiene el fallback web/WebView sin una dependencia adicional. Se declara el permiso normal VIBRATE en Android. No se asume soporte iPhone; el feedback nativo y la vibración física requieren prueba en dispositivo.

Archivos: `src/core/haptics.ts`, `src/core/types.ts`, `src/persistence/storage.ts`, `src/ui/settingsPanel.ts`, `src/restaurant/cooking.ts`, `src/restaurant/orders.ts`, `src/restaurant/projects.ts`, `src/quests/quests.ts`, `src/quests/daily.ts`, `android/app/src/main/AndroidManifest.xml`.

## Comprobaciones y pendientes

Typecheck y build. Comprobaciones focalizadas en Chromium de aplicaciones, ida y vuelta, pausa, fotos, guardados existentes y ajustes en 1280×800, 390×844, 320×568 y 844×390. API háptica simulada para activación, desactivación, frecuencia y falta de soporte: no equivale a probar vibración física. Comprobación adicional de producción: partida nueva, encuentro automático con Pip, reloj del teléfono tras descanso, continuar guardado, texto grande y movimiento reducido; fallback de portada y menú cuando falta la ilustración.

Las suites completas se reservan para el cierre de las etapas restantes, por pedido del usuario. Pendientes: teléfono físico, instalación y ejecución de APK/Android, instalación PWA real y una sesión prolongada. No se implementan aún caricias/juegos nuevos, NPC nuevos, grupos con pedidos individuales, transporte físico, bebidas, nuevas renovaciones ni expansión narrativa.

Orden pendiente: convivencia (3), restaurante (4), progresión y hogar (5), narrativa (7) y pulido final (8). Recomendación siguiente: puestos, retornos y descanso de Pip, Spicy y Rigg, aprovechando los controles y accesos ya disponibles.
