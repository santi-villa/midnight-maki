import type { IconSpec } from '../art/icons';

export type ItemCat =
  | 'ingredient' | 'supply' | 'fish' | 'bug' | 'flower' | 'shell' | 'material' | 'seed' | 'gift' | 'key' | 'dish' | 'rare';

export interface ItemDef {
  id: string;
  name: string;
  cat: ItemCat;
  icon: IconSpec;
  buy: number;   // 0 = not purchasable
  sell: number;
  desc: string;
  rarity?: 1 | 2 | 3; // 1 common, 2 rare, 3 special
  where?: string;    // collection hint
}

const I = (id: string, name: string, cat: ItemCat, icon: IconSpec, buy: number, sell: number, desc: string, extra: Partial<ItemDef> = {}): ItemDef =>
  ({ id, name, cat, icon, buy, sell, desc, ...extra });

export const ITEMS: ItemDef[] = [
  // ---------------- beverage supplies
  I('tea_leaves', 'Hojas de té verde', 'ingredient', { type: 'leaf', c1: '#91ab69' }, 2, 1, 'Para una taza de té verde en la estación de bebidas.'),
  I('ramune_bottle', 'Botella de ramune', 'ingredient', { type: 'bottle', c1: '#78adb6' }, 4, 2, 'Una bolita de vidrio guarda las burbujas.'),
  I('milk', 'Leche', 'ingredient', { type: 'bottle', c1: '#f6ecd6' }, 3, 1, 'Para mezclar con frutillas silvestres.'),
  // ---------------- ingredients
  I('rice', 'Arroz para sushi', 'ingredient', { type: 'grain' }, 3, 1, 'Arroz avinagrado, brillante y pegajoso.'),
  I('nori', 'Alga nori', 'ingredient', { type: 'sheet' }, 3, 1, 'Hoja de alga tostada.'),
  I('salmon', 'Salmón', 'ingredient', { type: 'fillet', c1: '#ef9a78', c2: '#f8c8b0' }, 6, 4, 'Salmón fresco con vetas suaves.'),
  I('tuna', 'Atún', 'ingredient', { type: 'fillet', c1: '#c4505a', c2: '#d9707a' }, 7, 4, 'Atún rojo, intenso.'),
  I('cucumber', 'Pepino', 'ingredient', { type: 'veg', c1: '#6f9e5a', c2: '#cfe3b0' }, 4, 2, 'Crocante y fresco.'),
  I('avocado', 'Palta', 'ingredient', { type: 'round', c1: '#7fa356', c2: '#e6e29a' }, 6, 3, 'Cremosa.'),
  I('egg', 'Tamagoyaki', 'ingredient', { type: 'egg', c1: '#f2d27a' }, 4, 2, 'Omelette japonés dulce, en capas.'),
  I('shrimp', 'Langostino', 'ingredient', { type: 'shrimp', c1: '#f09a7a' }, 6, 4, 'Cocido y pelado.'),
  I('crab', 'Kanikama', 'ingredient', { type: 'veg', c1: '#e8826f', c2: '#fbf6ea' }, 6, 3, 'Barrita de cangrejo.'),
  I('cream', 'Queso crema', 'ingredient', { type: 'blob', c1: '#f6f1e2' }, 6, 3, 'Suave y untable.'),
  I('sesame', 'Sésamo', 'ingredient', { type: 'flakes', c1: '#f3e6c8' }, 2, 1, 'Semillitas tostadas.'),
  I('wasabi', 'Wasabi', 'ingredient', { type: 'blob', c1: '#a3c46f' }, 3, 1, 'Picante, con cuidado.'),
  I('chili', 'Ají picante', 'ingredient', { type: 'veg', c1: '#c94a3f', c2: '#e8826f' }, 4, 2, 'El favorito de Spicy Beacon.'),
  I('tempura', 'Copos de tempura', 'ingredient', { type: 'flakes', c1: '#e8c070' }, 3, 1, 'Crujientes y dorados.'),
  I('mango', 'Mango', 'ingredient', { type: 'round', c1: '#f2b84a', c2: '#f8d78a' }, 6, 3, 'Dulce y tropical.'),
  I('eel', 'Anguila glaseada', 'ingredient', { type: 'fillet', c1: '#8a5a3c', c2: '#c9a24a' }, 9, 6, 'Glaseada con salsa dulce.'),
  I('roe', 'Huevas tobiko', 'ingredient', { type: 'roe', c1: '#f08a4a' }, 7, 5, 'Perlitas naranjas que crujen.'),
  I('scallion', 'Cebolla de verdeo', 'ingredient', { type: 'leaf', c1: '#7fae5f' }, 3, 1, 'Aroma fresco.'),
  I('carrot', 'Zanahoria', 'ingredient', { type: 'veg', c1: '#e8904a', c2: '#f2b77a' }, 3, 1, 'Dulce y crocante.'),
  I('ginger', 'Jengibre', 'ingredient', { type: 'blob', c1: '#f4c6b8' }, 3, 1, 'Encurtido, rosado.'),
  I('umeboshi', 'Umeboshi', 'ingredient', { type: 'round', c1: '#c4505a', c2: '#e07a84' }, 4, 2, 'Ciruela encurtida, muy ácida.'),
  I('shiitake', 'Shiitake', 'ingredient', { type: 'mush', c1: '#8a5a3c' }, 5, 2, 'Hongo aromático del bosque.', { where: 'Bosque Susurrante' }),
  I('sakura', 'Pétalos de sakura', 'ingredient', { type: 'flower', c1: '#f4c6cf', c2: '#f2c66d' }, 0, 4, 'Pétalos comestibles del jardín.', { where: 'Jardín de los Faroles' }),
  I('moonpearl', 'Perla de luna', 'ingredient', { type: 'gem', c1: '#d6cce8' }, 0, 15, 'Un azúcar cristalizado que brilla de noche.', { where: 'Mercado Nocturno', rarity: 2 }),
  I('starfruit', 'Carambola', 'ingredient', { type: 'star', c1: '#f2d27a' }, 0, 12, 'Fruta con forma de estrella.', { where: 'Mercado Nocturno', rarity: 2 }),
  I('berry', 'Frutillas silvestres', 'ingredient', { type: 'round', c1: '#d9675f', c2: '#f4b08c' }, 0, 2, 'Dulces y pequeñas.', { where: 'Bosque Susurrante' }),

  // ---------------- fish
  I('f_sardine', 'Sardina', 'fish', { type: 'fish', c1: '#9fb6c2', c2: '#d8e4ea' }, 0, 6, 'Pequeña y plateada.', { rarity: 1, where: 'Playa' }),
  I('f_mackerel', 'Caballa', 'fish', { type: 'fish', c1: '#6f9fb8', c2: '#3b4470' }, 0, 8, 'Rayas azuladas.', { rarity: 1, where: 'Playa' }),
  I('f_salmon', 'Salmón salvaje', 'fish', { type: 'fish', c1: '#ef9a78', c2: '#c27f86' }, 0, 14, 'Se puede usar como salmón.', { rarity: 1, where: 'Lago' }),
  I('f_tuna', 'Atún joven', 'fish', { type: 'fish', c1: '#5d6f9c', c2: '#c4505a' }, 0, 16, 'Se puede usar como atún.', { rarity: 2, where: 'Playa (tarde)' }),
  I('f_carp', 'Carpa dorada', 'fish', { type: 'fish', c1: '#f2b84a', c2: '#fbf6ea' }, 0, 10, 'Brilla bajo el sol.', { rarity: 1, where: 'Lago' }),
  I('f_trout', 'Trucha', 'fish', { type: 'fish', c1: '#8fa77f', c2: '#e8b8c0' }, 0, 9, 'Moteada de rosa.', { rarity: 1, where: 'Lago' }),
  I('f_puffer', 'Pez globo', 'fish', { type: 'fish', c1: '#e8d38a', c2: '#a59f9a' }, 0, 18, 'Se infla si se asusta. No se cocina.', { rarity: 2, where: 'Playa (noche)' }),
  I('f_octopus', 'Pulpito', 'fish', { type: 'fish', c1: '#d9675f', c2: '#f4b08c' }, 0, 20, 'Saluda con ocho brazos.', { rarity: 2, where: 'Muelle' }),
  I('f_koi', 'Koi del faro', 'fish', { type: 'fish', c1: '#fbf6ea', c2: '#d9675f' }, 0, 30, 'Dicen que trae buena suerte.', { rarity: 3, where: 'Lago (noche)' }),
  I('f_moonfish', 'Pez luna', 'fish', { type: 'fish', c1: '#d6cce8', c2: '#f2c66d' }, 0, 40, 'Solo aparece en noches estrelladas.', { rarity: 3, where: 'Playa (noche)' }),
  I('f_eel', 'Anguila de río', 'fish', { type: 'fish', c1: '#6b4330', c2: '#c9a24a' }, 0, 16, 'Se puede usar como anguila.', { rarity: 2, where: 'Lago (atardecer)' }),
  I('f_starfish', 'Estrella de mar', 'fish', { type: 'star', c1: '#e8904a' }, 0, 12, 'Técnicamente no es un pez.', { rarity: 1, where: 'Playa' }),

  // ---------------- bugs
  I('b_white', 'Mariposa blanca', 'bug', { type: 'bug', c1: '#fbf6ea', c2: '#e6dfcf' }, 0, 5, 'Revolotea entre las flores.', { rarity: 1, where: 'Jardín (mañana)' }),
  I('b_sulphur', 'Mariposa limón', 'bug', { type: 'bug', c1: '#f2dc8a', c2: '#e8c070' }, 0, 6, 'Amarilla como un caramelo.', { rarity: 1, where: 'Plaza (tarde)' }),
  I('b_blue', 'Mariposa azul', 'bug', { type: 'bug', c1: '#6f9fd8', c2: '#3b4470' }, 0, 12, 'Muy escurridiza.', { rarity: 2, where: 'Bosque' }),
  I('b_sakura', 'Mariposa sakura', 'bug', { type: 'bug', c1: '#f4c6cf', c2: '#c27f86' }, 0, 14, 'Parece un pétalo con alas.', { rarity: 2, where: 'Jardín' }),
  I('b_moth', 'Polilla lunar', 'bug', { type: 'bug', c1: '#c8e0b8', c2: '#9bb59a' }, 0, 16, 'Busca los faroles por la noche.', { rarity: 2, where: 'Noche, cerca de faroles' }),
  I('b_ladybug', 'Vaquita de San Antonio', 'bug', { type: 'beetle', c1: '#c94a3f', c2: '#2a2230' }, 0, 6, 'Trae suerte, dicen.', { rarity: 1, where: 'Jardín' }),
  I('b_beetle', 'Escarabajo ciervo', 'bug', { type: 'beetle', c1: '#5d4f5f', c2: '#3a2f4f' }, 0, 14, 'Fuerte y tranquilo.', { rarity: 2, where: 'Bosque (noche)' }),
  I('b_firefly', 'Luciérnaga', 'bug', { type: 'beetle', c1: '#f4e3a8', c2: '#9bb59a' }, 0, 10, 'Una lucecita viva.', { rarity: 1, where: 'Noche' }),
  I('b_dragonfly', 'Libélula', 'bug', { type: 'bug', c1: '#94c0d2', c2: '#4f7f9c' }, 0, 9, 'Vuela sobre el agua.', { rarity: 1, where: 'Lago' }),
  I('b_star', 'Mariposa estelar', 'bug', { type: 'bug', c1: '#3b4470', c2: '#f2c66d' }, 0, 40, 'Sus alas tienen constelaciones.', { rarity: 3, where: '???' }),

  // ---------------- flowers
  I('fl_daisy', 'Margarita', 'flower', { type: 'flower', c1: '#fbf6ea', c2: '#f2c66d' }, 0, 3, 'Sencilla y feliz.', { rarity: 1 }),
  I('fl_tulip', 'Tulipán rosa', 'flower', { type: 'flower', c1: '#e8a0b0', c2: '#c27f86' }, 0, 5, 'Elegante.', { rarity: 1 }),
  I('fl_bell', 'Campanilla', 'flower', { type: 'flower', c1: '#9686bd', c2: '#d6cce8' }, 0, 5, 'Suena si la escuchás bien.', { rarity: 1 }),
  I('fl_sun', 'Girasol', 'flower', { type: 'flower', c1: '#f2c66d', c2: '#8a5a3c' }, 0, 7, 'Siempre mira hacia arriba.', { rarity: 1 }),
  I('fl_lily', 'Lirio de agua', 'flower', { type: 'flower', c1: '#f4d7d0', c2: '#f2c66d' }, 0, 9, 'Flota en el estanque.', { rarity: 2 }),
  I('fl_camellia', 'Camelia', 'flower', { type: 'flower', c1: '#c94a5a', c2: '#f2c66d' }, 0, 9, 'Flor de invierno.', { rarity: 2 }),
  I('fl_moon', 'Flor de luna', 'flower', { type: 'flower', c1: '#cfe0ef', c2: '#b7a8d6' }, 0, 20, 'Solo abre de noche.', { rarity: 3 }),
  I('fl_star', 'Flor estrella', 'flower', { type: 'flower', c1: '#f2c66d', c2: '#fff6c8' }, 0, 30, 'Combinación secreta.', { rarity: 3 }),

  // ---------------- shells & stones
  I('sh_scallop', 'Vieira', 'shell', { type: 'shell', c1: '#f4d7d0' }, 0, 4, 'Una concha clásica.', { rarity: 1 }),
  I('sh_spiral', 'Caracola', 'shell', { type: 'shell', c1: '#e8c8a0' }, 0, 6, 'Se escucha el mar.', { rarity: 1 }),
  I('sh_cowrie', 'Cauri', 'shell', { type: 'shell', c1: '#f2e2bd' }, 0, 6, 'Lisa y brillante.', { rarity: 1 }),
  I('sh_pink', 'Concha rosa', 'shell', { type: 'shell', c1: '#e8a0b0' }, 0, 9, 'Muy rara de encontrar entera.', { rarity: 2 }),
  I('sh_blue', 'Mejillón azul', 'shell', { type: 'shell', c1: '#6f9fb8' }, 0, 8, 'Azul como la noche.', { rarity: 2 }),
  I('sh_pearl', 'Ostra con perla', 'shell', { type: 'shell', c1: '#fbf6ea' }, 0, 25, '¡Tiene una perla adentro!', { rarity: 3 }),
  I('st_quartz', 'Cuarzo rosa', 'material', { type: 'gem', c1: '#e8b8c0' }, 0, 10, 'Piedra cálida.', { rarity: 2 }),
  I('st_amethyst', 'Amatista', 'material', { type: 'gem', c1: '#9686bd' }, 0, 14, 'Violeta profundo.', { rarity: 2 }),
  I('st_seaglass', 'Vidrio de mar', 'material', { type: 'gem', c1: '#9fd0c0' }, 0, 6, 'Pulido por las olas.', { rarity: 1 }),
  I('wood', 'Madera', 'material', { type: 'wood' }, 0, 2, 'Ramas y tablitas útiles.'),
  I('stone', 'Piedra', 'material', { type: 'gem', c1: '#a59f9a' }, 0, 1, 'Una piedra común.'),

  // ---------------- seeds
  I('sd_cucumber', 'Semillas de pepino', 'seed', { type: 'seed', c1: '#6f9e5a' }, 10, 3, 'Crece en 2 días.'),
  I('sd_scallion', 'Semillas de verdeo', 'seed', { type: 'seed', c1: '#7fae5f' }, 8, 2, 'Crece en 1 día.'),
  I('sd_carrot', 'Semillas de zanahoria', 'seed', { type: 'seed', c1: '#e8904a' }, 8, 2, 'Crece en 2 días.'),
  I('sd_chili', 'Semillas de ají', 'seed', { type: 'seed', c1: '#c94a3f' }, 12, 3, 'Crece en 3 días.'),
  I('sd_flower', 'Semillas de flores', 'seed', { type: 'seed', c1: '#e8a0b0' }, 8, 2, 'Flores variadas, 2 días.'),
  I('sd_sakura', 'Brote de sakura', 'seed', { type: 'sprout', c1: '#f4c6cf' }, 20, 5, 'Da pétalos de sakura, 3 días.'),

  // ---------------- gifts & special / story objects
  I('g_blanket', 'Mantita suave', 'gift', { type: 'gift', c1: '#d9a3a6', c2: '#f6ecd6' }, 60, 10, 'Ideal para alguien que tiene frío.'),
  I('g_candy', 'Caramelos de miel', 'gift', { type: 'gift', c1: '#f2c66d', c2: '#c27f86' }, 25, 5, 'Dulces que brillan.'),
  I('g_hotsauce', 'Salsa volcánica', 'gift', { type: 'bottle', c1: '#c94a3f' }, 40, 8, 'Demasiado picante para humanos.'),
  I('g_book', 'Libro de acertijos', 'gift', { type: 'book', c1: '#4f6b52' }, 45, 8, 'Cien acertijos y un mapa.'),
  I('g_tea', 'Té de jazmín', 'gift', { type: 'gift', c1: '#9bb59a', c2: '#f6ecd6' }, 30, 6, 'Aroma calmante.'),
  I('spoon', 'Cuchara brillante', 'rare', { type: 'spoon' }, 0, 1, 'Un tesoro bastante útil.', { rarity: 1 }),
  I('k_storage', 'Llave del depósito', 'key', { type: 'key', c1: '#c9a24a' }, 0, 0, 'Abre el depósito del restaurante.'),
  I('k_station', 'Llave oxidada', 'key', { type: 'key', c1: '#a8734d' }, 0, 0, 'Tiene grabado un tren.'),
  I('k_lighthouse', 'Llave del faro', 'key', { type: 'key', c1: '#f2c66d' }, 0, 0, 'Tres estrellas grabadas.'),
  I('star1', 'Estrella de Pip', 'key', { type: 'star', c1: '#f4c6cf' }, 0, 0, 'Una pieza del mecanismo del faro. Brilla con calidez.'),
  I('star2', 'Estrella de Spicy', 'key', { type: 'star', c1: '#e8904a' }, 0, 0, 'Una pieza del mecanismo del faro. Está tibia.'),
  I('star3', 'Estrella de Rigg', 'key', { type: 'star', c1: '#94c0d2' }, 0, 0, 'Una pieza del mecanismo del faro. Fría y precisa.'),
  I('bottle_msg', 'Botella con mensaje', 'rare', { type: 'bottle', c1: '#9fd0c0' }, 0, 0, 'Algo escrito adentro.', { rarity: 2 }),
];

