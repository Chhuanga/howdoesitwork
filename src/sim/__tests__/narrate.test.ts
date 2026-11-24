import { describe, it, expect } from 'vitest';
import { makeGrid } from '../graph';
import { initDijkstra, visitNode } from '../dijkstra';
import { changes, describeChanges } from '../narrate';

const G = makeGrid(3, 3);

describe('changes', () => {
  it('marks the neighbours of a finished dot as new, with their times', () => {
    const before = initDijkstra(G, 0);
    const after = visitNode(before, G, 8, 0);
    const ch = changes(before, after);
    expect([...ch.keys()].sort()).toEqual([1, 3]);
    for (const c of ch.values()) expect(c.kind).toBe('new');
  });

  it('marks a dot whose time dropped as faster', () => {
    const before = initDijkstra(G, 0);
    const after = { ...before, dist: new Map(before.dist).set(0, -1) };
    expect(changes(before, after).get(0)).toEqual({ kind: 'faster', from: 0, to: -1 });
  });

  it('reports nothing when nothing improved', () => {
    const s = initDijkstra(G, 0);
    expect(changes(s, s).size).toBe(0);
  });
});

describe('describeChanges', () => {
  it('says so when there are no shortcuts', () => {
    expect(describeChanges(0, new Map())).toBe('No new shortcuts from A.');
  });

  it('lists new dots with their times and faster dots with before and after', () => {
    const text = describeChanges(
      0,
      new Map([
        [1, { kind: 'new' as const, from: Infinity, to: 4 }],
        [3, { kind: 'faster' as const, from: 9, to: 6 }],
      ]),
    );
    expect(text).toBe('From A: B (4), D faster: 9 → 6.');
  });
});
