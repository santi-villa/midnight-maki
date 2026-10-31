/**
 * The ambient neighbours of Villa Nori: people with a name, a look, a personality, favourite places, a house and a few
 * friends. They have no quests; they make the village feel lived in. Their day is planned by `systems/neighborPlan.ts`.
 */
import type { Appearance } from '../core/types';
import { HOUSES } from './houses';

export type Trait = 'shy' | 'sociable' | 'adventurous' | 'hardworking' | 'nocturnal' | 'sporty';
export type Like = 'bench' | 'sea' | 'shop' | 'read' | 'garden' | 'forest' | 'market' | 'fountain';

export interface Neighbor {
  id: string;
  name: string;
  job: string;
  look: Appearance;
  traits: Trait[];
  /** where they like to spend free time */
  likes: Like[];
  /** the shop where they work or shop most (zone id) */
  shop?: string;
  friends: string[];
  bike?: boolean;
  /** house id (an interior zone) */
  home: string;
  /** things they say when someone passes by */
  lines: string[];
}

/** Ren's carpentry stall in the plaza: the prop's top-left tile; the counter is the row below it. */
export const REN_STALL = { x: 38, y: 23 } as const;

const look = (species: Appearance['species'], skin: string, hairColor: string, top: string, extra: Partial<Appearance> = {}): Appearance =>
  ({ species, skin, hairStyle: 1, hairColor, eyes: 0, eyeColor: '#3b2a22', top, bottom: '', shoes: '', head: '', face: '', extra: '', bag: '', ...extra });

const H = HOUSES.map((h) => h.id);

export const NEIGHBORS: Neighbor[] = [
  { id: 'ren', name: 'Ren', job: 'Carpintero', look: look('bear', '#8a6a4a', '#2b2231', 'top_cardigan_moss'), traits: ['hardworking'], likes: ['bench', 'sea'], shop: 'plaza_ren', friends: ['mika'], home: H[0],
    lines: ['Hoy hay buena madera.', 'Si algo cruje, avisame.', 'Madera y piedra, si necesitás para el restaurante.'] },
  { id: 'mika', name: 'Mika', job: 'Repartidora', look: look('cat', '#e2a96b', '#a8503a', 'top_tee_sage'), traits: ['sporty', 'sociable'], likes: ['fountain', 'sea'], friends: ['ren', 'tomo'], bike: true, home: H[1],
    lines: ['¡Voy con el tiempo justo!', 'La bici hoy anda de maravilla.'] },
  { id: 'haru', name: 'Haru', job: 'Estudiante', look: look('bunny', '#f0e6d8', '#5b3a2e', 'top_hoodie_lav'), traits: ['shy'], likes: ['read', 'bench'], shop: 'library', friends: ['nene'], home: H[2],
    lines: ['Perdón... ¿te estorbo?', 'Estoy leyendo un libro lindísimo.'] },
  { id: 'tomo', name: 'Tomo', job: 'Pescador', look: look('otter', '#6b5444', '#2b2231', 'top_stripes_navy'), traits: ['adventurous'], likes: ['sea', 'forest'], friends: ['mika', 'goro'], home: H[3],
    lines: ['El mar está tranquilo hoy.', 'Uno de estos días pesco algo enorme.'] },
  { id: 'nene', name: 'Nene', job: 'Florista aprendiz', look: look('squirrel', '#c27f86', '#5b3a2e', 'top_sweater_rose'), traits: ['sociable'], likes: ['garden', 'fountain'], shop: 'shop_yuki', friends: ['haru', 'mame'], home: H[4],
    lines: ['¿Viste los cerezos? ¡Preciosos!', 'Las flores no se riegan solas.'] },
  { id: 'goro', name: 'Goro', job: 'Jubilado', look: look('dog', '#b9764b', '#c9c2b4', 'top_cardigan_moss'), traits: ['sociable'], likes: ['bench', 'sea'], friends: ['tomo', 'fuyu'], home: H[5],
    lines: ['En mis tiempos esto era todo pasto.', 'Sentate un rato, no hay apuro.'] },
  { id: 'fuyu', name: 'Fuyu', job: 'Té de la tarde', look: look('owl', '#8a8f9a', '#8a8f9a', 'top_kimono_sakura'), traits: ['nocturnal', 'shy'], likes: ['market', 'bench'], friends: ['goro'], home: H[6],
    lines: ['De noche el pueblo es otro.', 'Shh... escuchá el viento.'] },
  { id: 'sato', name: 'Sato', job: 'Cartero de barrio', look: look('fox', '#e2a96b', '#2b2231', 'top_tee_cream'), traits: ['hardworking', 'sporty'], likes: ['fountain'], shop: 'shop_bento', friends: [], bike: true, home: H[7],
    lines: ['Cartas para todos, menos para mí.', '¡Permiso, permiso!'] },
  { id: 'mame', name: 'Mame', job: 'Ayudante de panadería', look: look('bunny', '#fbf4e2', '#c9a24a', 'top_tee_cream'), traits: ['sociable', 'hardworking'], likes: ['bench', 'fountain'], shop: 'shop_bento', friends: ['nene'], home: H[8],
    lines: ['¡Pan calentito!', 'Hoy se me quemó uno, shhh.'] },
  { id: 'kai', name: 'Kai', job: 'Fotógrafo', look: look('dog', '#6b5444', '#2b2231', 'top_hoodie_lav'), traits: ['adventurous', 'nocturnal'], likes: ['forest', 'garden', 'sea'], friends: [], home: H[9],
    lines: ['La luz de ahora es perfecta.', '¿Me dejás sacarte una foto? Es broma.'] },
  { id: 'rin', name: 'Rin', job: 'Corredora', look: look('cat', '#e8e0d4', '#a8503a', 'top_tee_sage'), traits: ['sporty', 'adventurous'], likes: ['sea', 'forest'], friends: ['kai'], bike: true, home: H[10],
    lines: ['Veinte vueltas y sigo.', 'El que madruga ve el mar despertar.'] },
  { id: 'oto', name: 'Oto', job: 'Músico', look: look('bear', '#b9764b', '#5b3a2e', 'top_kimono_indigo'), traits: ['shy', 'nocturnal'], likes: ['bench', 'garden'], friends: ['fuyu'], home: H[11],
    lines: ['Estoy componiendo algo para el faro.', 'Mm-mm-mm... ¿te molesta si tarareo?'] },
];
export const NEIGHBOR_BY_ID: Record<string, Neighbor> = Object.fromEntries(NEIGHBORS.map((n) => [n.id, n]));
