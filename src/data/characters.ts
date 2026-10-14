import type { Appearance } from '../core/types';
import type { Dir } from '../core/types';

/** Poses a character can hold. Walking is separate: it is just moving between these. */
export type NpcAct = 'sleep' | 'cook' | 'read' | 'sit' | 'play' | 'work' | 'fish' | 'paint' | 'stars' | 'eat' | 'drink' | 'clean' | 'talk' | 'look';

export interface RoutineStop {
  zone: string;
  x: number;
  y: number;
  wander?: number;     // tiles around the anchor the NPC strolls
  act?: NpcAct;
  /** Visual seating lift; pathfinding still targets the free tile in front of a bench. */
  seatLift?: number;
  /** Tiles of the bed they sleep in; the actor is drawn lying in it once settled. */
  bed?: { x: number; y: number; w: number; h: number };
  dir?: Dir;
  /** Safe alternate destinations for shared work/rest areas. */
  alternatives?: [number, number][];
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  raccoon?: boolean;
  appearance: Appearance;
  drop?: number[];
  loves: string[];
  likes: string[];
  dislikes: string[];
  /** one routine stop per period: morning, afternoon, dusk, night */
  routine: [RoutineStop, RoutineStop, RoutineStop, RoutineStop];
  bio: string;
  birthday: number; // internal calendar day of season (season index * 100 + day)
  voice: number;    // pitch for blip sounds
  rainSpot?: RoutineStop; // where they shelter on rainy days
  needsFlag?: string;     // NPC appears only after this flag
}

const A = (o: Partial<Appearance> & Pick<Appearance, 'species' | 'skin'>): Appearance => ({
  hairStyle: 6, hairColor: '#5b3a2e', eyes: 0, eyeColor: '#2a2230', top: '', bottom: '', shoes: '', head: '', face: '', extra: '', bag: '', ...o,
});

