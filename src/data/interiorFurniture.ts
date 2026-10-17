/** Additive IDs keep every piece owned or placed by older saves intact. */
import catalog from '../assets/interiors/catalog.json';
import type { FurnitureDef } from './furniture';

export const INTERIOR_FURNITURE: FurnitureDef[] = catalog.pieces.map((piece) => ({
  id: piece.id, name: piece.name,
  cat: piece.cat as FurnitureDef['cat'], style: piece.style as FurnitureDef['style'],
  kind: piece.kind, price: piece.price, w: piece.w, h: piece.h, sh: piece.sh,
  c1: '#a8734d', c2: '#f6ecd6', charm: Math.max(1, Math.round(piece.price / 60)),
  shop: 'taro',
  ...('rotatable' in piece ? { rotatable: piece.rotatable } : {}),
  ...('walkable' in piece ? { walkable: piece.walkable } : {}),
  ...('wall' in piece ? { wall: piece.wall, wallOffsetY: Math.max(0, piece.sh - 16) } : {}),
  ...('light' in piece ? { light: piece.light } : {}),
  ...('sit' in piece ? { sit: piece.sit } : {}),
  ...('likes' in piece ? { likes: piece.likes } : {}),
}));
