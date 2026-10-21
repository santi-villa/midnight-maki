# Tamaño de interfaz y revisión de novedades — 21/10/2026

Base revisada: `69f527c` de `master-mgsshv` (28 commits desde la revisión local anterior).

## Cambio

- Ajustes → Comodidad → Tamaño de la interfaz: barra de 70 % a 100 %, en pasos de 5 %, con porcentaje y Restablecer tamaño.
- La vista cambia al mover la barra y la preferencia se guarda por dispositivo en `mm_settings`. `uiScale` es opcional; ausente o inválido conserva 100 %. No se modifica el formato de las partidas ni se sincroniza esta preferencia con otros jugadores.
- El tamaño de texto sigue siendo independiente. Se reduce la capa HTML de HUD, menús, diálogos, teléfono y controles de cocina; Phaser conserva su tamaño y sus coordenadas.
- La portada y las ilustraciones de la introducción conservan su encuadre. El menú de la portada sí se adapta. Los márgenes de área segura mantienen su tamaño físico.
- Se compensan las coordenadas del joystick, el teléfono cerrado/abierto y los pedidos bajo los botones del HUD. El teléfono solo recalcula su diseño cuando cambia la escala, no ante cada cambio de volumen.
- Se usa `zoom` de CSS para conservar anclajes y desplazamiento de los paneles. No se agrega trabajo por cuadro para aplicar la preferencia.

## Verificación acotada

- `npx vitest run src/tests/uiScale.test.ts`: 2 pruebas de valores anteriores/inválidos y límites.
- `npx tsc --noEmit` y build de producción.
- `e2e/ui-scale.spec.ts`: una prueba de navegador específica. Ajuste desde el control, persistencia en un documento nuevo, restablecimiento, medidas del mundo sin cambios, HUD reducido, pedidos alineados, teléfono accesible/centrado, joystick y heladera.
- Resoluciones de navegador: 390×844, 320×640, 412×915, 844×390 y 1366×768. Capturas con `/?debug`, `perf: high`, inspeccionadas fuera del repositorio. No equivale a probar un teléfono físico ni Safari/WebKit.
- El build advierte un `case 'bell'` duplicado preexistente en `src/audio/audio.ts`; también informa imports compartidos entre cargas estáticas y dinámicas. No se modificó audio en esta entrega.

## Qué mejoraría ahora

1. **Personal y cocina física:** aún se pueden contratar cocineros, pero la tarea clásica de cocinar está condicionada a `!galleyOn()`. Adaptar esa contratación al sistema de estaciones antes de cobrar por un beneficio que no actúa en este modo; conservar empleados anteriores.
2. **Requisitos y utilidad de mejoras:** ya se corrigieron los textos del primer cuchillo y la esterilla. Todavía conviene revisar la zona de acierto del segundo cuchillo, el bajo ahorro absoluto del armado, los requisitos de personal del timbre y la utilidad temprana de la segunda tabla. No se midió una jornada económica completa.
3. **Onboarding de la cocina:** consolidar la enseñanza de ingredientes, manos ocupadas, arroz y entrega; las estaciones físicas y los pedidos plegables ya son una base más coherente que múltiples entradas a minijuegos.
4. **Medir antes de optimizar más:** `showTickets()` ya evita reconstruir contenido cuando no cambia, pero todavía lee medidas del HUD cada cuadro. Conviene invalidar esa posición por tamaño/configuración/layout y perfilar el servicio con varias mesas antes de ampliar sistemas.
5. **Identidad:** el logo nuevo dice “Mapaches y Sushi”, mientras parte de metadatos/textos conserva “Maki & Mapaches”. Unificar cuando ese nombre esté decidido, conservando Midnight Maki como restaurante y los identificadores de guardado.

La portada con video, el estilo crema compartido, la pausa reducida, el HUD compacto, la cocina física con Spicy y las correcciones de caminos/mercado ya forman parte de la base recibida. Esta entrega no rehace esos cambios ni certifica todo su comportamiento.
