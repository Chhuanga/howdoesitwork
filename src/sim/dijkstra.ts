import { Graph, adjacency } from './graph';
import { pathLength } from './roadPath';

export interface QueueEntry {
  node: number;
  cost: number;
}

export interface DijkstraState {
  dist: Map<number, number>;
  prev: Map<number, number | null>;
  visited: Set<number>;
  queue: QueueEntry[];
  current: number | null;
  partialPath: number[]; // cheapest known path start → current, rebuilt every step
  path: number[];        // final path, only set when done
  done: boolean;
  /**
   * A*: a guess of the minutes left from each dot to the end. The search then
   * finishes the dot with the smallest time-so-far + guess, so it leans toward
   * the end instead of spreading evenly. No guess (or 0) is plain Dijkstra.
   * A guess that never overestimates still finds the fastest route.
   */
  guess?: Map<number, number>;
}

/** What the queue is ordered by: time so far, plus the guess of what is left */
export function priority(state: DijkstraState, q: QueueEntry): number {
  return q.cost + (state.guess?.get(q.node) ?? 0);
}

export function initDijkstra(graph: Graph, start: number, guess?: Map<number, number>): DijkstraState {
  const dist = new Map<number, number>();
  const prev = new Map<number, number | null>();
  for (const n of graph.nodes) {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  dist.set(start, 0);
  return {
    dist,
    prev,
    visited: new Set(),
    queue: [{ node: start, cost: 0 }],
    current: null,
    partialPath: [],
    path: [],
    done: false,
    guess,
  };
}

function buildPath(prev: Map<number, number | null>, end: number): number[] {
  const path: number[] = [];
  let cur: number | null = end;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

export function runAllSteps(graph: Graph, start: number, end: number, guess?: Map<number, number>): DijkstraState[] {
  const steps: DijkstraState[] = [];
  let state = initDijkstra(graph, start, guess);
  steps.push(state);
  while (!state.done && steps.length < 500) {
    state = stepDijkstra(state, graph, end);
    steps.push(state);
  }
  return steps;
}

// Dots reached but not finished yet, one entry each, next to finish first:
// cheapest for Dijkstra, cheapest time + guess for A*.
// This is the queue as a learner should see it: no stale duplicates.
export function frontier(state: DijkstraState): QueueEntry[] {
  const best = new Map<number, number>();
  for (const { node } of state.queue) {
    if (state.visited.has(node)) continue;
    best.set(node, state.dist.get(node) ?? Infinity);
  }
  return [...best]
    .map(([node, cost]) => ({ node, cost }))
    .sort((a, b) => priority(state, a) - priority(state, b) || a.cost - b.cost || a.node - b.node);
}

export function stepDijkstra(
  state: DijkstraState,
  graph: Graph,
  end: number
): DijkstraState {
  if (state.done || state.queue.length === 0)
    return { ...state, done: true };

  const sorted = [...state.queue].sort((a, b) => priority(state, a) - priority(state, b));
  const { node: u } = sorted[0];

  // Skip stale entries — partial path stays as-is
  if (state.visited.has(u)) return { ...state, queue: sorted.slice(1) };

  return visitNode(state, graph, end, u);
}

// Finish dot u: lock in its time and update its neighbours.
// stepDijkstra always passes the cheapest dot; Beat 2 passes the learner's pick.
export function visitNode(
  state: DijkstraState,
  graph: Graph,
  end: number,
  u: number
): DijkstraState {
  const uCost = state.dist.get(u) ?? Infinity;
  const rest = state.queue.filter((q) => q.node !== u);

  const visited = new Set(state.visited);
  visited.add(u);

  if (u === end) {
    const finalPath = buildPath(state.prev, end);
    return {
      ...state,
      visited,
      queue: rest,
      current: u,
      partialPath: finalPath,
      path: finalPath,
      done: true,
    };
  }

  const dist = new Map(state.dist);
  const prev = new Map(state.prev);
  const newQueue = [...rest];

  for (const { to, weight } of (adjacency(graph).get(u) ?? [])) {
    if (visited.has(to)) continue;
    const candidate = uCost + weight;
    if (candidate < (dist.get(to) ?? Infinity)) {
      dist.set(to, candidate);
      prev.set(to, u);
      newQueue.push({ node: to, cost: candidate });
    }
  }

  return {
    dist,
    prev,
    visited,
    queue: newQueue,
    current: u,
    partialPath: buildPath(prev, u), // path from start → current node right now
    path: [],
    done: false,
    guess: state.guess,
  };
}

/**
 * Every waiting dot, with the cheapest route found to it so far: start first,
 * the waiting dot last. These are the learner's options: picking one finishes
 * that dot. Cheapest first, like `frontier`.
 */
export function optionRoutes(state: DijkstraState): { node: number; cost: number; route: number[] }[] {
  return frontier(state).map(({ node, cost }) => {
    const route = [node];
    const seen = new Set(route);
    let at = state.prev.get(node) ?? null;
    while (at !== null && !seen.has(at)) {
      route.unshift(at);
      seen.add(at);
      at = state.prev.get(at) ?? null;
    }
    return { node, cost, route };
  });
}

/**
 * A* guess that can never overestimate: the straight-line distance to the end,
 * driven at the fastest pace of any road in the graph (minutes per unit of
 * road length). No real route can be shorter than the straight line, or
 * quicker than the fastest road, so the guess is always at or under the truth.
 */
export function straightLineGuess(graph: Graph, end: number): Map<number, number> {
  const at = new Map(graph.nodes.map((n) => [n.id, n]));
  let pace = Infinity;
  for (const e of graph.edges) {
    const a = at.get(e.from)!;
    const b = at.get(e.to)!;
    const len = e.path ? pathLength(e.path) : Math.hypot(b.x - a.x, b.z - a.z);
    if (len > 0) pace = Math.min(pace, e.weight / len);
  }
  if (!Number.isFinite(pace)) pace = 0;
  const goal = at.get(end)!;
  return new Map(graph.nodes.map((n) => [n.id, Math.hypot(n.x - goal.x, n.z - goal.z) * pace]));
}
