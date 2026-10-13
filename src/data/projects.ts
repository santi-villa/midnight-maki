/**
 * Town and restaurant projects (the restoration board). Every project has two or three phases.
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
    ],
  },
  {
    id: 'plaza_lights', zone: 'plaza', name: 'Faroles de la plaza',
    intro: 'Cuando cae la noche algunos rincones de la plaza quedan a oscuras.',
    phases: [
      { name: 'Faroles de hierro', desc: 'Dos faroles nuevos junto a las veredas.', coins: 260, items: { stone: 3 }, level: 2, thanks: 'La plaza brilla un poco más al atardecer.' },
      { name: 'Linternas de piedra', desc: 'Linternas bajas entre el pasto.', coins: 340, items: { stone: 4 }, level: 3, thanks: 'Las linternas dibujan caminitos de luz.' },
    ],
  },
  {
    id: 'beach_corner', zone: 'beach', needs: 'unlock_beach', name: 'Rincón del muelle',
    intro: 'Nami sueña con un rincón de playa donde dejar el bote y colgar faroles.',
    phases: [
      { name: 'Bote amarrado', desc: 'Un bote de madera listo para salir.', coins: 200, items: { wood: 5 }, thanks: 'Nami lo bautizó "Sardina" y ya le habla.' },
      { name: 'Faroles del muelle', desc: 'Faroles rojos a lo largo del muelle.', coins: 320, items: { sh_scallop: 2 }, level: 3, thanks: 'Por la noche el mar se llena de reflejos rojos.' },
    ],
  },
  {
    id: 'forest_clearing', zone: 'forest', needs: 'unlock_forest', name: 'Claro del bosque',
    intro: 'Kiki quiere un lugar tranquilo entre los árboles para descansar.',
    phases: [
      { name: 'Banco y farol', desc: 'Un banco y un farol de papel en el sendero.', coins: 220, items: { wood: 4 }, thanks: 'Kiki ya se sentó a probarlo.' },
      { name: 'Flores del bosque', desc: 'Flores de campanilla y linternas de piedra.', coins: 300, items: { fl_bell: 3 }, level: 3, thanks: 'El claro huele a flores y a madera.' },
    ],
  },
  {
    id: 'garden_lanterns', zone: 'garden', needs: 'unlock_garden', name: 'Jardín de faroles',
    intro: 'El jardín de Momo luce mejor con luces suaves y unos cerezos más.',
    phases: [
      { name: 'Faroles de papel', desc: 'Faroles entre las parcelas.', coins: 240, items: { stone: 2 }, thanks: 'Las luces cuelgan como luciérnagas amables.' },
      { name: 'Cerezos nuevos', desc: 'Dos cerezos para que florezcan en primavera.', coins: 420, items: { fl_tulip: 3 }, level: 4, thanks: 'Momo asegura que ya pueden oír la primavera.' },
    ],
  },
];

export const PROJECTS_BY_ID: Record<string, ProjectDef> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

/** Props each finished phase adds to its zone: [propId, x, y]. */
export const PROJECT_PROPS: Record<string, [string, number, number][][]> = {
  plaza_garden: [
    [['flowers', 4, 9], ['flowers', 6, 9], ['flowers', 28, 9], ['flowers', 30, 9]],
    [['bench', 4, 17], ['bench', 24, 17]],
  ],
  plaza_lights: [
    [['lamppost', 8, 14], ['lamppost', 23, 14]],
    [['stonelantern', 6, 19], ['stonelantern', 24, 19]],
  ],
  beach_corner: [
    [['boat', 10, 14]],
    [['lantern_red', 17, 13], ['lantern_red', 22, 13]],
  ],
  forest_clearing: [
    [['bench', 10, 10], ['lantern_cream', 8, 10]],
    [['flowers_lav', 12, 11], ['stonelantern', 14, 10], ['stonelantern', 16, 10]],
  ],
  garden_lanterns: [
    [['lantern_cream', 4, 12], ['lantern_cream', 8, 12]],
    [['sakura', 3, 9], ['sakura', 18, 9]],
  ],
};
