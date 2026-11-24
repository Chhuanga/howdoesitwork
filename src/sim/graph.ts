export interface Node {
  id: number;
  /** Position in grid units: 1 = one city block. x runs east, z runs south. */
  x: number;
  z: number;
}

export interface Edge {
  id: string;
  from: number;
  to: number;
  weight: number;
  /** Street name, where the city is a real place */
  name?: string;
  /** The road's real shape from `from` to `to`, in grid units. Straight if absent. */
  path?: [number, number][];
  /** Lanes, both directions together */
  lanes?: number;
  /** True where a median separates the two directions */
  divided?: boolean;
}

export interface Graph {
  /** Extent of the city in grid units. Nodes sit inside 0..width × 0..depth. */
  width: number;
  depth: number;
  /** Only set for grid cities, where intersections sit on whole numbers */
  rows?: number;
  cols?: number;
  nodes: Node[];
  edges: Edge[];
  /**
   * A name for each dot, by id, where dots are real places (a region's towns).
   * Without it, dots are lettered A, B, C… (see dotName).
   */
  labels?: string[];
  /** Places people know, to help them recognise a real city */
  landmarks?: { name: string; x: number; z: number }[];
  /**
   * How big roads and cars are drawn, 1 by default. A city that covers more
   * ground uses a smaller scale so its rings and parks are not swallowed.
   */
  scale?: number;
  /** Ring roads that are drawn but are not part of the graph */
  rings?: [number, number][][];
  /** Parks and water, as outlines in grid units */
  areas?: { kind: 'park' | 'water'; points: [number, number][] }[];
}

// Seeded LCG so the grid is deterministic
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 0x100000000;
  };
}

export function makeGrid(rows: number, cols: number, seed = 7): Graph {
  const rand = lcg(seed);
  const nodes: Node[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      nodes.push({ id: r * cols + c, x: c, z: r });

  const edges: Edge[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c;
      if (c + 1 < cols) {
        const w = Math.floor(rand() * 8) + 1;
        edges.push({ id: `${id}-${id + 1}`, from: id, to: id + 1, weight: w });
        edges.push({ id: `${id + 1}-${id}`, from: id + 1, to: id, weight: w });
      }
      if (r + 1 < rows) {
        const w = Math.floor(rand() * 8) + 1;
        edges.push({ id: `${id}-${id + cols}`, from: id, to: id + cols, weight: w });
        edges.push({ id: `${id + cols}-${id}`, from: id + cols, to: id, weight: w });
      }
    }
  }

  return { width: cols - 1, depth: rows - 1, rows, cols, nodes, edges };
}

// Letter names for dots: A, B, C … (enough for a 5×5 grid)
export function nodeName(id: number): string {
  return id < 26 ? String.fromCharCode(65 + id) : `N${id}`;
}

/** What to call a dot: its town's name in a region, its letter in a city */
export function dotName(graph: Graph, id: number): string {
  return graph.labels?.[id] ?? nodeName(id);
}

export function adjacency(graph: Graph): Map<number, { to: number; weight: number }[]> {
  const adj = new Map<number, { to: number; weight: number }[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) adj.get(e.from)!.push({ to: e.to, weight: e.weight });
  return adj;
}