export const CHARACTERS: CharacterDef[] = [
  // ---------------------------------------------------------- raccoons
  {
    id: 'pip', name: 'Pip', title: 'El grandote tierno', raccoon: true,
    // big chubby grey plush with a dark stripe on the forehead (bottom of the photo)
    appearance: A({ species: 'raccoon', skin: '#8e8d96', eyes: 1, eyeColor: '#2a2230', hairStyle: 6, marks: { mask: '#55545e', face: '#ecebef', stripe: '#6c6b75', belly: '#ecebef', arms: '#6c6b75', ear: '#ecebef' } }),
    drop: [],
    loves: ['g_blanket', 'g_candy', 'spoon', 'sh_pearl', 'st_quartz', 'plush_raccoon'],
    likes: ['berry', 'mango', 'fl_daisy', 'b_firefly', 'sh_pink', 'st_seaglass'],
    dislikes: ['wasabi', 'chili', 'stone'],
    routine: [
      { zone: 'plaza', x: 7, y: 9, wander: 3, act: 'play' },
      { zone: 'restaurant', x: 10, y: 8, wander: 3, act: 'work' },
      { zone: 'garden', x: 12, y: 11, wander: 3, act: 'play' },
      { zone: 'home', x: 10, y: 4, wander: 1, act: 'sleep' },
    ],
    bio: 'Grandote, cariñoso, torpe y curioso. Colecciona cosas brillantes y regala tesoros dudosos.',
    birthday: 105, voice: 1.5, rainSpot: { zone: 'restaurant', x: 11, y: 9, wander: 1, act: 'sit' },
  },
  {
    id: 'spicy', name: 'Spicy Beacon', title: 'Chef dramático', raccoon: true,
    // the smallest one: light grey, white muzzle, dark ear tips (top of the photo)
    appearance: A({ species: 'raccoon', skin: '#a3a1a8', eyes: 2, eyeColor: '#7a4a2a', head: 'hd_bandana', extra: 'ex_apron', hairStyle: 6, marks: { mask: '#2a2230', face: '#f6f3ee', belly: '#f6f3ee', arms: '#8d8b92', ear: '#2a2230' } }),
    drop: [5, 6, 14, 16, 18, 20],
    loves: ['g_hotsauce', 'chili', 'eel', 'roe', 'starfruit'],
    likes: ['tuna', 'salmon', 'wasabi', 'shiitake', 'f_tuna', 'ginger'],
    dislikes: ['fl_daisy', 'sh_scallop'],
    routine: [
      { zone: 'restaurant', x: 3, y: 3, wander: 1, act: 'cook' },
      { zone: 'restaurant', x: 4, y: 4, wander: 1, act: 'cook' },
      { zone: 'beach', x: 7, y: 9, wander: 2, act: 'work' },
      { zone: 'home', x: 17, y: 5, wander: 1, act: 'sleep' },
    ],
    bio: 'El más chiquito y el más ruidoso: excéntrico, teatral y brillante en la cocina. Cree que todo mejora con un poquito (mucho) de picante.',
    birthday: 212, voice: 1.1, rainSpot: { zone: 'restaurant', x: 3, y: 3, wander: 1, act: 'cook' },
  },
  {
    id: 'rigg', name: 'Rigg', title: 'La observadora', raccoon: true,
    // reddish-brown fur, big black eye patches, black arms, white face (middle of the photo)
    appearance: A({ species: 'raccoon', skin: '#a65f3c', eyes: 2, eyeColor: '#3f8a5a', extra: 'ex_necklace', hairStyle: 6, marks: { mask: '#1f1a22', face: '#f6f3ee', belly: '#f6f3ee', arms: '#1f1a22', ear: '#f6f3ee' } }),
    drop: [14, 16],
    loves: ['g_book', 'g_tea', 'st_amethyst', 'b_star', 'fl_moon'],
    likes: ['bottle_msg', 'f_koi', 'b_moth', 'fl_camellia', 'g_candy'],
    dislikes: ['g_hotsauce', 'b_beetle'],
    routine: [
      { zone: 'restaurant', x: 14, y: 10, wander: 0, act: 'read' },
      { zone: 'plaza', x: 10, y: 22, wander: 2, act: 'read' },
      { zone: 'restaurant', x: 14, y: 10, wander: 1, act: 'read' },
      { zone: 'home', x: 24, y: 4, wander: 1, act: 'read' },
    ],
    bio: 'Reservada, inteligente y leal. Le interesan los mapas, los acertijos y los secretos de Villa Nori.',
    birthday: 311, voice: 0.85, rainSpot: { zone: 'restaurant', x: 14, y: 10, wander: 0, act: 'read' },
  },
  // ---------------------------------------------------------- villagers
  {
    id: 'momo', name: 'Momo', title: 'Florista',
    appearance: A({ species: 'cat', skin: '#f3e6c8', eyes: 4, eyeColor: '#6f9e5a', top: 'top_cardigan_moss', bottom: 'bot_dress_sage', shoes: 'sh_mary', head: 'hd_flower' }),
    loves: ['fl_lily', 'fl_moon', 'sakura', 'g_tea'], likes: ['fl_tulip', 'fl_bell', 'fl_daisy', 'b_white'], dislikes: ['f_sardine', 'chili'],
    routine: [
      { zone: 'garden', x: 15, y: 11, wander: 3, act: 'work' },
      { zone: 'plaza', x: 20, y: 10, wander: 2 },
      { zone: 'garden', x: 13, y: 9, wander: 1, act: 'sit' },
      { zone: 'plaza', x: 4, y: 14, wander: 0, act: 'sleep' },
    ],
    bio: 'Tranquila y un poco tímida. Cuida el Jardín de los Faroles.', birthday: 110, voice: 1.3,
  },
  {
    id: 'taro', name: 'Taro', title: 'Comerciante',
    appearance: A({ species: 'fox', skin: '#d8874f', eyes: 0, eyeColor: '#2a2230', top: 'top_kimono_indigo', bottom: 'bot_hakama', shoes: 'sh_geta' }),
    loves: ['sh_pearl', 'st_amethyst', 'f_koi'], likes: ['st_quartz', 'sh_pink', 'g_candy', 'eel'], dislikes: ['stone', 'wood'],
    routine: [
      { zone: 'shop_taro', x: 5, y: 3, wander: 0 },
      { zone: 'shop_taro', x: 5, y: 3, wander: 0 },
      { zone: 'plaza', x: 16, y: 15, wander: 3 },
      { zone: 'market', x: 10, y: 6, wander: 1, act: 'work' },
    ],
    bio: 'Simpático y negociante. Siempre conoce el último rumor.', birthday: 205, voice: 1.0,
  },
  {
    id: 'yuki', name: 'Yuki', title: 'Costurera',
    appearance: A({ species: 'bunny', skin: '#fbf6ea', eyes: 4, eyeColor: '#c27f86', top: 'top_blouse_elegant', bottom: 'bot_skirt_plaid', shoes: 'sh_mary', head: 'hd_bow', hairStyle: 6 }),
    loves: ['sh_pink', 'b_sakura', 'fl_tulip'], likes: ['g_candy', 'sh_cowrie', 'st_quartz'], dislikes: ['shiitake', 'f_mackerel'],
    routine: [
      { zone: 'shop_yuki', x: 5, y: 3, wander: 0 },
      { zone: 'shop_yuki', x: 5, y: 3, wander: 0 },
      { zone: 'plaza', x: 13, y: 15, wander: 0, act: 'sit' },
      { zone: 'plaza', x: 26, y: 7, wander: 0, act: 'sleep' },
    ],
    bio: 'Creativa y perfeccionista. Cose toda la ropa del pueblo.', birthday: 120, voice: 1.4,
  },
  {
    id: 'kumo', name: 'Kumo', title: 'Bibliotecario',
    appearance: A({ species: 'cat', skin: '#5d5864', eyes: 3, eyeColor: '#f2c66d', top: 'top_goth_lace', bottom: 'bot_pants_brown', shoes: 'sh_mary', face: 'fc_glasses' }),
    loves: ['g_book', 'bottle_msg', 'g_tea'], likes: ['st_amethyst', 'b_moth', 'fl_bell'], dislikes: ['g_hotsauce', 'b_beetle'],
    routine: [
      { zone: 'plaza', x: 11, y: 21, wander: 1, act: 'read' },
      { zone: 'plaza', x: 11, y: 21, wander: 1, act: 'read' },
      { zone: 'restaurant', x: 13, y: 7, wander: 0, act: 'sit' },
      { zone: 'plaza', x: 11, y: 21, wander: 0, act: 'sleep' },
    ],
    bio: 'Reservado y erudito. Conoce la historia de Villa Nori mejor que nadie... o eso dice.', birthday: 301, voice: 0.8,
  },
  {
    id: 'nami', name: 'Nami', title: 'Pescadora',
    appearance: A({ species: 'otter', skin: '#a8734d', eyes: 2, eyeColor: '#2a2230', top: 'top_stripes_navy', bottom: 'bot_overalls', shoes: 'sh_boots', head: 'hd_straw' }),
    loves: ['f_moonfish', 'sh_pearl', 'f_octopus'], likes: ['f_sardine', 'f_mackerel', 'sh_blue', 'sh_spiral'], dislikes: ['fl_sun', 'cream'],
    routine: [
      { zone: 'beach', x: 20, y: 17, wander: 1, act: 'fish' },
      { zone: 'beach', x: 6, y: 9, wander: 1, act: 'work' },
      { zone: 'beach', x: 16, y: 12, wander: 3 },
      { zone: 'beach', x: 26, y: 7, wander: 0, act: 'sleep' },
    ],
    bio: 'Alegre y aventurera. Enseña a pescar a cualquiera que tenga paciencia.', birthday: 208, voice: 1.25, needsFlag: 'unlock_beach',
  },
  {
    id: 'hoshi', name: 'Hoshi', title: 'Astrónoma',
    appearance: A({ species: 'owl', skin: '#b39c78', eyes: 2, eyeColor: '#f2c66d', top: 'top_pajama_star', bottom: 'bot_dress_goth', shoes: 'sh_mary', head: 'hd_witch' }),
    loves: ['b_star', 'fl_moon', 'f_moonfish', 'moonpearl'], likes: ['st_amethyst', 'b_moth', 'g_tea'], dislikes: ['f_puffer'],
    routine: [
      { zone: 'plaza', x: 10, y: 21, wander: 0, act: 'sleep' },
      { zone: 'plaza', x: 14, y: 21, wander: 2, act: 'read' },
      { zone: 'garden', x: 19, y: 13, wander: 2 },
      { zone: 'plaza', x: 16, y: 9, wander: 1, act: 'stars' },
    ],
    bio: 'Estudia el cielo de noche y duerme de día. Habla de las estrellas como si fueran vecinas.', birthday: 313, voice: 0.95, needsFlag: 'met_hoshi',
  },
  {
    id: 'bento', name: 'Bento', title: 'Panadero',
    appearance: A({ species: 'bear', skin: '#8a5a3c', eyes: 1, eyeColor: '#2a2230', top: 'top_chef', bottom: 'bot_pants_brown', shoes: 'sh_boots', extra: 'ex_apron' }),
    loves: ['berry', 'mango', 'g_candy'], likes: ['egg', 'fl_sun', 'g_tea'], dislikes: ['f_puffer', 'wasabi'],
    routine: [
      { zone: 'shop_bento', x: 5, y: 3, wander: 0 },
      { zone: 'shop_bento', x: 5, y: 3, wander: 0 },
      { zone: 'restaurant', x: 9, y: 10, wander: 0, act: 'sit' },
      { zone: 'plaza', x: 5, y: 19, wander: 0, act: 'sleep' },
    ],
    bio: 'Enorme, amable y apasionado por hornear. Su pan de leche es famoso.', birthday: 403, voice: 0.7,
  },
  {
    id: 'sumi', name: 'Sumi', title: 'Artista',
    appearance: A({ species: 'fox', skin: '#c9a0a0', eyes: 4, eyeColor: '#3b4470', top: 'top_kimono_sakura', bottom: 'bot_pants_brown', shoes: 'sh_sneakers', head: 'hd_beret' }),
    loves: ['fl_star', 'b_sakura', 'st_quartz'], likes: ['fl_tulip', 'sh_pink', 'sakura'], dislikes: ['f_mackerel', 'stone'],
    routine: [
      { zone: 'plaza', x: 21, y: 21, wander: 2, act: 'paint' },
      { zone: 'garden', x: 18, y: 12, wander: 2, act: 'paint' },
      { zone: 'beach', x: 13, y: 12, wander: 1, act: 'paint' },
      { zone: 'plaza', x: 21, y: 21, wander: 0, act: 'sleep' },
    ],
    bio: 'Pinta paisajes y vende cuadros y decoraciones. Ve colores donde otros no.', birthday: 122, voice: 1.2,
  },
  {
    id: 'kiki', name: 'Kiki', title: 'Exploradora',
    appearance: A({ species: 'squirrel', skin: '#c9784a', eyes: 2, eyeColor: '#2a2230', top: 'top_tee_sage', bottom: 'bot_shorts_sand', shoes: 'sh_boots', bag: 'bg_backpack' }),
    loves: ['berry', 'st_amethyst', 'b_blue'], likes: ['shiitake', 'wood', 'b_beetle'], dislikes: ['cream', 'fl_lily'],
    routine: [
      { zone: 'plaza', x: 16, y: 3, wander: 2 },
      { zone: 'forest', x: 14, y: 15, wander: 4 },
      { zone: 'forest', x: 10, y: 12, wander: 3 },
      { zone: 'plaza', x: 16, y: 3, wander: 0, act: 'sleep' },
    ],
    bio: 'Inquieta y valiente. Conoce todos los caminos secretos de Villa Nori.', birthday: 215, voice: 1.45,
  },
  {
    id: 'sora', name: 'Sora', title: 'Cartero',
    appearance: A({ species: 'dog', skin: '#e0c08a', eyes: 0, eyeColor: '#2a2230', top: 'top_winter_coat', bottom: 'bot_jeans', shoes: 'sh_sneakers', bag: 'bg_satchel', head: 'hd_beret' }),
    loves: ['g_candy', 'berry', 'bottle_msg'], likes: ['fl_sun', 'egg', 'g_tea'], dislikes: ['b_ladybug'],
    routine: [
      { zone: 'plaza', x: 10, y: 6, wander: 4 },
      { zone: 'plaza', x: 20, y: 12, wander: 6 },
      { zone: 'beach', x: 15, y: 5, wander: 3 },
      { zone: 'plaza', x: 9, y: 5, wander: 0, act: 'sleep' },
    ],
    bio: 'Entrega cartas y encargos con una puntualidad admirable.', birthday: 401, voice: 1.15,
  },
  {
    id: 'ume', name: 'Abuela Ume', title: 'Vecina de toda la vida',
    appearance: A({ species: 'human', skin: '#efcfb0', hairStyle: 3, hairColor: '#d8d2c8', eyes: 3, eyeColor: '#5d4037', top: 'top_kimono_indigo', bottom: 'bot_hakama', shoes: 'sh_geta', face: 'fc_round' }),
    loves: ['g_tea', 'fl_camellia', 'umeboshi'], likes: ['fl_daisy', 'egg', 'g_candy'], dislikes: ['chili', 'g_hotsauce'],
    routine: [
      { zone: 'garden', x: 13, y: 8, wander: 0, act: 'sit' },
      { zone: 'restaurant', x: 9, y: 7, wander: 0, act: 'sit' },
      { zone: 'plaza', x: 18, y: 14, wander: 0, act: 'sit' },
      { zone: 'plaza', x: 18, y: 14, wander: 0, act: 'sleep' },
    ],
    bio: 'Conoció al antiguo dueño de Midnight Maki. Recuerda más de lo que cuenta.', birthday: 410, voice: 0.9,
  },
  {
    id: 'akio', name: 'Akio', title: 'El antiguo dueño',
    appearance: A({ species: 'human', skin: '#e8c4a4', hairStyle: 2, hairColor: '#d8d2c8', eyes: 3, eyeColor: '#5d4037', top: 'top_kimono_indigo', bottom: 'bot_pants_brown', shoes: 'sh_geta', extra: 'ex_scarf_sage' }),
    loves: ['g_tea', 'fl_camellia', 'f_koi'], likes: ['g_book', 'egg', 'umeboshi'], dislikes: ['g_hotsauce'],
    routine: [
      { zone: 'garden', x: 12, y: 9, wander: 1, act: 'sit' },
      { zone: 'restaurant', x: 13, y: 7, wander: 0, act: 'sit' },
      { zone: 'beach', x: 16, y: 12, wander: 1 },
      { zone: 'restaurant', x: 13, y: 7, wander: 0, act: 'sleep' },
    ],
    bio: 'Fundó Midnight Maki y cuidó el faro durante años. Ahora vuelve de visita.', birthday: 207, voice: 0.75, needsFlag: 'akio_visit',
  },
];

export const CHAR_BY_ID: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
if (CHAR_BY_ID.sumi) CHAR_BY_ID.mika = CHAR_BY_ID.sumi; // backwards compatibility alias for legacy saves
export const RACCOONS = ['pip', 'spicy', 'rigg'];
export const VILLAGERS = CHARACTERS.filter((c) => !c.raccoon).map((c) => c.id);
