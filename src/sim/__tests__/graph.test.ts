import { describe, it, expect } from 'vitest';
import { makeGrid, adjacency } from '../graph';

describe('makeGrid', () => {
  it('produces the right number of nodes', () => {
    const g = makeGrid(5, 5);
    expect(g.nodes).toHaveLength(25);
  });

  it('produces the right number of undirected edges (each stored both ways)', () => {
    const g = makeGrid(5, 5);
    // 5×5 grid: 4 horizontal edges × 5 rows + 4 vertical edges × 5 cols = 40 undirected = 80 directed
    expect(g.edges).toHaveLength(80);
  });

  it('is deterministic for the same seed', () => {
    const a = makeGrid(5, 5, 42);
    const b = makeGrid(5, 5, 42);
    expect(a.edges.map((e) => e.weight)).toEqual(b.edges.map((e) => e.weight));
  });

  it('differs for different seeds', () => {
    const a = makeGrid(5, 5, 1);
    const b = makeGrid(5, 5, 2);
    expect(a.edges.map((e) => e.weight)).not.toEqual(b.edges.map((e) => e.weight));
  });

  it('all edge weights are between 1 and 8', () => {
    const g = makeGrid(5, 5);
    for (const e of g.edges) {
      expect(e.weight).toBeGreaterThanOrEqual(1);
      expect(e.weight).toBeLessThanOrEqual(8);
    }
  });
});

describe('adjacency', () => {
  it('every node has an adjacency entry', () => {
    const g = makeGrid(3, 3);
    const adj = adjacency(g);
    for (const n of g.nodes) {
      expect(adj.has(n.id)).toBe(true);
    }
  });

  it('corner node has exactly 2 neighbours', () => {
    const g = makeGrid(3, 3);
    const adj = adjacency(g);
    // Node 0 is top-left corner
    expect(adj.get(0)).toHaveLength(2);
  });

  it('centre node of 3×3 has exactly 4 neighbours', () => {
    const g = makeGrid(3, 3);
    const adj = adjacency(g);
    // Node 4 is centre
    expect(adj.get(4)).toHaveLength(4);
  });
});
