# Etapa 0 — Pesca, sombras y ambientes

- Pesca: ganancia 0,55 con caña básica y en el fallback sin equipo, 0,8 con mejorada y 1,05 con avanzada. El juego actual exige comprar una caña para pescar: se conserva esa regla, precios, materiales y guardados. El llenado base pasa de 0,30 a 0,165 por segundo mientras el pez está en la zona; se mantienen drenaje, anzuelada y burbujas.
- Se agrega `PropDef.sombra?`: `contacto`, `proyectada` o `ninguna`, con proyección como valor predeterminado. Faroles de piedra, de calle pequeños y andon tienen contacto de 6×2 px en la base; las linternas colgantes no generan sombra. Se corrige la causa: proyectar su sprite completo generaba una silueta que parecía suspendida. Sin tocar halos ni el caché de oscuridad.
- Lluvia: ya implementada en etapa 2; se conserva volumen 0,25, pasa-bajos a 1200 Hz y segunda capa más lenta/grave (180 Hz). Interior conserva 0,065 y 420 Hz. Verificada otra vez mediante señal renderizada.
- Playa: mezcla más baja (0,09 frente a 0,14), con oleaje grave constante y espuma filtrada a 900 Hz. Una envolvente de 47 segundos con intervalos aleatorios suavizados sustituye la senoide fija de unos ocho segundos. Usa un búfer de control de unos 6 KB; no genera objetos por cuadro.
- Gaviotas distantes entre 35 y 90 segundos, solo de día. El temporizador se cancela al anochecer, salir o cambiar a lluvia. El mar sigue sonando de noche con las mismas fuentes, sin reiniciarse al cambiar de período. Todas las capas respetan el volumen de ambientes y el silencio.

## Verificación acotada

- `npx vitest run src/tests/stage6.test.ts -t 'fishing rods'`: 3 aprobados, 3 ajenos omitidos por el filtro.
- `npx tsc --noEmit`: aprobado.
- `e2e/stage-zero.spec.ts`: dos casos aprobados. Se corrigió un error de la propia prueba que buscaba el botón «Lanzar» después de que ya había cambiado su texto; se repitió solamente ese caso.
- Chromium headless a 1280×800, `/?debug`, `window.mmDebug`, `perf: 'high'`. Capturas inspeccionadas de tarde/noche en jardín y playa, más el minijuego de pesca, en `docs/art/etapa-0/`.
- Web Audio OfflineAudioContext: render real de mar/lluvia/interior, señal no nula, sin saturación, mar más bajo que lluvia, interior más bajo y amortiguado. Comprobados dos ruidos más control irregular, continuidad día/noche y cancelación de gaviotas. WAV en `docs/audio/etapa-0/`; sin evaluación auditiva en un celular físico.
- Sin suite completa, dependencias nuevas ni campos obligatorios en la partida.

Archivos: `src/systems/rods.ts`, `src/data/props.ts`, `src/scenes/WorldScene.ts`, `src/audio/audio.ts`, prueba de cañas en `src/tests/stage6.test.ts`, prueba de navegador y evidencias citadas arriba.
