/** Static world props (not part of the decoration catalog). Footprint in tiles, sprite in px. */
export interface PropDef {
  kind: string;
  c1: string;
  c2: string;
  w: number;
  h: number;
  sw: number; // sprite width px
  sh: number; // sprite height px
  solid: boolean;
  variant?: number;
  light?: string;
  anim?: 'sway' | 'flicker' | 'water';
}

const P = (kind: string, w: number, h: number, sw: number, sh: number, c1 = '', c2 = '', extra: Partial<PropDef> = {}): PropDef => ({
  kind, w, h, sw, sh, c1, c2, solid: true, ...extra,
});

export const PROPS: Record<string, PropDef> = {
  tree: P('tree', 1, 1, 44, 56, '#46a846', '', { anim: 'sway' }),
  tree_dark: P('tree', 1, 1, 44, 56, '#4f7a52', '', { anim: 'sway' }),
  tree_autumn: P('tree', 1, 1, 44, 56, '#d08a4f', '', { anim: 'sway' }),
  sakura: P('sakura', 1, 1, 44, 56, '', '', { anim: 'sway' }),
  pine: P('pine', 1, 1, 32, 50, '#46a846'),
  bush: P('bush', 1, 1, 18, 15, '#46a846', '#46a846'),
  bush_berry: P('bush', 1, 1, 18, 15, '#46a846', '#e0424f'),
  bush_flower: P('bush', 1, 1, 18, 15, '#46a846', '#f7f0f4'),
  rock: P('rock', 1, 1, 16, 12, '#a59f9a'),
  bigrock: P('rock', 2, 1, 32, 18, '#8d8790'),
  stump: P('stump', 1, 1, 16, 12),
  mushroom: P('mushroom', 1, 1, 16, 12, '#b2585e', '', { solid: false }),
  flowers: P('flowers', 1, 1, 16, 14, '#f47fa0', '#ffffff', { solid: false }),
  flowers_lav: P('flowers', 1, 1, 16, 14, '#a98ae6', '#ffd36a', { solid: false }),
  reeds: P('reeds', 1, 1, 16, 16, '#5db449', '', { solid: false }),
  lamppost: P('lamppost', 1, 1, 16, 32, '', '', { light: '#f4d68c' }),
  stonelantern: P('stonelantern', 1, 1, 16, 24, '', '', { light: '#f4d68c' }),
  lantern_red: P('paperlantern', 1, 1, 16, 26, '#d9675f', '', { light: '#f4b08c', solid: false, anim: 'sway' }),
  lantern_cream: P('paperlantern', 1, 1, 16, 26, '#f3e6c8', '', { light: '#f4d68c', solid: false, anim: 'sway' }),
  fence: P('fence', 1, 1, 16, 16),
  sack: P('sack', 1, 1, 16, 16, '#d8b98a'),
  bench: P('bench', 2, 1, 32, 16, '#b07a4c'),
  sign: P('sign', 1, 1, 16, 18, '#a8734d'),
  board: P('board', 2, 1, 32, 28),
  crate: P('crate', 1, 1, 16, 16),
  barrel: P('barrel', 1, 1, 16, 16),
  well: P('well', 2, 1, 32, 34),
  mailbox: P('mailbox', 1, 1, 16, 20),
  fountain: P('fountain', 3, 2, 48, 42, '', '', { anim: 'water' }),
  stall_rose: P('stall', 3, 1, 48, 48, '#e04a4a', '#f8f4ec', { light: '#ffc070' }),
  stall_sage: P('stall', 3, 1, 48, 48, '#3fae55', '#8fd86a', { light: '#ffc070' }),
  stall_night: P('stall', 3, 1, 48, 48, '#3b4470', '#b7a8d6', { light: '#ffc070' }),
  stall_gold: P('stall', 3, 1, 48, 48, '#f2c66d', '#b2585e', { light: '#ffc070' }),
  boat: P('boat', 2, 1, 32, 32, '#a8734d'),
  torii: P('torii', 3, 1, 48, 42, '', '', { solid: false }),
  pier: P('pier', 1, 1, 16, 8, '', '', { solid: false }),
  stars: P('stars', 2, 1, 32, 16, '#f2c66d', '', { solid: false, light: '#f8e3a0' }),
  // street details
  vending_blue: P('vending', 1, 1, 16, 30, '#6f8fb8'),
  vending_red: P('vending', 1, 1, 16, 30, '#b8524f'),
  bicycle: P('bicycle', 2, 1, 28, 16, '#7fae5f'),
  bicycle_rose: P('bicycle', 2, 1, 28, 16, '#d9a3a6'),
  pot_rose: P('pot', 1, 1, 16, 18, '#6f9e5a', '#c27f86'),
  pot_cream: P('pot', 1, 1, 16, 18, '#7fae5f', '#d8c09a'),
  menuboard: P('menuboard', 1, 1, 16, 22),
  lanternstring: P('lanternstring', 4, 1, 64, 36, '#d9675f', '#f2c66d', { solid: false, light: '#ffb070' }),
  poster_a: P('poster', 1, 1, 14, 18, '#94c0d2', '#f2c66d', { solid: false }),
  poster_b: P('poster', 1, 1, 14, 18, '#e8a0b0', '#3b4470', { solid: false }),
  awning_rose: P('awning', 3, 1, 48, 10, '#d9a3a6', '#f6ecd6', { solid: false }),
  awning_sage: P('awning', 3, 1, 48, 10, '#9bb59a', '#f6ecd6', { solid: false }),
  puddle: P('puddle', 1, 1, 18, 8, '', '', { solid: false }),
  // kitchen & interior fixtures
  k_fridge: P('tansu', 1, 1, 16, 32),
  k_stove: P('konro', 1, 1, 16, 22, '', '', { light: '#f4b08c', anim: 'flicker' }),
  k_sink: P('sink', 1, 1, 16, 22),
  k_rice: P('hangiri', 1, 1, 16, 24),
  k_board: P('cuttingboard', 1, 1, 16, 22),
  k_counter: P('sushibar', 1, 1, 16, 28),
  k_register: P('sushibar', 1, 1, 16, 28, '', '', { variant: 1 }),
  k_register2: P('sushibar', 1, 1, 16, 28),
  // izakaya dressing
  bar_stool: P('stool', 1, 1, 16, 14, '#b8524f', '', { solid: false }),
  wallshelf: P('wallshelf', 2, 1, 32, 22, '', '', { solid: false }),
  mm_sign: P('mmsign', 5, 1, 80, 31, '', '', { solid: false }),
  wall_lantern_red: P('paperlantern', 1, 1, 16, 26, '#d9675f', '', { light: '#f4b08c', solid: false, anim: 'sway' }),
  wall_lantern_cream: P('paperlantern', 1, 1, 16, 26, '#f3e6c8', '', { light: '#f4d68c', solid: false, anim: 'sway' }),
  sake_barrel: P('sakebarrel', 1, 1, 16, 18, '#b8524f'),
  bamboo: P('bamboo', 1, 1, 16, 36, '#6f9e5a', '#3b4470'),
  andon: P('andon', 1, 1, 16, 28, '#f6e3b0', '', { light: '#f4d68c' }),
  stairs: P('stairs', 1, 1, 16, 16, '', '', { solid: false }),
  stairs_down: P('stairs', 1, 1, 16, 16, '', '', { solid: false, variant: 1 }),
  door_storage: P('walldoor', 1, 1, 16, 16, '', '', { variant: 0 }),
  door_storage_open: P('walldoor', 1, 1, 16, 16, '', '', { variant: 1 }),
  mechanism: P('mechanism', 3, 1, 48, 44),
  // buildings (variant selects details)
  bld_restaurant: P('building', 7, 3, 112, 90, '#f3e3c3', '#2f4f7a', { variant: 0 }),
  bld_clothes: P('building', 6, 3, 96, 80, '#f6e2d6', '#c25a6a', { variant: 1 }),
  bld_store: P('building', 6, 3, 96, 80, '#f3e3c3', '#2f6b4f', { variant: 2 }),
  bld_bakery: P('building', 6, 3, 96, 80, '#f6e8cc', '#b0533f', { variant: 2 }),
  bld_library: P('building', 6, 3, 96, 80, '#ece2f2', '#45507f', { variant: 4 }),
  bld_house: P('building', 5, 3, 80, 72, '#f3e3c3', '#2f6b4f', { variant: 2 }),
  bld_cabin: P('building', 5, 3, 80, 72, '#a8734d', '#4f6b52', { variant: 3 }),
  bld_station: P('building', 8, 3, 128, 80, '#a59f9a', '#5d5864', { variant: 5 }),
  bld_gallery: P('building', 5, 3, 80, 72, '#f6ecd6', '#7a5fb0', { variant: 2 }),
  lighthouse: P('lighthouse', 3, 2, 48, 112),
};
