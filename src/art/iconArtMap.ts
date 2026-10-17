/** Which hand-made icon (art/iconArt.ts) a recipe or item uses instead of the drawn one. Anything not listed keeps its drawn icon. */
export const ICON_ART: Record<string, string> = {
  // recipes → Sushi 16×16
  kappa: 'sushi_cucumber_maki', sake_maki: 'sushi_salmon_maki', tamago: 'sushi_egg_nigiri', california: 'sushi_california_roll_uramaki',
  sake_nigiri: 'sushi_salmon_nigiri', philadelphia: 'sushi_salmon_uramaki', avocado_roll: 'sushi_avocado_uramaki', ebi: 'sushi_shrimp_nigiri',
  futomaki: 'sushi_tekka_maki', temaki: 'sushi_temaki', gunkan: 'sushi_gunkan_maki', veggie_roll: 'sushi_avocado_maki', crunchy: 'sushi_crab_maki',
  spicy_beacon: 'sushi_temaki_2', rainbow: 'sushi_rainbow_roll_uramaki', dragon: 'sushi_octopus_nigiri', moonlight: 'sushi_white_fish_nigiri',
  nori_deluxe: 'sushi_tuna_nigiri', spicy_egg: 'sushi_tamago_egg_maki', sakura_roll: 'sushi_red_nigiri', secret_maki: 'sushi_white_fish_nigiri_2',
  // fish, shells and sea finds → Fishing Icon Pack 16×16
  f_sardine: 'fish_16', f_mackerel: 'fish_13', f_salmon: 'fish_37', f_tuna: 'fish_14', f_carp: 'fish_4', f_trout: 'fish_27', f_puffer: 'fish_39',
  f_octopus: 'fish_57', f_koi: 'fish_3', f_moonfish: 'fish_15', f_eel: 'fish_60', f_starfish: 'fish_58',
  sh_scallop: 'fish_70', sh_spiral: 'fish_71', sh_cowrie: 'fish_69', sh_pink: 'fish_72', sh_pearl: 'fish_81',
  st_seaglass: 'fish_83', bottle_msg: 'fish_84',
  rod_basic: 'fish_6', rod_better: 'fish_7', rod_advanced: 'fish_8',
};
