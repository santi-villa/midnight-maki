/**
 * Town and restaurant projects (the restoration board). Projects have two to four phases.
 * A finished phase sets the flag `proj_<id>_<n>`: props with that condition appear in the zone,
 * and each finished phase adds a little charm to the restaurant (better tips).
 */
export interface ProjectPhase {
  name: string;
  desc: string;
  coins: number;
  items?: Record<string, number>;
  /** Restaurant level needed */
  level?: number;
  thanks: string;
  activity?: { counter: string; goal: number; text: string; hint: string };
  benefit?: string;
}

export interface ProjectDef {
  id: string;
  zone: string;
  /** Flag that opens this area (the project is hidden until the player can walk there) */
  needs?: string;
  name: string;
  intro: string;
  phases: ProjectPhase[];
}

export const PROJECTS: ProjectDef[] = [
  {
    id: 'plaza_garden', zone: 'plaza', name: 'Plaza en flor',
    intro: 'Momo cree que la plaza se vería más alegre con canteros y lugares para sentarse.',
    phases: [
      { name: 'Canteros de flores', desc: 'Flores en los costados de la plaza.', coins: 150, items: { fl_daisy: 3 }, thanks: 'Momo plantó los canteros con un cuidado enorme.' },
      { name: 'Bancos nuevos', desc: 'Bancos de madera para charlar y descansar.', coins: 220, items: { wood: 4 }, level: 2, thanks: 'Ahora hay donde sentarse a mirar pasar la tarde.' },
      { name: 'Mesa compartida', desc: 'Un rincón de té junto al camino del jardín.', coins: 260, items: { wood: 3, ginger: 2 }, level: 3, activity: { counter: 'handCooked', goal: 4, text: 'Preparar 4 platos a mano', hint: 'Comenzá la colaboración y terminá el minijuego en pedidos o cocina libre.' }, benefit: 'Una pequeña provisión diaria de jengibre y un detalle para regalar.', thanks: 'La mesa compartida ya espera a los vecinos.' },
      { name: 'Tardes de juegos', desc: 'Juegos de mesa para compartir el rincón.', coins: 220, items: { wood: 2, fl_tulip: 2 }, level: 4, activity: { counter: 'gifts', goal: 3, text: 'Hacer 3 regalos', hint: 'Los regalos después de comenzar la colaboración cuentan, sin exigir vecinos distintos.' }, benefit: 'Juego de memoria con Pip disponible en la mesa, sin esperar al Mercado Nocturno.', thanks: 'La mesa ahora tiene juegos para las tardes tranquilas.' },
    ],
  },
  {
    id: 'plaza_lights', zone: 'plaza', name: 'Faroles de la plaza',
    intro: 'Cuando cae la noche algunos rincones de la plaza quedan a oscuras.',
    phases: [
      { name: 'Faroles de hierro', desc: 'Dos faroles nuevos junto a las veredas.', coins: 260, items: { stone: 3 }, level: 2, thanks: 'La plaza brilla un poco más al atardecer.' },
      { name: 'Linternas de piedra', desc: 'Linternas bajas entre el pasto.', coins: 340, items: { stone: 4 }, level: 3, thanks: 'Las linternas dibujan caminitos de luz.' },
      { name: 'Cajón de mantenimiento', desc: 'Materiales compartidos para cuidar el pueblo.', coins: 200, items: { wood: 3 }, level: 3, activity: { counter: 'gathered', goal: 6, text: 'Recolectar 6 objetos', hint: 'Juntá objetos del suelo después de comenzar la colaboración.' }, benefit: 'Una madera y una piedra por día para futuras mejoras.', thanks: 'El cajón de mantenimiento quedó listo para usar.' },
      { name: 'Taller abierto', desc: 'Un pequeño puesto para ordenar y preparar materiales.', coins: 240, items: { wood: 3, stone: 2 }, level: 4, activity: { counter: 'photos', goal: 2, text: 'Guardar 2 fotos del pueblo', hint: 'Usá la cámara y guardá las fotos en el álbum.' }, benefit: 'Minijuego de ordenar disponible en el puesto; comparte el límite diario del depósito.', thanks: 'Ya se puede trabajar un rato en el taller abierto.' },
    ],
  },
  {
    id: 'beach_corner', zone: 'beach', needs: 'unlock_beach', name: 'Rincón del muelle',
    intro: 'Nami sueña con un rincón de playa donde dejar el bote y colgar faroles.',
    phases: [
      { name: 'Bote amarrado', desc: 'Un bote de madera listo para salir.', coins: 200, items: { wood: 5 }, thanks: 'Nami lo bautizó "Sardina" y ya le habla.' },
      { name: 'Faroles del muelle', desc: 'Faroles rojos a lo largo del muelle.', coins: 320, items: { sh_scallop: 2 }, level: 3, thanks: 'Por la noche el mar se llena de reflejos rojos.' },
      { name: 'Cajón de los pescadores', desc: 'Una provisión pequeña junto a la playa.', coins: 200, items: { wood: 3 }, level: 3, activity: { counter: 'fishCaught', goal: 3, text: 'Pescar 3 peces', hint: 'Las capturas de playa o lago después de comenzar la colaboración cuentan.' }, benefit: 'Alga y jengibre una vez por día para volver a la cocina.', thanks: 'Los pescadores dejaron listo su cajón compartido.' },
      { name: 'Orilla cuidada', desc: 'Un banco y nuevos rincones donde recoger conchas.', coins: 260, items: { wood: 3, sh_spiral: 2 }, level: 4, activity: { counter: 'photos', goal: 2, text: 'Guardar 2 fotos', hint: 'Comenzá la colaboración antes de guardar las fotos.' }, benefit: 'Dos puntos adicionales de conchas, disponibles una vez por día.', thanks: 'La orilla tiene nuevos rincones para explorar.' },
    ],
  },
  {
    id: 'forest_clearing', zone: 'forest', needs: 'unlock_forest', name: 'Claro del bosque',
    intro: 'Kiki quiere un lugar tranquilo entre los árboles para descansar.',
    phases: [
      { name: 'Banco y farol', desc: 'Un banco y un farol de papel en el sendero.', coins: 220, items: { wood: 4 }, thanks: 'Kiki ya se sentó a probarlo.' },
      { name: 'Flores del bosque', desc: 'Flores de campanilla y linternas de piedra.', coins: 300, items: { fl_bell: 3 }, level: 3, thanks: 'El claro huele a flores y a madera.' },
      { name: 'Mesa del claro', desc: 'Un tablero de juegos cerca del banco.', coins: 200, items: { wood: 3, berry: 2 }, level: 3, activity: { counter: 'bugsCaught', goal: 3, text: 'Atrapar 3 bichos', hint: 'Usá la red después de comenzar la colaboración. No hace falta entregarlos.' }, benefit: 'Juego de memoria con Rigg disponible en el claro.', thanks: 'El tablero de juegos quedó preparado bajo los árboles.' },
      { name: 'Sendero de recolección', desc: 'Pequeños rincones de bayas y flores alrededor del claro.', coins: 240, items: { stone: 2, fl_daisy: 2 }, level: 4, activity: { counter: 'memoryGames', goal: 2, text: 'Terminar 2 partidas de memoria', hint: 'Jugá en la mesa del claro o el mercado. Cuenta terminar, aunque no ganes.' }, benefit: 'Dos puntos adicionales de bayas, madera y flores, una vez por día.', thanks: 'El claro ofrece nuevas cosas para encontrar.' },
    ],
  },
  {
    id: 'garden_lanterns', zone: 'garden', needs: 'unlock_garden', name: 'Jardín de faroles',
    intro: 'El jardín de Momo luce mejor con luces suaves y unos cerezos más.',
    phases: [
      { name: 'Faroles de papel', desc: 'Faroles entre las parcelas.', coins: 240, items: { stone: 2 }, thanks: 'Las luces cuelgan como luciérnagas amables.' },
      { name: 'Cerezos nuevos', desc: 'Dos cerezos para que florezcan en primavera.', coins: 420, items: { fl_tulip: 3 }, level: 4, thanks: 'Momo asegura que ya pueden oír la primavera.' },
      { name: 'Banco de semillas', desc: 'Semillas compartidas para mantener el jardín en marcha.', coins: 200, items: { wood: 3, stone: 2 }, level: 4, activity: { counter: 'plotsWatered', goal: 4, text: 'Regar 4 parcelas', hint: 'Regá parcelas plantadas después de comenzar la colaboración. Regar dos veces el mismo día no duplica el progreso.' }, benefit: 'Una semilla de flores y una de pepino por día.', thanks: 'El banco de semillas quedó junto a las macetas.' },
      { name: 'Bancales nuevos', desc: 'Dos parcelas más en un rincón libre del jardín.', coins: 360, items: { wood: 4, stone: 2 }, level: 5, activity: { counter: 'harvests', goal: 4, text: 'Cosechar 4 parcelas', hint: 'Cosechá después de comenzar la colaboración; tus cultivos actuales se conservan.' }, benefit: 'El jardín pasa de seis a ocho parcelas, sin cambiar el crecimiento de las plantas.', thanks: 'Ya se puede plantar en los dos bancales nuevos.' },
    ],
  },
  {
    id: 'library_corner', zone: 'library', name: 'Rincón de lectura',
    intro: 'Un pequeño espacio para cuidar libros y compartir lecturas con Kumo.',
    phases: [
      { name: 'Carrito de libros', desc: 'Un carrito y un rincón más cuidado para los libros.', coins: 180, items: { wood: 3 }, level: 2, activity: { counter: 'photos', goal: 2, text: 'Guardar 2 fotos', hint: 'Comenzá la colaboración y usá la cámara del menú.' }, benefit: 'Mejora visible en la biblioteca y encanto para el restaurante.', thanks: 'El carrito de libros ya está en su lugar.' },
      { name: 'Club de lectura', desc: 'Un rincón de lectura compartida, con una maceta nueva.', coins: 220, items: { wood: 2, g_candy: 1 }, level: 3, activity: { counter: 'libraryReads', goal: 2, text: 'Leer 2 veces en la biblioteca', hint: 'Leé mientras la biblioteca atiende, de 08:00 a 23:00.' }, benefit: 'Leer suma 3 puntos de amistad con Kumo una vez por día; se respetan los horarios.', thanks: 'El club de lectura está listo para recibir visitas.' },
    ],
  },
];