/** Restaurant supplies come in a pack (a few units) or a box (more, cheaper per unit). Opening one at the pantry stocks its ingredient. */
export interface PackDef { id: string; item: string; qty: number; tier: 'pack' | 'box' }
const PACK_SIZES: Record<string, [number, number]> = {
  rice: [6, 15], nori: [8, 20], salmon: [4, 10], tuna: [4, 10], shrimp: [4, 10], crab: [4, 10], eel: [3, 8], roe: [3, 8],
  cucumber: [6, 15], avocado: [4, 10], carrot: [6, 15], scallion: [6, 15], mango: [4, 10], egg: [6, 15], cream: [4, 10],
  sesame: [8, 20], wasabi: [6, 15], ginger: [6, 15], tempura: [8, 20], chili: [6, 15], umeboshi: [4, 10],
  tea_leaves: [8, 20], ramune_bottle: [6, 12], milk: [6, 12],
};
/** discount against buying the same units one by one */
export const PACK_DISCOUNT = { pack: 0.1, box: 0.2 } as const;
export const PACKS: PackDef[] = [];
for (const [item, sizes] of Object.entries(PACK_SIZES)) {
  const base = ITEMS.find((i) => i.id === item);
  if (!base) continue;
  (['pack', 'box'] as const).forEach((tier, k) => {
    const qty = sizes[k];
    const id = `${tier === 'pack' ? 'pk' : 'bx'}_${item}`;
    PACKS.push({ id, item, qty, tier });
    ITEMS.push({
      id, name: `${tier === 'pack' ? 'Paquete' : 'Caja'} de ${base.name.toLowerCase()} (×${qty})`, cat: 'supply', icon: base.icon,
      buy: Math.ceil(base.buy * qty * (1 - PACK_DISCOUNT[tier])), sell: 0, desc: `${qty} unidades para la despensa del restaurante. Se abre y se guarda en la despensa de la cocina.`,
    });
  });
}
export const PACKS_BY_ID: Record<string, PackDef> = Object.fromEntries(PACKS.map((p) => [p.id, p]));

export const ITEMS_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Fish that can substitute for ingredients when cooking */
export const INGREDIENT_ALIASES: Record<string, string> = {
  f_salmon: 'salmon',
  f_tuna: 'tuna',
  f_eel: 'eel',
};

export function itemName(id: string): string {
  return ITEMS_BY_ID[id]?.name ?? id;
}
