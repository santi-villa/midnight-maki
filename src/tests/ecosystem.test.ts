import { describe, expect, it } from 'vitest';
import { pickGlance, type Companion, type GlancePerson } from '../world/ecosystem';

const person = (over: Partial<GlancePerson> = {}): GlancePerson => ({
  x: 0, y: 0, traits: ['sociable'], act: 'idle', moving: false, settled: true, ...over,
});

const cat: Companion = { kind: 'cat', x: 16, y: 0, calm: true };

describe('glances between people and animals', () => {
  it('leaves someone who is moving, asleep or talking', () => {
    expect(pickGlance(person({ moving: true }), [cat], 0.1)).toBeNull();
    expect(pickGlance(person({ settled: false }), [cat], 0.1)).toBeNull();
    expect(pickGlance(person({ act: 'sleep' }), [cat], 0.1)).toBeNull();
    expect(pickGlance(person({ act: 'work' }), [cat], 0.1)).toBeNull();
    expect(pickGlance(person({ act: 'talk' }), [cat], 0.1)).toBeNull();
  });

  it('lets a sociable neighbour greet a calm cat or a dog', () => {
    expect(pickGlance(person(), [cat], 0.1)).toMatchObject({ pose: 'happy', dir: 'right' });
    expect(pickGlance(person(), [{ kind: 'dog', x: -12, y: 0 }], 0.1)).toMatchObject({ pose: 'wave', dir: 'left' });
    expect(pickGlance(person({ traits: ['shy'] }), [cat], 0.1)?.pose).toBe('look');
  });

  it('only turns a fisher toward a jump, and keeps the rod', () => {
    const look = pickGlance(person({ act: 'fish', traits: [] }), [{ kind: 'fish', x: 30, y: 4 }], 0.2);
    expect(look?.pose).toBeNull();
    expect(look?.dir).toBe('right');
    expect(pickGlance(person({ act: 'fish' }), [cat], 0.1)).toBeNull();
  });

  it('happens less often in winter and in the rain', () => {
    expect(pickGlance(person(), [cat], 0.5, 3)).toBeNull();
    expect(pickGlance(person({ traits: ['shy'] }), [cat], 0.3, 0, true)).toBeNull();
    expect(pickGlance(person(), [cat], 0.1, 3)).toMatchObject({ pose: 'happy' });
  });
});