export const PROJECTS_BY_ID: Record<string, ProjectDef> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

/** Props each finished phase adds to its zone: [propId, x, y]. */
export const PROJECT_PROPS: Record<string, [string, number, number, number?][][]> = {
  plaza_garden: [
    [['flowers', 4, 9], ['flowers', 6, 9], ['flowers', 28, 9], ['flowers', 30, 9]],
    [['bench', 6, 10], ['bench', 32, 17]],
    [['project_teatable', 27, 9, 4]],
    [['project_teagames', 27, 9]],
  ],
  plaza_lights: [
    [['street_lamp_l', 8, 14], ['street_lamp_r', 23, 14]],
    [['stonelantern', 6, 19], ['stonelantern', 24, 19]],
    [['crate', 24, 10, 4]],
    [['project_workbox', 24, 10]],
  ],
  beach_corner: [
    [['boat', 10, 14]],
    [['lantern_red', 17, 13], ['lantern_red', 22, 13]],
    [['sack', 17, 9]],
    [['bench', 12, 13], ['flowers', 14, 8]],
  ],
  forest_clearing: [
    [['bench', 10, 10], ['lantern_cream', 8, 10]],
    [['flowers_lav', 12, 11], ['stonelantern', 14, 10], ['stonelantern', 16, 10]],
    [['project_gametable', 11, 9]],
    [['flowers_lav', 11, 7], ['flowers', 15, 8]],
  ],
  garden_lanterns: [
    [['lantern_cream', 4, 12], ['lantern_cream', 8, 12]],
    [['sakura', 3, 9], ['sakura', 18, 9]],
    [['crate', 7, 8]],
    [['flowers', 2, 7], ['flowers_lav', 5, 8]],
  ],
  library_corner: [[['project_bookcart', 2, 5]], [['pot_rose', 4, 7]]],
};

