# Restauración del skin privado de UI

Los PNG de Sprout Lands no se borraron. La pantalla inicial (`#boot`) carecía de integración con los marcos privados. Además, selectores como `body .start-load-card` de unify.css prevalecían sobre `.start-load-card` del skin privado.

La integración pública `src/ui/packSkin.ts` resuelve las imágenes procesadas a través de packUrl y activa reglas con prioridad explícita. Carga inicial, transición de carga, paneles, pausa, botones y diálogos comparten los marcos reales. No se copian PNG licenciados al repositorio público. Sin los cinco archivos requeridos conserva el respaldo anterior.

Comprobación: capturas Chromium 1366×768 y 412×915, sin errores de página; panel de Opciones con borderImageSource apuntando a sl_panel.png y radio cero. La captura de carga retrasa una petición de imagen únicamente en el script de revisión, sin cambiar el tiempo de carga del juego. Typecheck aprobado. No se probó un celular físico.
