export type ClothingSlot = 'top' | 'bottom' | 'shoes' | 'head' | 'face' | 'extra' | 'bag';

export type ClothingStyle =
  | 'cozy' | 'gothic' | 'japanese' | 'casual' | 'pajama' | 'elegant' | 'winter' | 'summer' | 'animal' | 'chef';

export interface ClothingDef {
  id: string;
  name: string;
  slot: ClothingSlot;
  kind: string;        // drawing recipe (see art/characters.ts)
  c1: string;          // main color
  c2?: string;         // accent color
  price: number;       // 0 = not sold (reward / starter)
  style: ClothingStyle;
  shop?: 'yuki' | 'market' | 'event';
  unlock?: string;     // flag required to appear in shop
}

const C = (
  id: string, name: string, slot: ClothingSlot, kind: string, c1: string, c2: string | undefined,
  price: number, style: ClothingStyle, shop: ClothingDef['shop'] = 'yuki', unlock?: string,
): ClothingDef => ({ id, name, slot, kind, c1, c2, price, style, shop, unlock });

export const CLOTHES: ClothingDef[] = [
  // ---- tops
  C('top_tee_cream', 'Remera crema', 'top', 'tee', '#f3e6c8', '#d9c39a', 0, 'casual'),
  C('top_tee_sage', 'Remera salvia', 'top', 'tee', '#9bb59a', '#7c9a7b', 0, 'casual'),
  C('top_sweater_rose', 'Suéter rosa', 'top', 'sweater', '#d9a3a6', '#f6ecd6', 0, 'cozy'),
  C('top_hoodie_lav', 'Buzo lavanda', 'top', 'hoodie', '#b7a8d6', '#9686bd', 0, 'cozy'),
  C('top_cardigan_moss', 'Cárdigan musgo', 'top', 'cardigan', '#6f8a5e', '#f3e6c8', 120, 'cozy'),
  C('top_stripes_navy', 'Rayada marinera', 'top', 'stripes', '#f3e6c8', '#3b4470', 90, 'summer'),
  C('top_kimono_indigo', 'Haori índigo', 'top', 'kimono', '#3b4470', '#f2c66d', 170, 'japanese'),
  C('top_kimono_sakura', 'Haori sakura', 'top', 'kimono', '#e8b8c0', '#c27f86', 180, 'japanese'),
  C('top_chef', 'Chaqueta de cocina', 'top', 'chef', '#fbf6ea', '#c9b48c', 0, 'chef'),
  C('top_goth_lace', 'Blusa de encaje', 'top', 'long', '#2e2638', '#7a6a8a', 150, 'gothic'),
  C('top_pajama_star', 'Pijama estrellado', 'top', 'pajama', '#4a5590', '#f2c66d', 110, 'pajama'),
  C('top_pajama_cloud', 'Pijama nube', 'top', 'pajama', '#cfe0ef', '#ffffff', 110, 'pajama'),
  C('top_winter_coat', 'Abrigo acolchado', 'top', 'coat', '#a65e4e', '#f3e6c8', 180, 'winter'),
  C('top_tank_lemon', 'Musculosa limón', 'top', 'tank', '#f2dc8a', '#d8b85a', 80, 'summer'),
  C('top_blouse_elegant', 'Blusa de seda', 'top', 'long', '#f4d7d0', '#d9a3a6', 160, 'elegant'),
  C('top_raccoon_hoodie', 'Buzo mapache', 'top', 'hoodie', '#8d8a93', '#3a3440', 0, 'animal', 'event'),
  C('top_star_sweater', 'Suéter de estrellas', 'top', 'pajama', '#2c3358', '#f2c66d', 0, 'cozy', 'event'),
  // ---- bottoms
  C('bot_pants_brown', 'Pantalón marrón', 'bottom', 'pants', '#7a5a44', '#5c4231', 0, 'casual'),
  C('bot_jeans', 'Jean', 'bottom', 'pants', '#5d6f9c', '#46557d', 0, 'casual'),
  C('bot_skirt_plaid', 'Pollera escocesa', 'bottom', 'skirt', '#b2585e', '#e8c0a0', 0, 'cozy'),
  C('bot_shorts_sand', 'Short arena', 'bottom', 'shorts', '#d8c09a', '#b39c78', 80, 'summer'),
  C('bot_dress_rose', 'Vestido rosa', 'bottom', 'dress', '#d9a3a6', '#f6ecd6', 170, 'elegant'),
  C('bot_dress_goth', 'Vestido noche', 'bottom', 'dress', '#2e2638', '#6d5d80', 180, 'gothic'),
  C('bot_dress_sage', 'Vestido campestre', 'bottom', 'dress', '#a9c3a0', '#f6ecd6', 170, 'cozy'),
  C('bot_overalls', 'Jardinero', 'bottom', 'overalls', '#6a7fae', '#f2c66d', 140, 'casual'),
  C('bot_hakama', 'Hakama', 'bottom', 'hakama', '#5b3f5f', '#3e2a40', 160, 'japanese'),
  C('bot_pajama', 'Pantalón pijama', 'bottom', 'pants', '#6a76b0', '#f2c66d', 90, 'pajama'),
  C('bot_chef', 'Pantalón de cocina', 'bottom', 'pants', '#2f2b38', '#4a4456', 0, 'chef'),
  // ---- shoes
  C('sh_sneakers', 'Zapatillas', 'shoes', 'shoes', '#f3e6c8', '#b2585e', 0, 'casual'),
  C('sh_boots', 'Botas de lluvia', 'shoes', 'boots', '#c9a24a', '#8a6a2a', 90, 'winter'),
  C('sh_mary', 'Guillerminas', 'shoes', 'shoes', '#3a2a2a', '#6b4330', 100, 'elegant'),
  C('sh_geta', 'Geta', 'shoes', 'sandals', '#8a5a3c', '#b2585e', 110, 'japanese'),
  C('sh_slippers', 'Pantuflas conejo', 'shoes', 'slippers', '#f6ecd6', '#e8b8c0', 90, 'pajama'),
  C('sh_goth_boots', 'Botas plataforma', 'shoes', 'boots', '#2a2230', '#5d4f5f', 140, 'gothic'),
  // ---- head
  C('hd_beanie', 'Gorro de lana', 'head', 'beanie', '#c27f86', '#f6ecd6', 90, 'winter'),
  C('hd_beret', 'Boina', 'head', 'beret', '#3b4470', '#2c3358', 120, 'elegant'),
  C('hd_straw', 'Sombrero de paja', 'head', 'straw', '#e8cf8f', '#b2585e', 110, 'summer'),
  C('hd_bow', 'Moño', 'head', 'bow', '#d9a3a6', '#c27f86', 80, 'cozy'),
  C('hd_flower', 'Flor de cerezo', 'head', 'flower', '#f4c6cf', '#f2c66d', 80, 'japanese'),
  C('hd_chef', 'Gorro de chef', 'head', 'chefhat', '#fbf6ea', '#d8cdb5', 0, 'chef'),
  C('hd_catears', 'Vincha de gatito', 'head', 'catears', '#2e2638', '#e8b8c0', 120, 'animal'),
  C('hd_witch', 'Sombrero de bruja suave', 'head', 'witch', '#3a2f4f', '#b7a8d6', 170, 'gothic'),
  C('hd_frog', 'Capucha de rana', 'head', 'frog', '#8fb36e', '#f6ecd6', 180, 'animal', 'market'),
  C('hd_raccoon', 'Capucha de mapache', 'head', 'raccoonhat', '#8d8a93', '#3a3440', 0, 'animal', 'event'),
  C('hd_bandana', 'Pañuelo', 'head', 'bandana', '#b2585e', '#f6ecd6', 80, 'chef'),
  C('hd_star_clip', 'Hebilla de estrella', 'head', 'starclip', '#f2c66d', '#c9a24a', 0, 'cozy', 'event'),
  // ---- face
  C('fc_glasses', 'Anteojos', 'face', 'glasses', '#3a2a2a', '#cfe0ef', 90, 'casual'),
  C('fc_round', 'Anteojos redondos', 'face', 'roundglasses', '#a07116', '#cfe0ef', 110, 'elegant'),
  C('fc_sun', 'Lentes de sol', 'face', 'sunglasses', '#2a2230', '#3b4470', 100, 'summer'),
  C('fc_blush', 'Rubor extra', 'face', 'blush', '#e58f98', undefined, 80, 'cozy'),
  // ---- extra
  C('ex_scarf_red', 'Bufanda roja', 'extra', 'scarf', '#b2585e', '#8e3e46', 90, 'winter'),
  C('ex_scarf_sage', 'Bufanda salvia', 'extra', 'scarf', '#7c9a7b', '#5f7c5e', 90, 'cozy'),
  C('ex_apron', 'Delantal', 'extra', 'apron', '#f6ecd6', '#d9a3a6', 0, 'chef'),
  C('ex_necklace', 'Collar de concha', 'extra', 'necklace', '#f4d7d0', '#f2c66d', 120, 'summer'),
  C('ex_cape', 'Capa nocturna', 'extra', 'cape', '#2c3358', '#b7a8d6', 180, 'gothic'),
  // ---- bag
  C('bg_backpack', 'Mochila', 'bag', 'backpack', '#b2585e', '#7c3a40', 120, 'casual'),
  C('bg_satchel', 'Bolso cruzado', 'bag', 'satchel', '#8a5a3c', '#f2c66d', 110, 'cozy'),
  C('bg_raccoon', 'Mochila mapache', 'bag', 'raccoonpack', '#8d8a93', '#3a3440', 0, 'animal', 'event'),
];

export const CLOTHES_BY_ID: Record<string, ClothingDef> = Object.fromEntries(CLOTHES.map((c) => [c.id, c]));

export const STARTER_CLOTHES = CLOTHES.filter((c) => c.price === 0 && !c.unlock && c.shop === 'yuki').map((c) => c.id);
