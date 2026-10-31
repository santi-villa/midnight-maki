# Boceto 02: plaza, parcelas y calles de Villa Nori

Esta propuesta ya fue llevada a la partida: ver [mapa jugable de Villa Nori](villa-nori-mapa.md).
Esta página conserva la referencia original y su alcance como boceto.

Vista de revisión del 30/10/2026, preparada con las baldosas, fachadas, naturaleza,
mobiliario y personajes reales del proyecto. Perspectiva superior y escala nativa
de 16 px por baldosa. La composición mide 104×80 baldosas (1664×1280 px).

## Abrir y revisar

Con Vite activo, abrir `/mapa-boceto.html`. En esta sesión:
<http://localhost:5174/mapa-boceto.html>.

La página permite acercarse a cada zona, ver el conjunto, ocultar nombres, alternar
día/noche y descargar la imagen. En celular, elegir una zona acerca el mapa y
devuelve la vista al panel. La iluminación nocturna es una aproximación visual
para revisar el ambiente, no la simulación completa del juego.

## Organización propuesta

| Zona | Ubicación / relación |
| --- | --- |
| Centro | Plaza compacta de piedra con fuente, flores y bancos; comercios en parcelas exteriores |
| Barrio residencial | Este del centro; conexiones con estación y ribera |
| Puerto | Costa sur; muelles de trabajo y faro en el extremo oriental |
| Playa | Suroeste; arena clara y un solo rincón de sombrilla |
| Bosque | Noroeste; sendero que baja al jardín |
| Jardín | Oeste del centro; huerta, flores y puente hacia la plaza |
| Mercado nocturno | Entre el restaurante, la playa y el puerto |
| Estación abandonada | Terraza noreste, con acceso desde el barrio |
| Ribera del río | Paseo oriental entre las casas y el puerto |
| Colina del santuario | Norte del centro, con escalinata y río al oeste |

El restaurante se propone en el borde sur del centro, frente al acceso al mercado,
con jardín, cerezos y patio de madera propios. Cada comercio tiene un pequeño
terreno y un acceso que parte de la posición real de su puerta hasta la calle.
El pavimento público termina en el borde de la plaza; ningún edificio se apoya
sobre ella. Los jardines, las calles y los setos separan los usos.

De las tres referencias se toman la plaza con fuente y edificios exteriores,
el restaurante con patio, los ríos curvos, las terrazas del santuario y la estación,
y la costa con playa en forma de bahía. El muelle queda al sur y el faro en una
pequeña isla accesible por pasarela. La playa conserva arena suave y pocos objetos.

Los recorridos forman circuitos: centro–jardín–playa–mercado–centro y
centro–barrio–ribera–puerto–mercado–centro.

## Alcance

Es una composición separada para valorar ubicación, escala, distancias y carácter
de las zonas. No se registra en `ZONES`, no modifica los mapas de las partidas y
no migra guardados. Las viviendas son una muestra para estudiar el barrio: las
identidades y la cantidad definitiva de casas se resolverían al implementar.
Colisiones, rutas de NPCs, accesos a interiores, desbloqueos y medidas finales
siguen pendientes de una implementación del mapa aprobado.

Archivos:

- `mapa-boceto.html`: interfaz de revisión.
- `src/previews/mapSketch.ts`: composición aislada con los renderizadores reales.
- `src/previews/mapSketchLayout.ts`: terreno, parcelas, puertas y recorridos propuestos.
- `src/assets/map-study/`: recorte de relieve de Serene Village para esta vista,
  con procedencia, licencia y cambios en `credits.json`.
- `scripts/build-map-study-assets.py`: reproduce ese recorte desde el pack local.
- `docs/mapa-boceto-dia.png` y `docs/mapa-boceto-noche.png`: imágenes completas.
- `docs/mapa-boceto-centro.png`: detalle del centro a escala más cercana al juego.
- `docs/mapa-boceto-interactivo.png` y `docs/mapa-boceto-movil.png`: revisión de la página.
- `docs/mapa-boceto-v1-dia.png` y `docs/mapa-boceto-v1-centro.png`: versión anterior para comparar.

Reproducir imágenes con Vite en el puerto 5174:

```
node scripts/capture-map-sketch.mjs
```

El capturador también revisa las once parcelas: no se superponen entre sí ni con
la plaza, cada fachada cabe dentro de su terreno y cada puerta tiene una conexión
continua de camino, piedra o puente hasta la plaza. Esta revisión geométrica no
simula las colisiones ni las rutas de NPCs de una partida.

Verificado con typecheck, render en Chromium sin errores y revisión visual de las
vistas de día, noche, acercamiento del centro y celular. No requiere alterar la
entrada de producción del juego.
