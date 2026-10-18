# Etapa 2 — Lluvia y sonido

Entrega sobre `master-mgsshv`, después de la etapa 1. No cambia iluminación, estaciones, horarios, historia, economía ni partidas guardadas.

## Cambios y decisiones

- Gotas con velocidades e inclinaciones variables, dos capas cerca de la cámara y niebla tenue. Emisores y pequeños grupos reutilizables de imágenes limitan el costo; no se dibuja lluvia sobre toda la extensión del mapa.
- Impactos de lluvia limitados a tiles de suelo transitables. Se excluyen agua, paredes, vacío y objetos sólidos. Los anillos se expanden y desvanecen. Los efectos de lluvia sobre el agua siguen perteneciendo al sistema de agua existente.
- Charcos pixel art en suelo que puede retener agua. Arena y puentes reciben impactos, pero no acumulan charcos. Los antiguos props de charcos exteriores se reemplazan visualmente por este sistema, sin tocar las colisiones.
- La humedad tarda unos 83 segundos reales de lluvia en llegar al máximo y unos 250 segundos en secarse desde ese máximo. Se conserva entre las zonas exteriores visitadas durante la sesión, incluso al entrar a un edificio. Es ambientación transitoria: no se serializa ni afecta cultivos o recursos. Las zonas aún no visitadas empiezan secas. El modo de pocos efectos conserva charcos sin gotas, niebla ni anillos animados.
- Lluvia exterior con pasa-bajos a 1200 Hz y una segunda capa grave más lenta. Interior con filtro a 420 Hz, volumen inferior y gotas aisladas contra una ventana. Entrar/salir modifica las mismas dos fuentes con un fundido de 550 ms; no reinicia ni superpone bucles. Al detener el ambiente, las fuentes se detienen y desconectan. Se conserva el control de volumen Ambiente y el desbloqueo por gesto del navegador.
- Pasos del jugador, NPC, vecinos, personal, clientes y compañero online según la superficie real y el desplazamiento. Los actores cercanos se oyen menos con la distancia; los lejanos no suenan. Se ignoran teletransportes, reposo y pausas. El gato caminante y los aterrizajes de los gatos del atlas tienen sonido suave. No se hacen sonar perros dormidos ni mascotas inmóviles; sus recorridos siguen pendientes de la etapa 3.
- Variante de pasos mojados durante la lluvia y mientras queda humedad suficiente. Se conservan tonos graves, bajando también el componente agudo del paso sobre piedra/pasto.

El sonido de playa de la etapa 0 queda pendiente: esta entrega conserva su mezcla y modulación, pero corrige la liberación de su oscilador al cambiar de ambiente.

## Archivos

- `src/scenes/rainmath.ts`: superficies válidas y humedad por zona, sin Phaser ni guardados.
- `src/scenes/rainFx.ts`: gotas, niebla, charcos e impactos.
- `src/scenes/WorldScene.ts`: integración de clima, audio y pasos.
- `src/scenes/pets.ts`: aviso del aterrizaje de gatos.
- `src/audio/audio.ts`: mezcla/fundido de lluvia, gotas interiores, limpieza y volumen por paso.
- `src/audio/footsteps.ts`: superficies, distancia y cadencia compartidas.
- `src/tests/rain.test.ts`, `e2e/rain.spec.ts`: regresiones puntuales.
- `docs/art/lluvia/etapa-2/`, `docs/audio/etapa-2/`: capturas y muestras de audio generadas en navegador.

## Verificación

- Pruebas unitarias puntuales: `npx vitest run src/tests/rain.test.ts src/tests/water.test.ts` — 12 aprobadas.
- `npx tsc --noEmit`: aprobado.
- `CHROME=/usr/bin/chromium npx playwright test e2e/rain.spec.ts --workers=1`: 2 casos aprobados. Comprueban superficies válidas, gotas de distintas velocidades, crecimiento/secado y retención al cruzar puertas, la misma capa de oscuridad sin redibujos durante lluvia con reloj detenido, audio y pasos reales.
- Capturas inspeccionadas en Chromium headless a 1280×800, `/?debug`, `perf: 'high'`: plaza de tarde y noche con lluvia, jardín, interior del restaurante, exterior después de llover y seco. El crecimiento/secado largo se acelera llamando al mismo modelo visual que usa el juego; no se esperaron varios minutos por captura.
- Señales renderizadas por `OfflineAudioContext` usando los métodos reales del motor. Las muestras WAV quedan en `docs/audio/etapa-2/`. RMS aproximado: exterior 0,05362; interior 0,01359 (25 % del exterior). La medida de contenido agudo baja de 0,0743 a 0,0435. Pasos mojados y gotas contra ventana producen señales finitas sin saturación.
- El cambio exterior/interior conserva exactamente las mismas dos fuentes. El filtro llega a 420 Hz y el volumen a 0,065 dentro; al salir vuelve a 0,25. Al detener el ambiente se desconectan todos los nodos del bucle y se cancela el temporizador de gotas.
- Verificados desplazamiento del jugador con teclado sobre suelo mojado, caminata de Spicy con volumen atenuado sobre madera, aterrizaje del gato mediante su animación real y silencio de Ambiente/Efectos tras su fundido. Sin errores de página en ambos casos finales.
- La prueba atraviesa la escena narrativa existente del Día de la Lluvia con sus diálogos y elección, antes de comprobar los controles: no la elimina ni altera sus condiciones.

No se ejecuta la suite completa. No se probó en un teléfono físico ni se afirma una evaluación auditiva en sus parlantes.

## Cómo probar

En `/?debug`, con `perf: 'high'` en `mm_settings`, explorar plaza y jardín bajo lluvia durante un minuto. Entrar al restaurante y volver a salir: el audio debe amortiguarse dentro, los charcos exteriores deben mantenerse y los pasos interiores deben ser de madera. Al despejarse, los charcos se reducen gradualmente. Acercarse a vecinos que caminan y a un gato que salta; abrir un menú para comprobar que no siguen sonando pasos de actores detenidos. Ajustar Ambiente/Efectos a cero debe silenciar sus respectivas salidas.
