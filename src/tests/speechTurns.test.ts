import { expect, it } from 'vitest';
import { SpeechTurns } from '../world/speechTurns';

const alive = () => true;

it('plays lines one at a time, in the order they were asked', () => {
  const q = new SpeechTurns(0);
  q.say({ speaker: 'pip', text: 'hola', seconds: 2 });
  q.say({ speaker: 'guest', text: 'mesa', seconds: 2 });
  expect(q.tick(0, alive)?.speaker).toBe('pip');
  expect(q.tick(1, alive)).toBeNull();
  expect(q.activeSpeaker()).toBe('pip');
  expect(q.tick(1, alive)?.speaker).toBe('guest');
  expect(q.activeSpeaker()).toBe('guest');
  expect(q.tick(1, alive)).toBeNull();
  expect(q.tick(1, alive)).toBeNull();
  expect(q.activeSpeaker()).toBeNull();
});

it('finishes the active exchange before chatter that arrived in the middle', () => {
  const q = new SpeechTurns(0);
  q.say({ speaker: 'pip', text: 'bienvenidos', seconds: 1, exchange: 'host:1' });
  expect(q.tick(0, alive)?.text).toBe('bienvenidos');
  q.say({ speaker: 'momo', text: 'llueve', seconds: 1 });
  q.say({ speaker: 'guest', text: 'gracias', seconds: 1, exchange: 'host:1' });
  expect(q.tick(1, alive)?.text).toBe('gracias');
  expect(q.tick(1, alive)?.text).toBe('llueve');
});

it('keeps a whole exchange ahead of a conversation that starts later', () => {
  const q = new SpeechTurns(0);
  q.say({ speaker: 'a', text: '1', seconds: 1, exchange: 'chat' });
  q.say({ speaker: 'b', text: '2', seconds: 1, exchange: 'chat' });
  q.say({ speaker: 'pip', text: 'hola', seconds: 1, exchange: 'host' });
  q.say({ speaker: 'guest', text: 'sí', seconds: 1, exchange: 'host' });
  expect([q.tick(0, alive)?.text, q.tick(1, alive)?.text, q.tick(1, alive)?.text, q.tick(1, alive)?.text])
    .toEqual(['1', '2', 'hola', 'sí']);
});

it('skips a speaker who already left and does not stall the next line', () => {
  const q = new SpeechTurns(0);
  q.say({ speaker: 'gone', text: 'adiós', seconds: 3 });
  q.say({ speaker: 'pip', text: 'por acá', seconds: 1 });
  expect(q.tick(0, (id) => id !== 'gone')?.speaker).toBe('pip');
  q.say({ speaker: 'late', text: 'eh', seconds: 1 });
  expect(q.tick(0.2, (id) => id !== 'pip')?.speaker).toBe('late');
});

it('ignores a repeated line and drops extra ambient chatter', () => {
  const q = new SpeechTurns(0);
  q.say({ speaker: 'pip', text: 'esperá', seconds: 1, exchange: 'host:1' });
  q.say({ speaker: 'pip', text: 'esperá', seconds: 1, exchange: 'host:1' });
  q.say({ speaker: 'a', text: 'uno', seconds: 1 });
  q.say({ speaker: 'b', text: 'dos', seconds: 1 });
  q.say({ speaker: 'c', text: 'tres', seconds: 1 }, true);
  expect(q.pending()).toBe(3);
  expect(q.tick(0, alive)?.speaker).toBe('pip');
  expect(q.tick(1, alive)?.speaker).toBe('a');
  expect(q.tick(1, alive)?.speaker).toBe('b');
  expect(q.tick(1, alive)).toBeNull();
});

it('does not let a passing comment cut into a conversation', () => {
  const q = new SpeechTurns(0);
  q.say({ speaker: 'pip', text: 'hola', seconds: 1, exchange: 'host' });
  expect(q.roomFor('momo')).toBe(false);
  q.say({ speaker: 'momo', text: 'llueve', seconds: 1 }, true);
  expect(q.pending()).toBe(1);
  q.tick(0, alive);
  q.say({ speaker: 'momo', text: 'otra', seconds: 1 }, true);
  expect(q.pending()).toBe(0);
});

it('leaves a short pause so two bubbles are never up together', () => {
  const q = new SpeechTurns(0.25);
  q.say({ speaker: 'pip', text: 'hola', seconds: 1 });
  q.say({ speaker: 'guest', text: 'sí', seconds: 1 });
  q.tick(0, alive);
  expect(q.tick(1, alive)).toBeNull();
  expect(q.activeSpeaker()).toBeNull();
  expect(q.tick(0.25, alive)?.speaker).toBe('guest');
});

it('drops the rest of an exchange when that conversation is interrupted', () => {
  const q = new SpeechTurns(0);
  q.say({ speaker: 'a', text: '1', seconds: 1, exchange: 'chat' });
  q.say({ speaker: 'b', text: '2', seconds: 1, exchange: 'chat' });
  q.say({ speaker: 'c', text: '3', seconds: 1 });
  expect(q.tick(0, alive)?.speaker).toBe('a');
  q.dropExchange('chat');
  expect(q.holds('chat')).toBe(false);
  expect(q.tick(0, alive)?.speaker).toBe('c');
});
