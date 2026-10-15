import type { IconSpec } from '../art/icons';

export type CookStep =
  | { t: 'nori' }
  | { t: 'rice' }
  | { t: 'place'; items: string[] }
  | { t: 'slice'; item: string; cuts: number }
  | { t: 'roll' }
  | { t: 'cut'; pieces: number }
  | { t: 'shape'; count: number }
  | { t: 'top'; item: string }
  | { t: 'wrap' }
  | { t: 'cone' }
  | { t: 'garnish'; items: string[] }
  /** goes to the griddle/pan station: the dish waits here for a piece cooked to taste */
  | { t: 'cook'; item: string; how: 'plancha' | 'sarten' }
  | { t: 'plate' };

export type RecipeCat = 'basic' | 'intermediate' | 'special';

export interface RecipeDef {
  id: string;
  name: string;
  desc: string;
  cat: RecipeCat;
  difficulty: 1 | 2 | 3 | 4 | 5;
  ingredients: Record<string, number>;
  steps: CookStep[];
  price: number;
  xp: number;
  unlock: { level?: number; flag?: string; text: string };
  icon: IconSpec;
  /** optional extra ingredient that adds a bonus and a variant name */
  variants?: { item: string; name: string; bonus: number }[];
  spicy?: boolean;
}

// form helpers -------------------------------------------------------------
const maki = (fill: string[], garnish: string[] = []): CookStep[] => [
  { t: 'nori' }, { t: 'rice' }, { t: 'place', items: fill }, { t: 'roll' }, { t: 'cut', pieces: 6 },
  ...(garnish.length ? [{ t: 'garnish', items: garnish } as CookStep] : []), { t: 'plate' },
];
const uramaki = (fill: string[], top: string[]): CookStep[] => [
  { t: 'nori' }, { t: 'rice' }, { t: 'place', items: fill }, { t: 'roll' }, { t: 'garnish', items: top }, { t: 'cut', pieces: 8 }, { t: 'plate' },
];
const nigiri = (fish: string, garnish: string[] = []): CookStep[] => [
  { t: 'slice', item: fish, cuts: 3 }, { t: 'shape', count: 2 }, { t: 'top', item: fish },
  ...(garnish.length ? [{ t: 'garnish', items: garnish } as CookStep] : []), { t: 'plate' },
];

/** puts a cooking step right before the first step of kind `before`, so earlier steps can run while it cooks */
const withCook = (steps: CookStep[], cookStep: CookStep, before: CookStep['t']): CookStep[] => {
  const i = steps.findIndex((x) => x.t === before);
  return [...steps.slice(0, i), cookStep, ...steps.slice(i)];
};

const R = (r: RecipeDef) => r;

