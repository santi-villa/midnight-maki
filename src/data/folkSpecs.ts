/** Palettes and outfits of every villager drawn with the detailed "folk" renderer (src/art/folk.ts). */
import type { FolkSpec } from '../art/folk';

const GRAY = '#9d9ba3';

export const FOLK_SPECS: Record<string, FolkSpec> = {
  spicy: {
    id: 'spicy', ears: 'round', fur: GRAY, furLight: '#f4f1f0', innerEar: '#4b4553', mask: '#3b3541', nose: '#2b2330', eye: '#2b2330',
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
  momo: {
    id: 'momo', ears: 'long', fur: '#f3e6c8', furLight: '#fbf4e2', innerEar: '#f3b7b9', blush: '#f0a9a6', nose: '#d98b8b', eye: '#2b2330',
    top: '#7aa863', topLight: '#93c07a', legsColor: '#8fb66d', legs: 'skirt', skirtC: '#86b068', shoes: '#7a4e34',
    tail: { kind: 'puff', c: '#fbf4e2' },
    deco: [{ k: 'collar', c: '#f6f3ee' }, { k: 'belt', c: '#e8d8a8' }],
  },
};
