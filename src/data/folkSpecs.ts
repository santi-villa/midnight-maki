/** Palettes and outfits of every villager drawn with the detailed "folk" renderer (src/art/folk.ts). */
import type { FolkSpec } from '../art/folk';

const GRAY = '#9d9ba3';

export const FOLK_SPECS: Record<string, FolkSpec> = {
  spicy: {
    id: 'spicy', ears: 'round', fur: GRAY, furLight: '#f4f1f0', innerEar: '#4b4553', mask: '#57525f', nose: '#2b2330', eye: '#2b2330',
    hat: { kind: 'bandana', c: '#c9482f', c2: '#962f24' },
    top: '#8d8b95', topLight: '#a9a7b1', legsColor: '#77757f', legs: 'pants', shoes: '#4a4552',
    tail: { kind: 'ringed', c: '#a3a1a9' },
    deco: [{ k: 'apron', c: '#f6e6d6', c2: '#e8b09e' }],
  },
  taro: {
    id: 'taro', ears: 'pointy', fur: '#d9843f', furLight: '#f3d3a2', innerEar: '#f7dcb4', nose: '#3a2a2a', eye: '#2b2330',
    top: '#4a6fb5', topLight: '#6a8fd0', legsColor: '#4b3f70', legs: 'pants', shoes: '#6b4a32',
    tail: { kind: 'bushy', c: '#d9843f', tip: '#f7ead2' },
    deco: [{ k: 'vest', c: '#3b3339', inner: '#2f2830' }, { k: 'necklace', c: '#e8c35a' }],
  },
  pip: {
    id: 'pip', ears: 'round', fur: '#9c9ba5', furLight: '#d8d6e6', innerEar: '#5b5967', mask: '#625f72', nose: '#2b2330', eye: '#2b2330',
    top: '#9c9ba5', topLight: '#b4b3bd', legsColor: '#8b8a95', legs: 'fur', shoes: '#5d5b68', wide: 3.6, frameW: 42,
    tail: { kind: 'ringed', c: '#8f8e99' },
    belly: { c: '#d8d6ea', rx: 8, ry: 4.2, y: 4.6 },
  },
  rigg: {
    id: 'rigg', ears: 'round', fur: '#8c5b37', furLight: '#bb8b5d', innerEar: '#c79d6c', mask: '#5e3c26', nose: '#2a1a14', eye: '#2b2330',
    top: '#8c5b37', topLight: '#a47048', legsColor: '#7b4d2f', legs: 'fur', shoes: '#4a3020',
    tail: { kind: 'ringed', c: '#8c5b37' },
    belly: { c: '#f2e4ca', rx: 4.4, ry: 3.4, y: 5 },
  },
  momo: {
    id: 'momo', ears: 'long', fur: '#f3e6c8', furLight: '#fbf4e2', innerEar: '#f3b7b9', blush: '#f0a9a6', nose: '#d98b8b', eye: '#2b2330',
    top: '#7aa863', topLight: '#93c07a', legsColor: '#8fb66d', legs: 'skirt', skirtC: '#86b068', shoes: '#7a4e34',
    tail: { kind: 'puff', c: '#fbf4e2' },
    deco: [{ k: 'collar', c: '#f6f3ee' }, { k: 'belt', c: '#e8d8a8' }],
  },
  yuki: {
    id: 'yuki', ears: 'long', fur: '#fbf6ea', furLight: '#fffaf0', innerEar: '#f4b6c4', blush: '#f3a9ae', nose: '#e08a96', eye: '#2b2330',
    hat: { kind: 'bow', c: '#f090ab', c2: '#d0587e' },
    top: '#d95a6e', topLight: '#ee7b8c', legsColor: '#c9435a', legs: 'skirt', skirtC: '#c9435a', shoes: '#7a4e34',
    tail: { kind: 'puff', c: '#ffffff' },
    deco: [{ k: 'collar', c: '#fbd6de' }, { k: 'buttons', c: '#fbf0f0' }],
  },
  kumo: {
    id: 'kumo', ears: 'cat', fur: '#47434f', furLight: '#5b5665', innerEar: '#6f5f82', nose: '#6b5b78', eye: '#f2c66d', glasses: '#2a2630',
    top: '#35313d', topLight: '#4b4757', legsColor: '#464236', legs: 'pants', shoes: '#2a2630',
    tail: { kind: 'thin', c: '#47434f' },
    deco: [{ k: 'bowtie', c: '#8a6fc4' }, { k: 'buttons', c: '#8d869a' }],
  },
  nami: {
    id: 'nami', ears: 'round', fur: '#b27c50', furLight: '#c99468', innerEar: '#d9a97c', blush: '#e29a8a', nose: '#5b3a2a', eye: '#2b2330',
    hat: { kind: 'straw', c: '#e2b552', c2: '#c9482f' },
    top: '#b98a5c', topLight: '#cfa070', legsColor: '#4a78bd', legs: 'pants', shoes: '#d9a441',
    tail: { kind: 'nub', c: '#a06f46' },
    deco: [{ k: 'bib', c: '#4a78bd', strap: '#3b63a0' }],
  },
  hoshi: {
    id: 'hoshi', ears: 'cat', fur: '#a9a07a', furLight: '#c9c2a0', innerEar: '#d9b8a0', blush: '#e0a09a', nose: '#c9786f', eye: '#3a3040',
    hat: { kind: 'witch', c: '#6a4aa8', c2: '#4b3480' },
    top: '#5f3f9c', topLight: '#7a58b8', legsColor: '#4e3585', legs: 'robe', skirtC: '#573a92', shoes: '#2f2542',
    tail: { kind: 'thin', c: '#a9a07a' },
    deco: [{ k: 'robeTrim', c: '#e8c35a' }, { k: 'necklace', c: '#e8c35a' }],
  },
  bento: {
    id: 'bento', ears: 'round', fur: '#8a5a3c', furLight: '#a97a56', innerEar: '#b78660', blush: '#d98a78', nose: '#2f1f1a', eye: '#2b2330',
    hat: { kind: 'chef', c: '#fbf6ee', c2: '#e6dccd' },
    top: '#f1e8dc', topLight: '#ffffff', legsColor: '#7d5035', legs: 'fur', shoes: '#4d3222',
    tail: { kind: 'nub', c: '#7d5035' },
    deco: [{ k: 'apron', c: '#fbf3e8', c2: '#e6cdbb' }],
  },
  sumi: {
    id: 'sumi', ears: 'cat', fur: '#c9a4d3', furLight: '#d8bde0', innerEar: '#e8c4ee', blush: '#e48aa8', nose: '#8a5a8f', eye: '#3b4470',
    hair: { kind: 'bob', c: '#5a3a8f', c2: '#7a56b0' },
    top: '#a98acb', topLight: '#bfa2dc', legsColor: '#6a4aa0', legs: 'pants', shoes: '#f2eef6',
    deco: [{ k: 'bib', c: '#6a4aa0', strap: '#52388a' }],
  },
  kiki: {
    id: 'kiki', ears: 'pointy', fur: '#d76a2e', furLight: '#eba46c', innerEar: '#f2c8a0', nose: '#3a2a2a', eye: '#2b2330',
    top: '#8dd2c0', topLight: '#a8e4d4', legsColor: '#8a5a3c', legs: 'pants', shoes: '#6b4a32',
    tail: { kind: 'bushy', c: '#d76a2e', tip: '#f0b078' },
    deco: [{ k: 'strap', c: '#6b4a32' }, { k: 'belt', c: '#6b4a32' }],
  },
  sora: {
    id: 'sora', ears: 'none', fur: '#e2c28e', furLight: '#f0dcb4', blush: '#e8a898', nose: '#5b3a2a', eye: '#2b2330',
    hat: { kind: 'cap', c: '#3f58a0', c2: '#2c3f7c' },
    top: '#a8774e', topLight: '#c0905f', legsColor: '#5a6a96', legs: 'pants', shoes: '#3f58a0',
    tail: { kind: 'nub', c: '#d4b27c' },
    deco: [{ k: 'strap', c: '#6b4a32', bag: '#7b5a3c' }, { k: 'collar', c: '#d9c8a0' }],
  },
  ume: {
    id: 'ume', ears: 'round', earColor: '#cfcbd0', fur: '#ecc9ae', innerEar: '#e8b8b0', blush: '#e8a898', nose: '#d09a86', eye: '#3a2a2a', glasses: '#c9a24a', human: true, humanEars: false,
    hair: { kind: 'bun', c: '#dcd7d6', c2: '#f2eeee' },
    top: '#2f2a33', topLight: '#463f4b', legsColor: '#6a3f3b', legs: 'skirt', skirtC: '#6a3f3b', shoes: '#4a3030',
    deco: [{ k: 'shawl', c: '#26222b' }],
  },
  akio: {
    id: 'akio', ears: 'none', fur: '#e8c4a4', nose: '#c99a82', eye: '#3a2a2a', human: true, humanEars: true,
    hair: { kind: 'short', c: '#c9c6cc', c2: '#e2dfe4' }, beard: '#c0bcc2',
    top: '#6e6d3e', topLight: '#86854f', legsColor: '#4d4a36', legs: 'pants', shoes: '#4a3626',
    deco: [{ k: 'vest', c: '#6e6d3e', inner: '#7b4a4a' }],
  },
};
