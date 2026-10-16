import { beforeEach, describe, expect, it } from 'vitest';
import { game, newSave } from '../core/state';
import { speakerFace } from '../dialogue/speakerFace';

beforeEach(() => {
  game.load(newSave('Tester'));
});

describe('dialogue portraits', () => {
  it('gives every kind of speaker a picture, including lines that used to have none', () => {
    expect(speakerFace('narr')).toMatchObject({ name: '', art: { kind: 'narr' } });
    expect(speakerFace('player')).toMatchObject({ name: 'Tester', art: { kind: 'player' } });
    expect(speakerFace('pip').art).toEqual({ kind: 'character', id: 'pip' });
    expect(speakerFace('Ren').art).toEqual({ kind: 'neighbor', id: 'ren' });
    expect(speakerFace('?Turista con mapa').art).toEqual({ kind: 'customer', id: 'oli' });
    expect(speakerFace('?Mapache grandote|pip')).toMatchObject({ name: 'Mapache grandote', art: { kind: 'character', id: 'pip' } });
    expect(speakerFace('?Akio (carta)').art).toEqual({ kind: 'letter' });
    expect(speakerFace('?Vendedor de luna').art).toEqual({ kind: 'guest', id: 'Vendedor de luna' });
  });
});
