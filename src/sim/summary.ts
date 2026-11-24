// A city's graph in miniature: real counts for the city cards, and an outline
// of its roads to draw as a thumbnail. Plain functions, no React.

import { Graph } from './graph';

/**
 * Every road between two junctions, counted once. The graph stores most roads
 * twice, once for each direction of travel, so the pair is what makes it one road.
 */
function uniqueRoads(graph: Graph) {
  const seen = new Set<string>();
  return graph.edges.filter((e) => {
    const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** How many junctions (nodes) and roads between them (edges) the city has */
export function graphStats(graph: Graph): { junctions: number; roads: number } {
  return { junctions: graph.nodes.length, roads: uniqueRoads(graph).length };
}

/**
 * The city's roads and junctions, ready to draw in an SVG whose viewBox is
 * `0 0 graph.width graph.depth`. `roads` is one path, following each road's
 * real shape where it has one; `dots` are the junctions.
 */
export function graphOutline(graph: Graph): { roads: string; dots: [number, number][] } {
  const at = new Map(graph.nodes.map((n) => [n.id, n]));
  const r = (v: number) => Math.round(v * 100) / 100;
  const roads = uniqueRoads(graph)
    .map((e) => {
      const a = at.get(e.from);
      const b = at.get(e.to);
      if (!a || !b) return '';
      const pts: [number, number][] = e.path ?? [
        [a.x, a.z],
        [b.x, b.z],
      ];
      return pts.map(([x, z], i) => `${i ? 'L' : 'M'}${r(x)} ${r(z)}`).join('');
    })
    .join('');
  return { roads, dots: graph.nodes.map((n) => [r(n.x), r(n.z)]) };
}

/**
 * A short real name for the place at a junction: the landmark it sits by, if
 * one is close, otherwise the two streets that meet there ("Akbar Rd ×
 * Krishna Menon Marg"), otherwise the one street. Used for the A and S tags.
 */
export function placeLabel(graph: Graph, id: number, near = 0.7): string {
  const n = graph.nodes.find((x) => x.id === id);
  if (!n) return '';
  const mark = (graph.landmarks ?? [])
    .map((m) => ({ name: m.name, d: Math.hypot(m.x - n.x, m.z - n.z) }))
    .filter((m) => m.d <= near)
    .sort((a, b) => a.d - b.d)[0];
  if (mark) return mark.name;
  const streets = [
    ...new Set(graph.edges.filter((e) => (e.from === id || e.to === id) && e.name).map((e) => e.name!)),
  ];
  return streets.slice(0, 2).join(' × ');
}
