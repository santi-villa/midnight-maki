# Arranque, renderizado y verificación final (2026-10-19)

## Cambios

- Nueva partida: la preparación de sprites exteriores ocurre durante la intro, una hoja por cuadro. Antes de revelar el restaurante se espera su finalización, también si se salta la intro. Las promesas tienen manejo inmediato de rechazo y el flujo existente recupera el título si hay un error. Continuar conserva su preparación previa.
- Transparencias: solo se comparan actores contra objetos en cámara o en un margen de 32 píxeles. Se conserva la simulación de NPC, colisiones y horarios. En el escenario observado, 37 de 257 objetos requieren esa comparación. No se eliminan objetos del mundo.
- Se detectó un desfase al rotar: el contenedor podía medir 1280×720 y Phaser mantener canvas/escala en 390×844. Se observa el contenedor mediante ResizeObserver y se reconcilia la escala una vez por cuadro solo si difiere. La cámara se dimensiona antes de calcular zoom y límites. El observador se libera al destruir el juego.
- Ambientes de intro: exportación reproducible con `node scripts/optimize-intro-audio.mjs`, herramienta opcional con FFmpeg/FFprobe. Decodifica segmentos independientes y cruza final/inicio; valida que los cuatro MP3 duren 32,026 s. Originales conservados. El primer grafo compartido no había incluido el cruce: se corrigió antes de finalizar esta entrega.
- Nombre visible también unificado en la carga entre pantallas, BootScene y appName de Capacitor. Identificadores técnicos intactos.
- Caché PWA v4: permite recibir las exportaciones finales con las mismas URLs públicas. La portada se verificó offline después de instalar su caché.

## Resultado medible

Distribución: **70,62 → 21,03 MiB**, aproximadamente 70 % menos. No significa que se descargara toda la distribución antes al abrir.

Siete ilustraciones: **16,63 → 1,71 MiB**. Cuatro ambientes: **35,75 → 1,22 MiB**. Portadas nuevas: unos 140/134 KiB, con texto HTML independiente. No se cambia la resolución de las ilustraciones de historia.

En producción se verificó la solicitud de solo las imágenes 1 y 2 durante la primera escena; la lluvia permaneció activa y en loop al cruzar el final del archivo. La prueba de oscuridad quieta mantuvo cero redibujos. Estas mediciones no equivalen a FPS ni consumo de batería de un celular físico.

## Pruebas ejecutadas, solo relacionadas

- `npx vitest run src/tests/intro.test.ts src/tests/introAudio.test.ts`: 10 casos correctos.
- `npx vitest run src/tests/phoneHome.test.ts`: 3 casos correctos.
- E2E de portada seleccionados: apertura/audio y dimensiones táctiles en ambas orientaciones, 2 correctos.
- E2E `ui-polish.spec.ts`: categorías/persistencia de ajustes y misión/teléfono/guardado/continuación, 2 correctos. Se amplió y repitió únicamente el segundo tras corregir el redimensionado, comprobando también dimensiones reales del canvas.
- E2E de BootScene: 4 correctos, incluyen carga bloqueada y portada ausente.
- E2E de intro musical seleccionado: las siete imágenes, carta, loop y transición al restaurante, correcto.
- E2E de iluminación seleccionado: halos animados sin redibujos de oscuridad quieta, correcto.
- `npm run build` correcto; incluye `tsc --noEmit`. `git diff --check` correcto.
- Recorrido adicional sobre producción con Playwright y `perf: high`: portada/menú en 320×740, 390×844, 844×390 y 1280×720; partidas, opciones, intro, llegada, HUD, teléfono, copias y plaza nocturna. Capturas inspeccionadas. Sin errores JavaScript capturados.
- PWA: caché v4 activa y portada/menú accesibles sin conexión después de la primera visita.

No se ejecutó la suite completa. No se probó teléfono físico, APK, multijugador ni mezcla por escucha en distintos parlantes. No hay migraciones: no se añaden campos de guardado.

## Archivos principales

Recursos en `public/intro/`, `public/audio/intro/`, `public/title/`; `src/story/intro.ts`; `src/core/flow.ts`; `src/main.ts`; `src/scenes/WorldScene.ts`; `src/scenes/BootScene.ts`; `src/ui/title.ts` y `title.css`; `src/ui/hud.ts` y `hud.css`; `src/ui/phone/phone.ts`, `phone.css` y `appIcons.ts`; `src/ui/settingsPanel.ts` y `settingsPanel.css`; `src/ui/saves.ts`; `src/ui/dom.ts`; metadatos web/PWA/Android/Capacitor, pruebas E2E relacionadas y herramienta de exportación de audio.

## Próximas optimizaciones posibles

Queda medir en teléfonos representativos antes de intervenir calidad automática, autenticación diferida o agrupación de capas estáticas de la plaza. No se cambian esos sistemas sin evidencias de su beneficio y de sus efectos en nube, iluminación y simulación. La reducción actual de tamaño no implica prometer una tasa de cuadros determinada.