export const RECIPES: RecipeDef[] = [
  // ------------------------------------------------------------- basic
  R({
    id: 'kappa', name: 'Kappa maki', cat: 'basic', difficulty: 1,
    desc: 'Rollito fino de pepino. El primer paso de toda cocinera.',
    ingredients: { rice: 1, nori: 1, cucumber: 1 }, steps: maki(['cucumber']), price: 16, xp: 8,
    unlock: { text: 'Inicial' }, icon: { type: 'maki', c1: '#6f9e5a' },
    variants: [{ item: 'sesame', name: 'con sésamo', bonus: 4 }],
  }),
  R({
    id: 'sake_maki', name: 'Sake maki', cat: 'basic', difficulty: 1,
    desc: 'Rollito de salmón, simple y querido.',
    ingredients: { rice: 1, nori: 1, salmon: 1 }, steps: maki(['salmon']), price: 20, xp: 9,
    unlock: { text: 'Inicial' }, icon: { type: 'maki', c1: '#ef9a78' },
  }),
  R({
    id: 'tamago', name: 'Tamago nigiri', cat: 'basic', difficulty: 1,
    desc: 'Omelette dulce sobre arroz, con su cinturón de alga.',
    ingredients: { rice: 1, egg: 1, nori: 1 },
    steps: [{ t: 'cook', item: 'egg', how: 'sarten' }, { t: 'slice', item: 'egg', cuts: 2 }, { t: 'shape', count: 2 }, { t: 'top', item: 'egg' }, { t: 'wrap' }, { t: 'plate' }],
    price: 18, xp: 9, unlock: { level: 2, text: 'Restaurante nivel 2' }, icon: { type: 'nigiri', c1: '#f2d27a', c2: '#2f3b33' },
  }),
  R({
    id: 'onigiri', name: 'Onigiri', cat: 'basic', difficulty: 1,
    desc: 'Bolita triangular de arroz con umeboshi. Comida de viaje.',
    ingredients: { rice: 1, nori: 1, umeboshi: 1 },
    steps: [{ t: 'shape', count: 1 }, { t: 'place', items: ['umeboshi'] }, { t: 'wrap' }, { t: 'plate' }],
    price: 15, xp: 7, unlock: { text: 'Inicial' }, icon: { type: 'onigiri', c1: '#c4505a' },
    variants: [{ item: 'salmon', name: 'de salmón', bonus: 6 }],
  }),
  R({
    id: 'california', name: 'California roll', cat: 'basic', difficulty: 2,
    desc: 'Kanikama, palta y pepino, con el arroz por fuera.',
    ingredients: { rice: 1, nori: 1, crab: 1, avocado: 1, cucumber: 1, sesame: 1 },
    steps: uramaki(['crab', 'avocado', 'cucumber'], ['sesame']), price: 32, xp: 12,
    unlock: { level: 2, text: 'Restaurante nivel 2' }, icon: { type: 'uramaki', c1: '#e8826f', c2: '#f3e6c8', c3: '#7fa356' },
  }),
  R({
    id: 'sake_nigiri', name: 'Nigiri de salmón', cat: 'basic', difficulty: 2,
    desc: 'Lámina de salmón sobre arroz moldeado a mano.',
    ingredients: { rice: 1, salmon: 1 }, steps: nigiri('salmon'), price: 22, xp: 10,
    unlock: { text: 'Inicial' }, icon: { type: 'nigiri', c1: '#ef9a78' },
    variants: [{ item: 'wasabi', name: 'con wasabi', bonus: 3 }],
  }),
  // ------------------------------------------------------------- intermediate
  R({
    id: 'philadelphia', name: 'Philadelphia roll', cat: 'intermediate', difficulty: 2,
    desc: 'Salmón, queso crema y palta. Un clásico de la casa.',
    ingredients: { rice: 1, nori: 1, salmon: 1, cream: 1, avocado: 1, sesame: 1 },
    steps: uramaki(['salmon', 'cream', 'avocado'], ['sesame']), price: 42, xp: 18,
    unlock: { level: 3, text: 'Restaurante nivel 3' }, icon: { type: 'uramaki', c1: '#ef9a78', c2: '#f6f1e2', c3: '#7fa356' },
  }),
  R({
    id: 'avocado_roll', name: 'Roll de palta', cat: 'intermediate', difficulty: 2,
    desc: 'Palta cremosa y sésamo, suave como una siesta.',
    ingredients: { rice: 1, nori: 1, avocado: 2, sesame: 1 },
    steps: uramaki(['avocado', 'avocado'], ['sesame']), price: 36, xp: 15,
    unlock: { level: 3, text: 'Restaurante nivel 3' }, icon: { type: 'uramaki', c1: '#7fa356', c2: '#f3e6c8' },
  }),
  R({
    id: 'ebi', name: 'Ebi nigiri', cat: 'intermediate', difficulty: 2,
    desc: 'Langostino abierto en mariposa sobre arroz.',
    ingredients: { rice: 1, shrimp: 1 }, steps: [{ t: 'cook', item: 'shrimp', how: 'plancha' }, ...nigiri('shrimp')], price: 38, xp: 16,
    unlock: { level: 3, text: 'Restaurante nivel 3' }, icon: { type: 'nigiri', c1: '#f09a7a', c2: '#fbf6ea' },
  }),
  R({
    id: 'futomaki', name: 'Futomaki', cat: 'intermediate', difficulty: 3,
    desc: 'Rollo grueso con tamago, pepino, zanahoria y shiitake.',
    ingredients: { rice: 2, nori: 1, egg: 1, cucumber: 1, carrot: 1, shiitake: 1 },
    steps: maki(['egg', 'cucumber', 'carrot', 'shiitake']), price: 55, xp: 22,
    unlock: { level: 4, text: 'Restaurante nivel 4' }, icon: { type: 'maki', c1: '#f2d27a', c2: '#e8904a' },
  }),
  R({
    id: 'temaki', name: 'Temaki', cat: 'intermediate', difficulty: 2,
    desc: 'Cono de alga relleno, para comer con la mano.',
    ingredients: { rice: 1, nori: 1, tuna: 1, cucumber: 1 },
    steps: [{ t: 'nori' }, { t: 'rice' }, { t: 'place', items: ['tuna', 'cucumber'] }, { t: 'cone' }, { t: 'plate' }],
    price: 40, xp: 16, unlock: { level: 3, text: 'Restaurante nivel 3' }, icon: { type: 'temaki', c1: '#c4505a', c2: '#6f9e5a' },
  }),
  R({
    id: 'gunkan', name: 'Gunkan de tobiko', cat: 'intermediate', difficulty: 3,
    desc: 'Barquito de alga coronado con huevas crocantes.',
    ingredients: { rice: 1, nori: 1, roe: 1 },
    steps: [{ t: 'shape', count: 2 }, { t: 'wrap' }, { t: 'top', item: 'roe' }, { t: 'plate' }],
    price: 48, xp: 20, unlock: { level: 4, text: 'Restaurante nivel 4' }, icon: { type: 'gunkan', c1: '#f08a4a' },
  }),
  R({
    id: 'veggie_roll', name: 'Roll vegetariano', cat: 'intermediate', difficulty: 2,
    desc: 'Pepino, zanahoria, palta y verdeo. Color de jardín.',
    ingredients: { rice: 1, nori: 1, cucumber: 1, carrot: 1, avocado: 1, scallion: 1 },
    steps: maki(['cucumber', 'carrot', 'avocado'], ['scallion']), price: 38, xp: 16,
    unlock: { level: 3, text: 'Restaurante nivel 3' }, icon: { type: 'maki', c1: '#7fa356', c2: '#e8904a' },
  }),
  R({
    id: 'crunchy', name: 'Roll crocante', cat: 'intermediate', difficulty: 3,
    desc: 'Langostino y queso crema con lluvia de tempura.',
    ingredients: { rice: 1, nori: 1, shrimp: 1, cream: 1, tempura: 1 },
    steps: withCook(uramaki(['shrimp', 'cream'], ['tempura']), { t: 'cook', item: 'shrimp', how: 'plancha' }, 'nori'), price: 52, xp: 21,
    unlock: { level: 4, text: 'Restaurante nivel 4' }, icon: { type: 'uramaki', c1: '#f09a7a', c2: '#e8c070' },
  }),
  // ------------------------------------------------------------- special
  R({
    id: 'spicy_beacon', name: 'Spicy Beacon Roll', cat: 'special', difficulty: 3, spicy: true,
    desc: 'Atún, ají y una cantidad preocupante de wasabi. Firma de Spicy.',
    ingredients: { rice: 1, nori: 1, tuna: 1, chili: 1, wasabi: 1 },
    steps: uramaki(['tuna', 'chili'], ['wasabi']), price: 78, xp: 30,
    unlock: { flag: 'recipe_spicy', text: 'Misión de Spicy Beacon' }, icon: { type: 'uramaki', c1: '#c4505a', c2: '#c94a3f', c3: '#a3c46f' },
  }),
  R({
    id: 'pip_happy', name: "Pip's Happy Maki", cat: 'special', difficulty: 3,
    desc: 'Mango, queso crema y frutillas. Sabe a abrazo.',
    ingredients: { rice: 1, nori: 1, mango: 1, cream: 1, berry: 1, sesame: 1 },
    steps: maki(['mango', 'cream', 'berry'], ['sesame']), price: 75, xp: 30,
    unlock: { flag: 'recipe_pip', text: 'Amistad con Pip' }, icon: { type: 'maki', c1: '#f2b84a', c2: '#d9675f' },
  }),
  R({
    id: 'rigg_midnight', name: "Rigg's Midnight Roll", cat: 'special', difficulty: 4,
    desc: 'Anguila glaseada y sésamo negro, servido en silencio.',
    ingredients: { rice: 1, nori: 2, eel: 1, cucumber: 1, sesame: 1 },
    steps: uramaki(['eel', 'cucumber'], ['sesame']), price: 88, xp: 34,
    unlock: { flag: 'recipe_rigg', text: 'Amistad con Rigg' }, icon: { type: 'uramaki', c1: '#8a5a3c', c2: '#2f3b33' },
  }),
  R({
    id: 'rainbow', name: 'Rainbow Roll', cat: 'special', difficulty: 4,
    desc: 'California cubierto con láminas de salmón, atún y palta.',
    ingredients: { rice: 1, nori: 1, crab: 1, cucumber: 1, salmon: 1, tuna: 1, avocado: 1 },
    steps: [{ t: 'slice', item: 'salmon', cuts: 3 }, { t: 'nori' }, { t: 'rice' }, { t: 'place', items: ['crab', 'cucumber'] }, { t: 'roll' }, { t: 'garnish', items: ['salmon', 'tuna', 'avocado'] }, { t: 'cut', pieces: 8 }, { t: 'plate' }],
    price: 95, xp: 36, unlock: { level: 5, text: 'Restaurante nivel 5' }, icon: { type: 'uramaki', c1: '#e8826f', c2: '#ef9a78', c3: '#7fa356' },
  }),
  R({
    id: 'dragon', name: 'Dragon Roll', cat: 'special', difficulty: 5,
    desc: 'Langostino tempura bajo escamas de palta y anguila.',
    ingredients: { rice: 1, nori: 1, shrimp: 1, tempura: 1, avocado: 1, eel: 1 },
    steps: [{ t: 'cook', item: 'shrimp', how: 'plancha' }, { t: 'cook', item: 'eel', how: 'plancha' }, { t: 'slice', item: 'avocado', cuts: 4 }, { t: 'nori' }, { t: 'rice' }, { t: 'place', items: ['shrimp', 'tempura'] }, { t: 'roll' }, { t: 'garnish', items: ['avocado', 'eel'] }, { t: 'cut', pieces: 8 }, { t: 'plate' }],
    price: 110, xp: 40, unlock: { level: 6, text: 'Restaurante nivel 6' }, icon: { type: 'uramaki', c1: '#f09a7a', c2: '#7fa356', c3: '#8a5a3c' },
  }),
  R({
    id: 'moonlight', name: 'Moonlight Sushi', cat: 'special', difficulty: 4,
    desc: 'Nigiri de pescado blanco con perla de luna. Brilla un poquito.',
    ingredients: { rice: 1, f_carp: 1, moonpearl: 1 },
    steps: [{ t: 'slice', item: 'f_carp', cuts: 3 }, { t: 'shape', count: 2 }, { t: 'top', item: 'f_carp' }, { t: 'garnish', items: ['moonpearl'] }, { t: 'plate' }],
    price: 100, xp: 38, unlock: { flag: 'recipe_moon', text: 'Mercado Nocturno' }, icon: { type: 'nigiri', c1: '#fbf6ea', c2: '#d6cce8' },
  }),
  R({
    id: 'sakura_roll', name: 'Sakura Roll', cat: 'special', difficulty: 3,
    desc: 'Arroz rosado, salmón y pétalos de sakura.',
    ingredients: { rice: 1, nori: 1, salmon: 1, sakura: 1, cream: 1 },
    steps: uramaki(['salmon', 'cream'], ['sakura']), price: 85, xp: 32,
    unlock: { flag: 'recipe_sakura', text: 'Festival de las Flores' }, icon: { type: 'uramaki', c1: '#ef9a78', c2: '#f4c6cf' },
  }),
  R({
    id: 'nori_deluxe', name: 'Nori Deluxe', cat: 'special', difficulty: 4,
    desc: 'Futomaki de lujo con anguila, tamago y tobiko.',
    ingredients: { rice: 2, nori: 2, eel: 1, egg: 1, roe: 1, cucumber: 1 },
    steps: maki(['eel', 'egg', 'cucumber'], ['roe']), price: 105, xp: 38,
    unlock: { level: 6, text: 'Restaurante nivel 6' }, icon: { type: 'maki', c1: '#8a5a3c', c2: '#f08a4a' },
  }),
  R({
    id: 'three_stars', name: 'Tres Estrellas', cat: 'special', difficulty: 5,
    desc: 'Tres piezas: una dulce, una picante y una misteriosa. La receta imposible.',
    ingredients: { rice: 2, nori: 1, mango: 1, chili: 1, starfruit: 1, salmon: 1 },
    steps: [{ t: 'shape', count: 3 }, { t: 'top', item: 'salmon' }, { t: 'wrap' }, { t: 'garnish', items: ['mango', 'chili', 'starfruit'] }, { t: 'plate' }],
    price: 120, xp: 50, unlock: { flag: 'recipe_three', text: 'Capítulo 4' }, icon: { type: 'special', c1: '#ef9a78', c2: '#2f3b33', c3: '#f2c66d' },
  }),
  R({
    id: 'secret_maki', name: 'Maki Secreto', cat: 'special', difficulty: 5,
    desc: 'Nadie sabe qué tiene. Ni siquiera Spicy. Bueno, Spicy sí.',
    ingredients: { rice: 1, nori: 1, tuna: 1, mango: 1, roe: 1, shiitake: 1 },
    steps: maki(['tuna', 'mango', 'shiitake'], ['roe']), price: 115, xp: 45,
    unlock: { flag: 'recipe_secret', text: 'Experimento de Spicy' }, icon: { type: 'maki', c1: '#3b4470', c2: '#f2c66d' },
  }),
  // Rewards of the personal stories (src/story/bonds.ts): earned with Pip, Spicy and Rigg, never bought.
  R({
    id: 'pip_nap', name: 'Maki Siesta de Pip', cat: 'special', difficulty: 2,
    desc: 'Mango, pepino y queso crema, suave como una manta. Se come despacito.',
    ingredients: { rice: 1, nori: 1, mango: 1, cucumber: 1, cream: 1 },
    steps: maki(['mango', 'cucumber', 'cream']), price: 62, xp: 26,
    unlock: { flag: 'recipe_bond_pip', text: 'Una siesta con Pip' }, icon: { type: 'maki', c1: '#f4c6cf', c2: '#f8d78a' },
  }),
  R({
    id: 'spicy_egg', name: 'Tamago con carácter', cat: 'special', difficulty: 3, spicy: true,
    desc: 'Tamagoyaki, pepino y un hilo de ají. Tiene carácter, como debe ser.',
    ingredients: { rice: 1, nori: 1, egg: 1, cucumber: 1, chili: 1 },
    steps: maki(['egg', 'cucumber', 'chili']), price: 74, xp: 32,
    unlock: { flag: 'recipe_bond_spicy', text: 'El huevo de Spicy, otra vez' }, icon: { type: 'maki', c1: '#f2d27a', c2: '#c94a3f' },
  }),
  R({
    id: 'rigg_notebook', name: 'Maki del Cuaderno', cat: 'special', difficulty: 3,
    desc: 'Atún, palta y una ciruela encurtida. Prolijo, ácido y sorprendentemente tierno.',
    ingredients: { rice: 1, nori: 1, tuna: 1, avocado: 1, umeboshi: 1 },
    steps: maki(['tuna', 'avocado', 'umeboshi']), price: 82, xp: 34,
    unlock: { flag: 'recipe_bond_rigg', text: 'Una noche de estrellas con Rigg' }, icon: { type: 'maki', c1: '#3b4470', c2: '#c4505a' },
  }),
  R({
    id: 'sofi_maki', name: 'Maki de la casa', cat: 'special', difficulty: 3,
    desc: 'Salmón, palta y mango con un toque de sakura. Hecho con cariño.',
    ingredients: { rice: 1, nori: 1, salmon: 1, avocado: 1, mango: 1, sakura: 1 },
    steps: maki(['salmon', 'avocado', 'mango'], ['sakura']), price: 100, xp: 40,
    unlock: { flag: 'recipe_sofi', text: '???' }, icon: { type: 'maki', c1: '#ef9a78', c2: '#f4c6cf' },
  }),
];

export const RECIPES_BY_ID: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const STARTER_RECIPES = ['kappa', 'sake_maki', 'onigiri', 'sake_nigiri'];

/** Hidden experiment combos (Spicy's lab): sorted ingredient list -> recipe flag/unlock or funny result */
export const EXPERIMENTS: { combo: string[]; unlockFlag?: string; result: string }[] = [
  { combo: ['chili', 'tuna', 'wasabi'], unlockFlag: 'recipe_spicy', result: 'spicy_beacon' },
  { combo: ['mango', 'roe', 'shiitake', 'tuna'], unlockFlag: 'recipe_secret', result: 'secret_maki' },
  { combo: ['berry', 'cream', 'mango'], unlockFlag: 'recipe_pip', result: 'pip_happy' },
];
