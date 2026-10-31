/** Palettes and outfits of every villager drawn with the detailed "folk" renderer (src/art/folk.ts). */
import type { FolkSpec } from '../art/folk';


export const FOLK_SPECS: Record<string, FolkSpec> = {
  spicy: {
    id: 'spicy', ears: 'round', fur: '#bab2b8', furLight: '#f4ece2', innerEar: '#d6a898', mask: '#5c5666', nose: '#241c22', eye: '#16141c', ink: '#1a1218',
    hat: { kind: 'bandana', c: '#c9482f', c2: '#962f24' },
    top: '#8d8b95', topLight: '#a9a7b1', legsColor: '#77757f', legs: 'pants', shoes: '#48414c', frameW: 45,
    tail: { kind: 'ringed', c: '#978b8f' },
    deco: [{ k: 'apron', c: '#f6e6d6', c2: '#e8b09e' }],
    belly: { c: '#ecd7c6' },
  },
  taro: {
    id: 'taro', ears: 'pointy', snout: 'fox', fur: '#e08a3a', furLight: '#f8e4c4', innerEar: '#f3c9a4', blush: '#e09078', nose: '#3a2424', eye: '#2b2330',
    top: '#3c5ea8', topLight: '#6d90d4', legsColor: '#3a315c', legs: 'pants', shoes: '#6b4a32', frameW: 40,
    tail: { kind: 'bushy', c: '#e08a3a', tip: '#f7ead2' },
    deco: [{ k: 'kimono', c: '#e8c35a' }, { k: 'necklace', c: '#e8c35a' }],
  },
  pip: {
    id: 'pip', ears: 'round', fur: '#9e969e', furLight: '#f6e6d6', innerEar: '#8d6a63', mask: '#514a59', nose: '#3d3544', eye: '#1d1620',
    top: '#9e969e', topLight: '#bab5b8', legsColor: '#8b8693', legs: 'fur', shoes: '#5b5361', wide: 3.6, frameW: 45,
    tail: { kind: 'ringed', c: '#9a929b' },
    belly: { c: '#f2e4d3', rx: 8, ry: 4.2, y: 4.6 },
  },
  rigg: {
    id: 'rigg', ears: 'round', fur: '#c76a4c', furLight: '#f0d5be', innerEar: '#f0d5be', mask: '#3d2a30', nose: '#1d1b22', eye: '#110c10',
    top: '#c76a4c', topLight: '#d98466', legsColor: '#3b2628', legs: 'fur', shoes: '#3b2628', frameW: 45,
    tail: { kind: 'ringed', c: '#c0654a' },
    belly: { c: '#f0d5be' },
  },
  momo: {
    id: 'momo', ears: 'cat', snout: 'short', fur: '#f4e2c4', furLight: '#fff6e8', innerEar: '#f3b7b9', blush: '#f0a0a4', nose: '#d98b8b', eye: '#3d6b3a',
    hat: { kind: 'flower', c: '#f2a0b4', c2: '#f2c66d' },
    top: '#6ea056', topLight: '#9dcc78', legsColor: '#7eae62', legs: 'skirt', skirtC: '#7eae62', shoes: '#7a4e34',
    tail: { kind: 'thin', c: '#f4e2c4' },
    deco: [{ k: 'collar', c: '#fff8f0' }, { k: 'belt', c: '#e8d8a8' }],
  },
  yuki: {
    id: 'yuki', ears: 'long', snout: 'bunny', fur: '#fbf6ea', furLight: '#fffaf0', innerEar: '#f4b6c4', blush: '#f3a9ae', nose: '#e08a96', eye: '#5a3d4a',
    hat: { kind: 'bow', c: '#f090ab', c2: '#d0587e' },
    top: '#e06a80', topLight: '#f4a0b0', legsColor: '#c9435a', legs: 'skirt', skirtC: '#c9435a', shoes: '#7a4e34',
    tail: { kind: 'puff', c: '#ffffff' },
    deco: [{ k: 'collar', c: '#fff0f4' }, { k: 'buttons', c: '#fbf0f0' }],
  },
  kumo: {
    id: 'kumo', ears: 'cat', snout: 'short', fur: '#47434f', furLight: '#6a6574', innerEar: '#6f5f82', nose: '#2a2630', eye: '#f2c66d', glasses: '#2a2630', blush: '#8a6a78',
    top: '#efe6d4', topLight: '#fffaf2', legsColor: '#3a342c', legs: 'pants', shoes: '#2a2630',
    tail: { kind: 'thin', c: '#47434f' },
    deco: [{ k: 'vest', c: '#2e2a36', inner: '#efe6d4' }, { k: 'bowtie', c: '#8a6fc4' }],
  },
  nami: {
    id: 'nami', ears: 'round', snout: 'short', fur: '#b27c50', furLight: '#f0d2b4', innerEar: '#e7b89a', blush: '#e29a8a', nose: '#5b3a2a', eye: '#2b2330',
    hat: { kind: 'straw', c: '#e2b552', c2: '#c9482f' },
    top: '#f4e6d4', topLight: '#fff6ea', legsColor: '#2f5f98', legs: 'pants', shoes: '#e2b552', frameW: 38,
    tail: { kind: 'paddle', c: '#8d6240' },
    deco: [{ k: 'bib', c: '#2f5f98', strap: '#244878' }],
  },
  hoshi: {
    id: 'hoshi', ears: 'tuft', snout: 'owl', fur: '#b7a078', furLight: '#f3e6c4', innerEar: '#e7c8a8', nose: '#e0a04a', eye: '#f2c66d',
    hat: { kind: 'witch', c: '#6a4aa8', c2: '#4b3480' },
    top: '#5f3f9c', topLight: '#7a58b8', legsColor: '#4e3585', legs: 'robe', skirtC: '#573a92', shoes: '#2f2542', frameW: 40,
    tail: { kind: 'none' },
    deco: [{ k: 'robeTrim', c: '#e8c35a' }, { k: 'necklace', c: '#e8c35a' }],
  },
  bento: {
    id: 'bento', ears: 'round', snout: 'bear', fur: '#8a5a3c', furLight: '#e8c4a4', innerEar: '#c99a78', blush: '#d98a78', nose: '#2f1f1a', eye: '#2b2330',
    hat: { kind: 'chef', c: '#fbf6ee', c2: '#e6dccd' },
    top: '#f7f1e8', topLight: '#ffffff', legsColor: '#6b4630', legs: 'pants', shoes: '#4d3222', wide: 2.2, frameW: 38,
    tail: { kind: 'nub', c: '#6b4630' },
    deco: [{ k: 'apron', c: '#c4453a', c2: '#f2e2d4' }, { k: 'collar', c: '#f7f1e8' }],
  },
  sumi: {
    id: 'sumi', ears: 'pointy', snout: 'fox', fur: '#e3b0c4', furLight: '#fff0f4', innerEar: '#f3c4d4', blush: '#e48aa8', nose: '#8a4a62', eye: '#3b4470',
    hat: { kind: 'beret', c: '#6a4aa0', c2: '#f2c66d' },
    top: '#f7eef6', topLight: '#ffffff', legsColor: '#6a4aa0', legs: 'pants', shoes: '#f4f0f6', frameW: 40,
    tail: { kind: 'bushy', c: '#e3b0c4', tip: '#fff6f8' },
    deco: [{ k: 'bib', c: '#f7f1ea', strap: '#6a4aa0' }, { k: 'paint', c: '#3d8fbe' }],
  },
  kiki: {
    id: 'kiki', ears: 'leaf', snout: 'short', fur: '#e07030', furLight: '#f8d0a8', innerEar: '#f2c8a0', blush: '#e09078', nose: '#3a2a2a', eye: '#2b2330',
    top: '#7ecfb8', topLight: '#b6efe0', legsColor: '#8a5a3c', legs: 'pants', shoes: '#5c3e2c', frameW: 40,
    tail: { kind: 'curl', c: '#e07030', tip: '#f6d2a4' },
    deco: [{ k: 'bag', c: '#6b4a32', c2: '#e6d2b0', kind: 'backpack' }, { k: 'belt', c: '#6b4a32' }],
  },
  sora: {
    id: 'sora', ears: 'floppy', snout: 'dog', fur: '#e2c28e', furLight: '#f6e6c8', innerEar: '#f0b8a8', blush: '#e8a898', nose: '#3a2a2a', eye: '#2b2330',
    hat: { kind: 'cap', c: '#3f58a0', c2: '#f2c66d' },
    top: '#c4895a', topLight: '#e0b07a', legsColor: '#3f58a0', legs: 'pants', shoes: '#3f58a0', frameW: 38,
    tail: { kind: 'nub', c: '#d4b27c' },
    deco: [{ k: 'bag', c: '#7b5438', c2: '#e6d2b0', kind: 'satchel' }, { k: 'collar', c: '#f2e6c8' }],
  },
  ume: {
    id: 'ume', ears: 'none', earColor: '#cfcbd0', fur: '#ecc9ae', blush: '#e8a898', nose: '#d09a86', eye: '#3a2a2a', glasses: '#c9a24a', human: true, humanEars: false,
    hair: { kind: 'bun', c: '#dcd7d6', c2: '#f7f4f2' },
    top: '#3e4f86', topLight: '#6d82b8', legsColor: '#6a3f3b', legs: 'skirt', skirtC: '#6a3f3b', shoes: '#4a3030',
    deco: [{ k: 'shawl', c: '#d7a0a4' }],
  },
  akio: {
    id: 'akio', ears: 'none', fur: '#e8c4a4', nose: '#c99a82', eye: '#3a2a2a', human: true, humanEars: true,
    hair: { kind: 'short', c: '#c9c6cc', c2: '#e8e6ea' }, beard: '#b7b3b8',
    top: '#e7d3b4', topLight: '#f6ead4', legsColor: '#4d4a36', legs: 'pants', shoes: '#4a3626',
    deco: [{ k: 'vest', c: '#6b6a3c', inner: '#e7d3b4' }, { k: 'scarf', c: '#7d9a72', c2: '#e7d3b4' }],
  },
};
