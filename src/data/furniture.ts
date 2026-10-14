export type FurnCat =
  | 'bedroom' | 'kitchen' | 'restaurant' | 'garden' | 'bath' | 'light' | 'plant' | 'wall' | 'rug' | 'small' | 'special';

export type DecoStyle =
  | 'japanese' | 'cozy' | 'natural' | 'pastel' | 'dark' | 'cottage' | 'minimal' | 'forest' | 'night' | 'raccoon';

export interface FurnitureDef {
  id: string;
  name: string;
  cat: FurnCat;
  style: DecoStyle;
  price: number;
  kind: string;      // art/objects.ts drawer
  c1: string;
  c2: string;
  w: number;         // footprint in tiles
  h: number;
  sh: number;        // sprite height in px (width = w*16)
  variant?: number;  // passed as `rot` for drawers that use variants
  rotatable?: boolean;
  walkable?: boolean;
  wall?: boolean;    // goes on the wall face row
  light?: string;    // emits light at night
  sit?: boolean;
  charm: number;     // restaurant ambience score
  shop: 'taro' | 'sumi' | 'mika' | 'market' | 'event' | 'reward' | 'kit';
  unlock?: string;
  likes?: string[];  // raccoons that react happily
}

const F = (
  id: string, name: string, cat: FurnCat, style: DecoStyle, price: number, kind: string, c1: string, c2: string,
  w: number, h: number, sh: number, extra: Partial<FurnitureDef> = {},
): FurnitureDef => ({ id, name, cat, style, price, kind, c1, c2, w, h, sh, charm: Math.max(1, Math.round(price / 60)), shop: 'taro', ...extra });