export interface ProjectAmenity {
  id: string; project: string; phase: number; zone: string; x: number; y: number; title: string;
  items?: Record<string, number>; game?: 'memory' | 'sort'; gamePhase?: number; opponent?: string;
}
export const PROJECT_AMENITIES: ProjectAmenity[] = [
  { id: 'tea_table', project: 'plaza_garden', phase: 3, zone: 'plaza', x: 28, y: 10, title: 'Mesa compartida', items: { ginger: 2, g_candy: 1 }, game: 'memory', gamePhase: 4, opponent: 'pip' },
  { id: 'workshop', project: 'plaza_lights', phase: 3, zone: 'plaza', x: 24, y: 11, title: 'Puesto de mantenimiento', items: { wood: 1, stone: 1 }, game: 'sort', gamePhase: 4 },
  { id: 'fisher_box', project: 'beach_corner', phase: 3, zone: 'beach', x: 17, y: 10, title: 'Cajón de los pescadores', items: { nori: 2, ginger: 1 } },
  { id: 'forest_games', project: 'forest_clearing', phase: 3, zone: 'forest', x: 12, y: 10, title: 'Mesa del claro', game: 'memory', opponent: 'rigg' },
  { id: 'seed_bank', project: 'garden_lanterns', phase: 3, zone: 'garden', x: 7, y: 9, title: 'Banco de semillas', items: { sd_flower: 1, sd_cucumber: 1 } },
];
export const PROJECT_GATHER = [
  { project: 'beach_corner', phase: 4, zone: 'beach', x: 14, y: 8, pool: ['sh_scallop', 'sh_spiral'] },
  { project: 'beach_corner', phase: 4, zone: 'beach', x: 18, y: 10, pool: ['sh_scallop', 'sh_blue'] },
  { project: 'forest_clearing', phase: 4, zone: 'forest', x: 11, y: 7, pool: ['wood', 'berry'] },
  { project: 'forest_clearing', phase: 4, zone: 'forest', x: 15, y: 8, pool: ['fl_bell', 'berry'] },
];
