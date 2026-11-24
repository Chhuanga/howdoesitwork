import { describe, it, expect } from 'vitest';
import { CITIES } from '../cities';
import { adjacency } from '../graph';
import { makeBuildings } from '../city';
import { runAllSteps } from '../dijkstra';
import { edgePath, pathLength, pointAlong, roadShapes, roadWidth } from '../roadPath';

describe.each(Object.values(CITIES))('$label', ({ graph, start, end }) => {
  const roads = graph.edges.filter((e) => e.from < e.to);
  const at = (i: number) => graph.nodes[i];

  it('has a letter name for every dot', () => {
    expect(graph.nodes.length).toBeLessThanOrEqual(26);
  });

  it('every road is two-way with one weight between 1 and 9', () => {
    for (const e of graph.edges) {
      const back = graph.edges.find((x) => x.from === e.to && x.to === e.from);
      expect(back?.weight).toBe(e.weight);
      expect(e.weight).toBeGreaterThanOrEqual(1);
      expect(e.weight).toBeLessThanOrEqual(9);
    }
  });

  it('most roads carry their street name', () => {
    expect(roads.filter((e) => e.name).length).toBeGreaterThan(roads.length * 0.9);
  });

  it('every dot can be reached from the start', () => {
    const adj = adjacency(graph);
    const seen = new Set([start]);
    const todo = [start];
    while (todo.length)
      for (const { to } of adj.get(todo.pop()!)!)
        if (!seen.has(to)) {
          seen.add(to);
          todo.push(to);
        }
    expect(seen.size).toBe(graph.nodes.length);
  });

  it('fits the scene and every dot is far enough apart to tap', () => {
    expect(graph.width).toBeLessThanOrEqual(4);
    expect(graph.depth).toBeLessThanOrEqual(4.2);
    for (const a of graph.nodes) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.z).toBeGreaterThanOrEqual(0);
      for (const b of graph.nodes)
        if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.49);
    }
  });

  it('no two roads cross, so every crossing is a dot', () => {
    const side = (p: number, q: number, r: number) =>
      Math.sign((at(q).x - at(p).x) * (at(r).z - at(p).z) - (at(q).z - at(p).z) * (at(r).x - at(p).x));
    for (const e of roads)
      for (const f of roads) {
        if (new Set([e.from, e.to, f.from, f.to]).size < 4) continue;
        const crossing =
          side(e.from, e.to, f.from) !== side(e.from, e.to, f.to) &&
          side(f.from, f.to, e.from) !== side(f.from, f.to, e.to);
        expect(crossing, `${e.id} × ${f.id}`).toBe(false);
      }
  });

  it('has both quick and jammed roads', () => {
    expect(roads.some((e) => e.weight >= 7)).toBe(true);
    expect(roads.some((e) => e.weight <= 2)).toBe(true);
  });

  it('Dijkstra finds a route from start to end', () => {
    const last = runAllSteps(graph, start, end).at(-1)!;
    expect(last.done).toBe(true);
    expect(last.path[0]).toBe(start);
    expect(last.path.at(-1)).toBe(end);
    expect(last.path.length).toBeGreaterThan(4);
  });

  it('every road has a real shape that joins its two junctions', () => {
    for (const e of graph.edges) {
      const path = edgePath(graph, e);
      expect(path[0]).toEqual([at(e.from).x, at(e.from).z]);
      expect(path.at(-1)).toEqual([at(e.to).x, at(e.to).z]);
      const straight = Math.hypot(at(e.to).x - at(e.from).x, at(e.to).z - at(e.from).z);
      expect(pathLength(path)).toBeGreaterThanOrEqual(straight - 1e-9);
      expect(pathLength(path)).toBeLessThan(straight * 1.6);
      const back = graph.edges.find((x) => x.from === e.to && x.to === e.from)!;
      expect(edgePath(graph, back)).toEqual([...path].reverse());
    }
    expect(graph.edges.some((e) => edgePath(graph, e).length > 2)).toBe(true);
  });

  it('knows which roads are wide and which have a median', () => {
    expect(new Set(roads.map((e) => e.lanes)).size).toBeGreaterThan(1);
    expect(roads.some((e) => e.divided)).toBe(true);
  });

  it('has parks, and buildings stay off roads, parks and water', () => {
    expect(graph.areas!.some((a) => a.kind === 'park')).toBe(true);
    const buildings = makeBuildings(graph);
    expect(buildings.length).toBeGreaterThan(30);
    const inside = (x: number, z: number, poly: [number, number][]) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
        if (poly[i][1] > z !== poly[j][1] > z &&
            x < ((poly[j][0] - poly[i][0]) * (z - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) hit = !hit;
      return hit;
    };
    for (const b of buildings) {
      for (const a of graph.areas!) expect(inside(b.x, b.z, a.points)).toBe(false);
      for (const road of roadShapes(graph))
        for (let i = 1; i < road.path.length; i++) {
          const [px, pz] = road.path[i - 1];
          const [qx, qz] = road.path[i];
          const dx = qx - px;
          const dz = qz - pz;
          const t = Math.max(0, Math.min(1, ((b.x - px) * dx + (b.z - pz) * dz) / (dx * dx + dz * dz || 1)));
          expect(Math.hypot(b.x - (px + dx * t), b.z - (pz + dz * t))).toBeGreaterThan(
            Math.hypot(b.width, b.depth) / 2 + roadWidth(road.lanes, graph.scale) / 2,
          );
        }
    }
  });
});

describe('New Delhi', () => {
  it('draws the rings of Connaught Place and India Gate', () => {
    expect(CITIES.newdelhi.graph.rings!.length).toBeGreaterThan(5);
    expect(CITIES.newdelhi.graph.areas!.some((a) => a.kind === 'water')).toBe(true);
  });

  it('is not a grid: one roundabout joins many roads, at many angles', () => {
    const { graph } = CITIES.newdelhi;
    const degree = (id: number) => graph.edges.filter((e) => e.from === id).length;
    expect(Math.max(...graph.nodes.map((n) => degree(n.id)))).toBeGreaterThanOrEqual(8);
    const angles = new Set(
      graph.edges.map((e) => {
        const a = graph.nodes[e.from];
        const b = graph.nodes[e.to];
        return Math.round((Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI / 10);
      }),
    );
    expect(angles.size).toBeGreaterThan(20);
  });
});

describe('pointAlong', () => {
  const path: [number, number][] = [[0, 0], [1, 0], [1, 2]];
  it('walks the bends of a road', () => {
    expect(pointAlong(path, 0)).toMatchObject({ x: 0, z: 0, dx: 1, dz: 0 });
    expect(pointAlong(path, 0.5)).toMatchObject({ x: 0.5, z: 0 });
    expect(pointAlong(path, 2)).toMatchObject({ x: 1, z: 1, dx: 0, dz: 1 });
    expect(pointAlong(path, 99)).toMatchObject({ x: 1, z: 2 });
  });
});
