/**
 * Intro sound registry. File names live only here.
 * Originals stay in src/story/Sounds/; the game plays the copies in public/audio/intro/.
 */
export type IntroSoundId =
  | 'rain_window'
  | 'city_night'
  | 'paper_slide_on_wood'
  | 'envelope_sliding'
  | 'paper_rustle'
  | 'small_key_drop'
  | 'suitcase_zipper'
  | 'wooden_footsteps'
  | 'steam_train'
  | 'small_town'
  | 'water_fountain'
  | 'wooden_door'
  | 'metal_jar';

export type IntroSoundKind = 'bed' | 'shot';

export const INTRO_SOUNDS: Record<IntroSoundId, { file: string; kind: IntroSoundKind }> = {
  rain_window: { file: 'rain_window.mp3', kind: 'bed' },
  city_night: { file: 'city_night.mp3', kind: 'bed' },
  small_town: { file: 'small_town.mp3', kind: 'bed' },
  water_fountain: { file: 'water_fountain.mp3', kind: 'bed' },
  paper_slide_on_wood: { file: 'paper_slide_on_wood.mp3', kind: 'shot' },
  envelope_sliding: { file: 'envelope_sliding.mp3', kind: 'shot' },
  paper_rustle: { file: 'paper_rustle.mp3', kind: 'shot' },
  small_key_drop: { file: 'small_key_drop.mp3', kind: 'shot' },
  suitcase_zipper: { file: 'suitcase_zipper.mp3', kind: 'shot' },
  wooden_footsteps: { file: 'wooden_footsteps.mp3', kind: 'shot' },
  steam_train: { file: 'steam_train.mp3', kind: 'shot' },
  wooden_door: { file: 'wooden_door.mp3', kind: 'shot' },
  metal_jar: { file: 'metal_jar.mp3', kind: 'shot' },
};

export function introSoundUrl(id: IntroSoundId): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}audio/intro/${INTRO_SOUNDS[id].file}`;
}
