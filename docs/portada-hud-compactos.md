# Portada y HUD compactos (2026-10-19)

- Placas de portada vertical/horizontal sin texto incrustado; logo HTML independiente y menú inferior. Se mantienen restaurante, puente y los tres mapaches; los WebP resultantes son más pequeños que antes.
- Título visible unificado a Maki & Mapaches en web, carga, PWA y etiqueta Android. Restaurante, claves, paquetes y guardados no se renombran.
- Menú oculto inicialmente también para teclado (`inert`); atajos y Continuar conservados. Se libera la suscripción de ajustes al cerrar la portada.
- Misión móvil compacta por defecto (dos líneas del objetivo); se respeta una preferencia explícita previa y se puede expandir. NoriPhone cerrado usa un botón de 48 px de alto; la personalización y los gestos del teléfono abierto siguen disponibles.
- Selección de nueva partida ajustada al contenido. No se alteró el comportamiento de sobrescritura/importación.
- Se renueva la caché PWA para recibir los recursos reemplazados.
- Verificado: typecheck, dos E2E existentes de portada (apertura/audio y botones dentro de pantalla en ambas orientaciones). Capturas PC/vertical inspeccionadas. Recorrido de nueva partida hasta restaurante, sin errores JS capturados; el chequeo integrado de teléfono/ajustes se completa en la siguiente entrega.
- No se compiló APK ni se probó teléfono físico.
