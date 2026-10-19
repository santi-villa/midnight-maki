# Introducción: recursos optimizados (2026-10-19)

- Siete JPG reemplazados por WebP con la misma resolución: 16,63 MiB → 1,71 MiB. No cambian ilustraciones, texto ni orden.
- Cuatro ambientes largos convertidos en loops de 32 s, mono a 80 kbps, con cruce de 2 s entre final y comienzo: 35,75 MiB → 1,15 MiB. Los originales permanecen en `src/story/Sounds/` y en el historial Git.
- Se prefiere WebP con fallback JPG/PNG, y se precarga solo la siguiente imagen.
- Pruebas: `intro.test.ts` y `introAudio.test.ts`, 10 casos correctos. Playwright mostró la primera imagen optimizada y solicitó la segunda. Se inspeccionó la captura vertical. La verificación final incluye build y recorrido de inicio; no se ejecuta la suite completa.
- Guardados y música personalizada sin cambios. No se comprobó la mezcla en un celular físico.
