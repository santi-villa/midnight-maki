# Prompt de música para la cocina (Suno / Udio / similar)

Servir como **segunda opción** a la música generada por código. Pensada para sonar en bucle mientras se cocina.

## Prompt (copiar tal cual)
```
Cozy Japanese kitchen instrumental, light and playful, 96 BPM, major pentatonic with a hint of Miyako-bushi color,
plucked koto and shamisen melody, soft marimba and wood block percussion that sounds like a chef chopping vegetables,
warm walking upright bass, gentle brushed shaker, small bells on the turnarounds, an occasional glockenspiel sparkle.
Bright, tidy and focused but relaxed, like a tiny restaurant at lunchtime. Short 8-bar sections: A (melody on koto),
B (answering phrase on marimba), A again with light flute ornaments, then a bridge with a rhythmic wood block chop pattern.
No vocals, no drums kit, no synth leads, no heavy reverb, no cinematic build-ups. Ends cleanly so it can loop.
Cozy pixel-art game soundtrack, Stardew Valley meets Animal Crossing, 2 minutes.
```

## Variante para el modo difícil
```
Same melody and instruments as above but faster, 120 BPM, tighter wood block and shaker rhythm, a ticking clock-like
pizzicato on every beat, slightly higher energy, short rising fills every 8 bars. Still cheerful, never stressful.
```

## Negativos (si la herramienta los tiene)
`vocals, lyrics, electric guitar, dubstep, trap, orchestral hits, dark, horror, long intro, fade-out ending`

## Para que repita bien
- Pedir "seamless loop" o duración de 1:30–2:30 y recortar al compás exacto.
- Guardar como `kitchen.ogg` (o `cocina.ogg`) en `src/music/`. El juego lo toma por el nombre y entra con fundido. Para la variante difícil: `kitchen-hard.ogg`.
- Exportar en ogg/opus a unos 96 kbps (≈ 1,5 MB por tema) para no cargar de más el celular.
