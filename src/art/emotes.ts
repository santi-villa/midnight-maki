/** Speech-bubble emotes from LimeZu "Modern Interiors" UI (see scripts/build-ui-assets.py): one strip atlas, one row per emote. */
import Phaser from 'phaser';
import catalog from '../assets/ui/emotes.json';
import atlasURL from '../assets/ui/emotes.png';

export const EMOTE_ATLAS_KEY = 'ui-emotes';
export const EMOTE_ATLAS_URL = atlasURL;

interface Emote { y: number; w: number; h: number; frames: number; durations: number[] }
const emotes = catalog.emotes as Record<string, Emote>;

/** What the old text bubbles said, mapped to the pack's bubble. Anything else stays a text bubble. */
const GLYPHS: Record<string, string> = {
  '!': 'exclaim', '!!': 'angry', '¡!': 'alarm', '...': 'thinking', '…': 'thinking', '?': 'thinking',
  'z': 'sleep', 'z z z': 'sleep', '*': 'sparkle', '♪': 'music', '♥': 'heart', 'ñam': 'heart', 'té': 'heart',
  '✉': 'mail', ';_;': 'tear',
};

export function emoteFor(text: string): string | null {
  const name = GLYPHS[text.trim()];
  return name && emotes[name] ? name : null;
}

/** Cuts the atlas into frames and one animation per emote (stills are one frame). Call once the image is loaded. */
export function installEmotes(scene: Phaser.Scene) {
  if (!scene.textures.exists(EMOTE_ATLAS_KEY)) return;
  const tex = scene.textures.get(EMOTE_ATLAS_KEY);
  for (const [name, e] of Object.entries(emotes)) {
    for (let i = 0; i < e.frames; i++) tex.add(`${name}_${i}`, 0, i * e.w, e.y, e.w, e.h);
    const key = `emote_${name}`;
    if (e.frames > 1 && !scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: e.durations.map((d, i) => ({ key: EMOTE_ATLAS_KEY, frame: `${name}_${i}`, duration: d })),
        repeat: -1,
      });
    }
  }
}

export function hasEmotes(scene: Phaser.Scene) {
  return scene.textures.exists(EMOTE_ATLAS_KEY) && scene.textures.get(EMOTE_ATLAS_KEY).has('thinking_0');
}
