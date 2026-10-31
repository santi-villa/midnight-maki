# Villa Nori: mapa jugable aprobado

El mapa del boceto 02 ya se usa en las partidas. La planta mide 120×80 baldosas:
se amplía el barrio hacia el este para conservar las dieciséis casas existentes.
La plaza, la playa, el restaurante, los ríos, el santuario, la estación y el puerto
mantienen la disposición aprobada.

## Distribución y caminos

- Centro: plaza de piedra con fuente, bancos y canteros; fachadas completas fuera
  del espacio público, con jardín, umbral y camino propios.
- Barrio al este: once viviendas en parcelas, calles de dos/tres baldosas y una
  pasarela de ribera que baja al puerto.
- Bosque al noroeste; jardín al oeste; playa clara y despejada al suroeste.
- Santuario al norte, sobre una terraza con escalinata; estación al noreste.
- Mercado y muelles al sur; otras tres casas en el frente de agua y dos en el jardín.
- Faro en una pequeña isla al sureste, conectado por pasarela.

Las nueve zonas exteriores comparten coordenadas de mundo, sin superposiciones ni
huecos. Los cruces están sobre los caminos reales; la llegada queda una baldosa
dentro del distrito para evitar volver automáticamente por la misma puerta.
Los caminos principales, los puentes y todos los umbrales se verifican con las
colisiones del juego, incluso en las cuatro etapas de restauración.

El paseo del mercado se abre con la playa/puerto y puede cruzarse de día. Sus
tiendas, juegos y primera escena nocturna siguen sujetos a `market_open`.
Bosque, jardín, estación, costa e interior del faro conservan sus desbloqueos.

## Sistemas y partidas

Las direcciones de las casas conservan sus IDs históricos aunque cambien de zona.
Se actualizan sus puertas de ida/vuelta, los carteles comerciales, los puntos de
recolección, pesca y cultivo, los proyectos y sus actividades. Las misiones resuelven
sus destinos por objeto o edificio, en vez de apuntar a las coordenadas antiguas.
Las rutinas y los clientes usan el nuevo grafo de caminos y respetan los bloqueos.

Al continuar una partida anterior, `world/villageMigration.ts` cambia una sola vez
la posición exterior a un acceso seguro del nuevo distrito. Conserva nombre,
monedas, inventario, misiones, cultivos, interiores y decoración. Los guardados
que ya tienen `village_layout: 2` conservan su posición habitual.

## Archivos y revisión

- `src/data/villageGeography.ts`: dimensiones, distritos y nuevas direcciones.
- `src/data/villageTerrain.ts`: base del boceto aprobado, compartida con la vista previa.
- `src/data/villageWorld.ts`: caminos definitivos, parcelas, colisiones y actividades.
- `docs/villa-nori-mapa-jugable.png`: composición de las nueve zonas registradas,
  con las mismas baldosas y props del juego.
- `docs/villa-nori-plaza.png`, `villa-nori-residential.png`, `villa-nori-harbor.png`,
  `villa-nori-garden.png`, `villa-nori-beach.png`: capturas reales de la partida.
- `docs/villa-nori-noche.png`, `villa-nori-movil.png`: revisión nocturna y en celular.

Reproducir con el servidor de Vite activo en 5174 (o definir `VILLAGE_TEST_URL`):

```
node scripts/capture-village-world.mjs
npx playwright test e2e/village-map.spec.ts
npm test
npm run build
```

El boceto anterior sigue en `mapa-boceto.html` como referencia de diseño. La partida
usa las zonas registradas en `ZONES`, con todas sus funciones habituales.
