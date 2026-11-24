import { describe, it, expect } from 'vitest';
import { labelLength, pickStreetLabels, StreetLabel } from '../streetLabels';
import { placeLabel } from '../summary';
import { CITIES } from '../cities';

const F = 0.15;

describe('pickStreetLabels', () => {
  it('drops a name longer than its stretch of road', () => {
    const short: StreetLabel = { name: 'A Very Long Avenue Name Indeed', a: [0, 0], b: [1, 0] };
    expect(pickStreetLabels([short], F)).toEqual([]);
  });

  it('keeps a name that fits', () => {
    const ok: StreetLabel = { name: 'Akbar Rd', a: [0, 0], b: [3, 0] };
    expect(pickStreetLabels([ok], F)).toEqual([ok]);
  });

  it('of two names that would overlap, keeps the one on the longer road', () => {
    const long: StreetLabel = { name: 'Janpath', a: [0, 0], b: [4, 0] };
    const near: StreetLabel = { name: 'Tolstoy Marg', a: [0.5, 0.1], b: [3.5, 0.1] };
    expect(pickStreetLabels([near, long], F).map((l) => l.name)).toEqual(['Janpath']);
  });

  it('keeps names that are far apart', () => {
    const one: StreetLabel = { name: 'Janpath', a: [0, 0], b: [4, 0] };
    const two: StreetLabel = { name: 'Tolstoy Marg', a: [0, 2], b: [4, 2] };
    expect(pickStreetLabels([one, two], F)).toHaveLength(2);
  });

  it('crossing names collide', () => {
    const one: StreetLabel = { name: 'Janpath', a: [0, 0], b: [4, 0] };
    const two: StreetLabel = { name: 'Rajpath', a: [2, -2], b: [2, 2] };
    expect(pickStreetLabels([one, two], F)).toHaveLength(1);
  });

  it('measures longer names as longer', () => {
    expect(labelLength('Krishna Menon Marg', F)).toBeGreaterThan(labelLength('Akbar Rd', F));
  });
});

describe('placeLabel', () => {
  it('names A in New Delhi after the landmark beside it', () => {
    const c = CITIES.newdelhi;
    expect(placeLabel(c.graph, c.start)).toBe('Connaught Place');
  });

  it('names a junction with no landmark by the streets that meet there', () => {
    const c = CITIES.indiranagar;
    expect(placeLabel(c.graph, c.end)).toBe('80 Feet Rd × 12th Main Rd');
  });
});