export const FURNITURE: FurnitureDef[] = [
  // ---------------- tables
  F('table_wood', 'Mesa de madera', 'restaurant', 'natural', 90, 'table', '#a8734d', '', 2, 1, 22),
  F('table_round', 'Mesita redonda', 'restaurant', 'cozy', 70, 'roundtable', '#a8734d', '', 1, 1, 16),
  F('table_dark', 'Mesa de nogal', 'restaurant', 'dark', 180, 'table', '#5e3f30', '', 2, 1, 22),
  F('table_pink', 'Mesa pastel', 'restaurant', 'pastel', 160, 'table', '#e8b8c0', '', 2, 1, 22, { shop: 'sumi' }),
  F('table_low', 'Chabudai', 'restaurant', 'japanese', 150, 'table', '#8a5a3c', '', 2, 1, 14),
  F('kotatsu', 'Kotatsu', 'bedroom', 'japanese', 420, 'kotatsu', '#b2585e', '#f2c66d', 2, 2, 30, { sit: true, likes: ['pip'] }),
  // ---------------- seats
  F('chair_wood', 'Silla de madera', 'restaurant', 'natural', 50, 'chair', '#8a5a3c', '#a8734d', 1, 1, 18, { rotatable: true, sit: true }),
  F('chair_rose', 'Silla rosa', 'restaurant', 'pastel', 80, 'chair', '#c27f86', '#e8b8c0', 1, 1, 18, { rotatable: true, sit: true, shop: 'sumi' }),
  F('chair_sage', 'Silla salvia', 'restaurant', 'cottage', 80, 'chair', '#7c9a7b', '#a9c3a0', 1, 1, 18, { rotatable: true, sit: true }),
  F('chair_dark', 'Silla de nogal', 'restaurant', 'dark', 110, 'chair', '#4e3428', '#6e4a38', 1, 1, 18, { rotatable: true, sit: true }),
  F('stool', 'Banquito', 'kitchen', 'minimal', 50, 'stool', '#a8734d', '', 1, 1, 14, { sit: true }),
  F('cushion_rose', 'Zabuton rosa', 'bedroom', 'japanese', 55, 'cushion', '#d9a3a6', '#f2c66d', 1, 1, 14, { sit: true, walkable: true }),
  F('cushion_indigo', 'Zabuton índigo', 'bedroom', 'japanese', 55, 'cushion', '#3b4470', '#f6ecd6', 1, 1, 14, { sit: true, walkable: true }),
  F('bench_wood', 'Banco de madera', 'garden', 'natural', 120, 'bench', '#a8734d', '', 2, 1, 16, { sit: true }),
  // ---------------- beds
  F('bed_rose', 'Cama rosada', 'bedroom', 'pastel', 260, 'bed', '#d9a3a6', '#f6ecd6', 1, 2, 32),
  F('bed_sage', 'Cama de campo', 'bedroom', 'cottage', 260, 'bed', '#9bb59a', '#f6ecd6', 1, 2, 32),
  F('bed_star', 'Cama estrellada', 'bedroom', 'night', 480, 'bed', '#3b4470', '#f2c66d', 1, 2, 32, { shop: 'market', likes: ['rigg'] }),
  F('futon_indigo', 'Futón índigo', 'bedroom', 'japanese', 200, 'futon', '#3b4470', '#4a5590', 1, 2, 30, { walkable: true }),
  F('futon_rose', 'Futón floral', 'bedroom', 'cozy', 200, 'futon', '#d9a3a6', '#f6ecd6', 1, 2, 30, { walkable: true, likes: ['pip'] }),
  // ---------------- storage
  F('shelf_books', 'Biblioteca', 'bedroom', 'cozy', 220, 'shelf', '#8a5a3c', '#3b4470', 2, 1, 30, { likes: ['rigg'] }),
  F('shelf_kitchen', 'Estante de cocina', 'kitchen', 'natural', 180, 'shelf', '#a8734d', '#f6ecd6', 2, 1, 30, { likes: ['spicy'] }),
  F('shelf_dark', 'Biblioteca antigua', 'bedroom', 'dark', 380, 'shelf', '#4e3428', '#b2585e', 2, 1, 30, { likes: ['rigg'] }),
  F('wardrobe_wood', 'Ropero', 'bedroom', 'natural', 300, 'wardrobe', '#a8734d', '', 2, 1, 30),
  F('wardrobe_white', 'Ropero blanco', 'bedroom', 'minimal', 300, 'wardrobe', '#efe8da', '', 2, 1, 30, { shop: 'sumi' }),
  F('desk_wood', 'Escritorio', 'bedroom', 'natural', 240, 'desk', '#a8734d', '#3b4470', 2, 1, 26, { likes: ['rigg'] }),
  F('desk_dark', 'Escritorio de nogal', 'bedroom', 'dark', 340, 'desk', '#5e3f30', '#b7a8d6', 2, 1, 26),
  F('chest_wood', 'Baúl', 'bedroom', 'cottage', 120, 'chest', '#8a5a3c', '', 1, 1, 14),
  // ---------------- plants
  F('plant_fern', 'Helecho', 'plant', 'natural', 60, 'plant', '#6f9e5a', '#c27f86', 1, 1, 24),
  F('plant_monstera', 'Monstera', 'plant', 'natural', 140, 'tallplant', '#4f8a5a', '#efe8da', 1, 1, 32),
  F('cactus', 'Cactus', 'plant', 'minimal', 55, 'cactus', '#6f9e5a', '#c9a87c', 1, 1, 22),
  F('bonsai', 'Bonsái', 'plant', 'japanese', 180, 'bonsai', '#4f6b52', '#3b4470', 1, 1, 18),
  F('bonsai_sakura', 'Bonsái sakura', 'plant', 'japanese', 320, 'bonsai', '#e8b4c0', '#3b4470', 1, 1, 18, { shop: 'event' }),
  F('vase_tulips', 'Jarrón con tulipanes', 'plant', 'pastel', 70, 'vase', '#e8a0b0', '#f6ecd6', 1, 1, 18),
  F('vase_lav', 'Jarrón con lavanda', 'plant', 'cottage', 70, 'vase', '#9686bd', '#a8734d', 1, 1, 18),
  F('bamboo_pot', 'Bambú en maceta', 'plant', 'japanese', 120, 'bamboo', '#6f9e5a', '#3b4470', 1, 1, 36),
  F('plant_herbs', 'Macetita de hierbas', 'plant', 'natural', 50, 'plant', '#7fae5f', '#a8734d', 1, 1, 22, { likes: ['spicy'] }),
  // ---------------- lights
  F('lamp_cream', 'Lámpara de pie', 'light', 'cozy', 130, 'floorlamp', '#f3e6c8', '', 1, 1, 32, { light: '#f4d68c' }),
  F('lamp_rose', 'Lámpara rosada', 'light', 'pastel', 150, 'floorlamp', '#e8b8c0', '', 1, 1, 32, { light: '#f6c6c0', shop: 'sumi' }),
  F('lamp_table', 'Velador', 'light', 'cozy', 80, 'tablelamp', '#f2c66d', '', 1, 1, 16, { light: '#f4d68c' }),
  F('lantern_red', 'Farol rojo', 'light', 'japanese', 90, 'paperlantern', '#d9675f', '', 1, 1, 26, { light: '#f4b08c' }),
  F('lantern_cream', 'Farol de papel', 'light', 'japanese', 90, 'paperlantern', '#f3e6c8', '', 1, 1, 26, { light: '#f4d68c' }),
  F('andon', 'Andon', 'light', 'japanese', 160, 'andon', '#f6e3b0', '', 1, 1, 28, { light: '#f4d68c' }),
  F('sake_barrel', 'Barril de sake', 'restaurant', 'japanese', 140, 'sakebarrel', '#b8524f', '', 1, 1, 18),
  F('candles', 'Velas', 'light', 'dark', 60, 'candles', '#f6ecd6', '', 1, 1, 14, { light: '#f4c070' }),
  F('starlamp', 'Lámpara estrella', 'light', 'night', 200, 'starlamp', '#f2c66d', '', 1, 1, 20, { light: '#f8e3a0', shop: 'market', likes: ['pip', 'rigg'] }),
  // ---------------- rugs
  F('rug_cream', 'Alfombra crema', 'rug', 'minimal', 90, 'rug', '#efe1c4', '#c9b48c', 2, 2, 32, { walkable: true }),
  F('rug_stripes', 'Alfombra rayada', 'rug', 'cottage', 120, 'rug', '#d9a3a6', '#f6ecd6', 3, 2, 32, { walkable: true, variant: 1 }),
  F('rug_round', 'Alfombra redonda', 'rug', 'natural', 110, 'rug', '#9bb59a', '#f6ecd6', 2, 2, 32, { walkable: true, variant: 2 }),
  F('rug_raccoon', 'Alfombra mapache', 'rug', 'raccoon', 260, 'rug', '#b7a8d6', '#8d8a93', 3, 2, 32, { walkable: true, variant: 3, shop: 'event', likes: ['pip', 'spicy', 'rigg'] }),
  F('rug_night', 'Alfombra noche', 'rug', 'night', 160, 'rug', '#2c3358', '#f2c66d', 3, 2, 32, { walkable: true, variant: 2, shop: 'market' }),
  F('rug_indigo', 'Alfombra índigo', 'rug', 'japanese', 120, 'rug', '#3b4470', '#f6ecd6', 2, 2, 32, { walkable: true, variant: 1 }),
  // ---------------- wall
  F('pt_landscape', 'Cuadro: colinas', 'wall', 'natural', 120, 'painting', '#cfe0ef', '#86a878', 2, 1, 16, { wall: true, variant: 0, shop: 'sumi' }),
  F('pt_sushi', 'Cuadro: sushi', 'wall', 'japanese', 120, 'painting', '#f3e6c8', '', 1, 1, 16, { wall: true, variant: 1, shop: 'sumi', likes: ['spicy'] }),
  F('pt_stars', 'Cuadro: constelación', 'wall', 'night', 160, 'painting', '#2c3358', '', 2, 1, 16, { wall: true, variant: 2, shop: 'sumi', likes: ['rigg'] }),
  F('pt_raccoon', 'Retrato de mapache', 'wall', 'raccoon', 200, 'painting', '#e8b8c0', '', 1, 1, 16, { wall: true, variant: 3, shop: 'sumi', likes: ['pip', 'spicy', 'rigg'] }),
  F('clock', 'Reloj de pared', 'wall', 'cottage', 90, 'clock', '', '', 1, 1, 16, { wall: true }),
  F('garland', 'Guirnalda de estrellas', 'wall', 'night', 110, 'garland', '#f2c66d', '', 2, 1, 16, { wall: true, light: '#f8e3a0', likes: ['pip'] }),
  F('windchime', 'Furin', 'wall', 'japanese', 80, 'windchime', '#94c0d2', '', 1, 1, 16, { wall: true }),
  // ---------------- small / special
  F('plush_raccoon', 'Peluche de mapache', 'small', 'raccoon', 0, 'plush', '#8d8a93', '#3a3440', 1, 1, 16, { shop: 'reward', likes: ['pip', 'spicy', 'rigg'] }),
  F('plush_cat', 'Peluche de gato', 'small', 'pastel', 110, 'plush', '#efe1c4', '#e8b8c0', 1, 1, 16, { shop: 'sumi', likes: ['pip'] }),
  F('plush_bear', 'Peluche de oso', 'small', 'cozy', 110, 'plush', '#a8734d', '#6b4330', 1, 1, 16, { likes: ['pip'] }),
  F('radio', 'Radio antigua', 'small', 'cottage', 140, 'radio', '#8a5a3c', '', 1, 1, 14, { likes: ['rigg'] }),
  F('bookstack', 'Pila de libros', 'small', 'cozy', 50, 'bookstack', '#b2585e', '#3b4470', 1, 1, 12, { likes: ['rigg'] }),
  F('tea_set', 'Juego de té', 'small', 'japanese', 90, 'tea', '#9bb59a', '', 1, 1, 10),
  F('photo_frame', 'Portarretrato', 'small', 'cozy', 0, 'frame', '#c9a24a', '', 1, 1, 12, { shop: 'reward' }),
  F('telescope', 'Telescopio', 'special', 'night', 520, 'telescope', '', '', 1, 1, 22, { shop: 'market', likes: ['rigg'] }),
  F('aquarium', 'Acuario', 'special', 'natural', 600, 'aquarium', '', '', 2, 1, 26, { likes: ['pip'] }),
  F('piano', 'Piano vertical', 'special', 'dark', 700, 'piano', '#3a2f3a', '', 2, 1, 28),
  F('easel', 'Atril de pintura', 'special', 'cottage', 180, 'easel', '#b2585e', '', 1, 1, 24, { shop: 'sumi' }),
  F('display_case', 'Vitrina de sushi', 'restaurant', 'japanese', 450, 'display', '#a8734d', '', 2, 1, 26, { likes: ['spicy'] }),
  F('chili_wreath', 'Ristra de ajíes', 'kitchen', 'raccoon', 90, 'garland', '#c94a3f', '', 2, 1, 16, { wall: true, likes: ['spicy'] }),
  F('stone_lantern', 'Linterna de piedra', 'garden', 'japanese', 260, 'stonelantern', '', '', 1, 1, 24, { light: '#f4d68c' }),
  F('star_corner', 'Rincón de estrellas', 'special', 'night', 0, 'stars', '#f2c66d', '', 2, 1, 16, { shop: 'reward', light: '#f8e3a0', walkable: true }),
  // Keepsakes from the personal stories of Pip, Spicy and Rigg (src/story/bonds.ts). Only earned, never sold.
  F('bond_nap_cushion', 'Almohadón de siesta', 'bedroom', 'cozy', 0, 'cushion', '#e8b8c0', '#f6ecd6', 1, 1, 14, { sit: true, walkable: true, shop: 'reward', likes: ['pip'] }),
  F('bond_storm_blanket', 'Manta de tormenta', 'rug', 'raccoon', 0, 'rug', '#b7a8d6', '#f2c66d', 2, 2, 32, { walkable: true, variant: 1, shop: 'reward', likes: ['pip'] }),
  F('bond_plate_frame', 'Cuadro: el plato de más', 'wall', 'cozy', 0, 'painting', '#f3e6c8', '#c9a24a', 1, 1, 16, { wall: true, variant: 1, shop: 'reward', likes: ['pip'] }),
  F('bond_chili_pot', 'Ají de la huerta', 'plant', 'raccoon', 0, 'plant', '#c94a3f', '#a8734d', 1, 1, 22, { shop: 'reward', likes: ['spicy'] }),
  F('bond_kitchen_light', 'Farolito de la cocina', 'light', 'raccoon', 0, 'paperlantern', '#f2c66d', '', 1, 1, 26, { light: '#f4d68c', shop: 'reward', likes: ['spicy'] }),
  F('bond_egg_frame', 'Cuadro: huevo con carácter', 'wall', 'raccoon', 0, 'painting', '#f6e3b0', '', 1, 1, 16, { wall: true, variant: 1, shop: 'reward', likes: ['spicy'] }),
  F('bond_reading_lamp', 'Lámpara de lectura', 'light', 'cozy', 0, 'floorlamp', '#b7a8d6', '', 1, 1, 32, { light: '#f4d68c', shop: 'reward', likes: ['rigg'] }),
  F('bond_map_frame', 'Cuadro: el mapa de Rigg', 'wall', 'night', 0, 'painting', '#cfe0ef', '', 2, 1, 16, { wall: true, variant: 0, shop: 'reward', likes: ['rigg'] }),
  F('bond_star_notebook', 'Cuaderno de estrellas', 'small', 'night', 0, 'bookstack', '#2c3358', '#f2c66d', 1, 1, 12, { shop: 'reward', likes: ['rigg'] }),
  F('bond_tuesday_lamp', 'Farol de los martes', 'light', 'japanese', 0, 'andon', '#f6e3b0', '', 1, 1, 28, { light: '#f4d68c', shop: 'reward', likes: ['pip', 'spicy', 'rigg'] }),
  F('bond_table_four', 'Mesa de los cuatro', 'restaurant', 'cozy', 0, 'table', '#a8734d', '', 2, 1, 22, { shop: 'reward', likes: ['pip', 'spicy', 'rigg'] }),
  F('bond_group_frame', 'Portarretrato de los cuatro', 'small', 'raccoon', 0, 'frame', '#f2c66d', '', 1, 1, 12, { shop: 'reward', likes: ['pip', 'spicy', 'rigg'] }),
  F('bond_dinner_frame', 'Cuadro: la cena', 'wall', 'cozy', 0, 'painting', '#e8b8c0', '', 1, 1, 16, { wall: true, variant: 3, shop: 'reward', likes: ['pip', 'spicy', 'rigg'] }),
  // Keepsakes earned from weekly errands, stored until the player chooses where to put them.
  F('errand_thanks', 'Cuadro de agradecimiento', 'wall', 'cozy', 0, 'painting', '#f3e6c8', '#9bb59a', 1, 1, 16, { wall: true, variant: 0, shop: 'reward' }),
  F('errand_furin', 'Furin del vecindario', 'wall', 'japanese', 0, 'windchime', '#8db7c4', '#f2c66d', 1, 1, 16, { wall: true, shop: 'reward' }),
  F('errand_bonsai', 'Bonsái de los vecinos', 'plant', 'japanese', 0, 'bonsai', '#6f9e5a', '#c9a24a', 1, 1, 18, { shop: 'reward' }),
];

export const FURN_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
