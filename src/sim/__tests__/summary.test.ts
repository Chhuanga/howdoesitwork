import { describe, it, expect } from 'vitest';
import { CITIES } from '../cities';
import { graphOutline, graphStats } from '../summary';
import { Graph } from '../graph';

const tiny: Graph = {
  width: 2,
  depth: 1,
  nodes: [
    { id: 0, x: 0, z: 0 },
    { id: 1, x: 1, z: 0 },
    { id: 2, x: 2, z: 1 },
  ],
  edges: [
    { id: '0-1', from: 0, to: 1, weight: 1 },
    { id: '1-0', from: 1, to: 0, weight: 1 },
    { id: '1-2', from: 1, to: 2, weight: 1, path: [[1, 0], [1.5, 0.2], [2, 1]] },
  ],
};

describe('graphStats', () => {
  it('counts a road stored in both directions once', () => {
    expect(graphStats(tiny)).toEqual({ junctions: 3, roads: 2 });
  });

  it('gives each real city a plausible, non-zero size', () => {
    for (const c of Object.values(CITIES)) {
      const s = graphStats(c.graph);
      expect(s.junctions).toBe(c.graph.nodes.length);
      expect(s.roads).toBeGreaterThanOrEqual(s.junctions - 1); // connected
      expect(s.roads).toBeLessThanOrEqual(c.graph.edges.length);
    }
  });
});

describe('graphOutline', () => {
  it('draws one stroke per road, following its real shape', () => {
    const { roads, dots } = graphOutline(tiny);
    expect(roads).toBe('M0 0L1 0M1 0L1.5 0.2L2 1');
    expect(dots).toHaveLength(3);
  });

  it('keeps every junction inside the city bounds', () => {
    for (const c of Object.values(CITIES))
      for (const [x, z] of graphOutline(c.graph).dots) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(c.graph.width);
        expect(z).toBeGreaterThanOrEqual(0);
        expect(z).toBeLessThanOrEqual(c.graph.depth);
      }
  });
});
