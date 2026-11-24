import { Edge, Graph } from './graph';

export type Point = [number, number];

/** The shape of a road, in the direction of the edge. A straight line if the road has no traced shape. */
export function edgePath(graph: Graph, e: Edge): Point[] {
  if (e.path) return e.path;
  const a = graph.nodes[e.from];
  const b = graph.nodes[e.to];
  return [[a.x, a.z], [b.x, b.z]];
}

export function pathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++)
    total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return total;
}

/** Position and unit direction at distance `s` along a path. Clamped to the path's ends. */
export function pointAlong(path: Point[], s: number): { x: number; z: number; dx: number; dz: number } {
  let left = Math.max(0, s);
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len === 0) continue;
    if (left <= len || i === path.length - 1) {
      const t = Math.min(1, left / len);
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / len, dz: (bz - az) / len };
    }
    left -= len;
  }
  const [x, z] = path[path.length - 1];
  return { x, z, dx: 1, dz: 0 };
}

/** Road width in grid units. Wider roads have more lanes; the scale is exaggerated so roads read on a phone. */
export function roadWidth(lanes = 2, scale = 1): number {
  return ((0.14 + 0.03 * Math.min(8, Math.max(2, lanes))) / 1.8) * scale;
}

export interface RoadShape {
  path: Point[];
  lanes: number;
  divided: boolean;
  name?: string;
}

/** Every road once (not once per direction), plus rings that are drawn but not part of the graph. */
export function roadShapes(graph: Graph): RoadShape[] {
  const seen = new Set<string>();
  const out: RoadShape[] = [];
  for (const e of graph.edges) {
    const key = e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ path: edgePath(graph, e), lanes: e.lanes ?? 2, divided: e.divided ?? false, name: e.name });
  }
  for (const path of graph.rings ?? []) out.push({ path, lanes: 3, divided: false });
  return out;
}
