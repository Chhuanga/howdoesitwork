import { describe, it, expect } from 'vitest';
import { makeGrid } from '../graph';
import { initDijkstra, stepDijkstra, runAllSteps, frontier, visitNode, optionRoutes, straightLineGuess } from '../dijkstra';
import { CITIES } from '../cities';

const GRAPH = makeGrid(5, 5);
const START = 0;
const END = 24;

describe('initDijkstra', () => {
  it('sets start distance to 0', () => {
    const s = initDijkstra(GRAPH, START);
    expect(s.dist.get(START)).toBe(0);
  });

  it('sets all other distances to Infinity', () => {
    const s = initDijkstra(GRAPH, START);
    for (const n of GRAPH.nodes) {
      if (n.id !== START) expect(s.dist.get(n.id)).toBe(Infinity);
    }
  });

  it('starts with empty visited set', () => {
    const s = initDijkstra(GRAPH, START);
    expect(s.visited.size).toBe(0);
  });
});

describe('runAllSteps', () => {
  it('terminates and is marked done', () => {
    const steps = runAllSteps(GRAPH, START, END);
    expect(steps.at(-1)!.done).toBe(true);
  });

  it('finds a valid path from START to END', () => {
    const steps = runAllSteps(GRAPH, START, END);
    const final = steps.at(-1)!;
    expect(final.path[0]).toBe(START);
    expect(final.path.at(-1)).toBe(END);
  });

  it('path cost matches dist[END]', () => {
    const steps = runAllSteps(GRAPH, START, END);
    const final = steps.at(-1)!;
    const cost = final.path.reduce((sum, node, i) => {
      if (i === 0) return sum;
      const prev = final.path[i - 1];
      const edge = GRAPH.edges.find(
        (e) => e.from === prev && e.to === node,
      );
      return sum + (edge?.weight ?? 0);
    }, 0);
    expect(cost).toBe(final.dist.get(END));
  });

  it('partialPath at each step leads from START to current', () => {
    const steps = runAllSteps(GRAPH, START, END);
    for (const s of steps) {
      if (s.partialPath.length > 0) {
        expect(s.partialPath[0]).toBe(START);
        if (s.current !== null) {
          expect(s.partialPath.at(-1)).toBe(s.current);
        }
      }
    }
  });

  it('visited set only grows', () => {
    const steps = runAllSteps(GRAPH, START, END);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].visited.size).toBeGreaterThanOrEqual(steps[i - 1].visited.size);
    }
  });
});

describe('stepDijkstra', () => {
  it('marks start node visited on first real step', () => {
    let s = initDijkstra(GRAPH, START);
    s = stepDijkstra(s, GRAPH, END);
    expect(s.visited.has(START)).toBe(true);
  });
});

describe('frontier', () => {
  it('lists each waiting dot once, cheapest first, never a finished dot', () => {
    for (const s of runAllSteps(GRAPH, START, END)) {
      const f = frontier(s);
      const ids = f.map((q) => q.node);
      expect(new Set(ids).size).toBe(ids.length);
      for (const q of f) {
        expect(s.visited.has(q.node)).toBe(false);
        expect(q.cost).toBe(s.dist.get(q.node));
      }
      for (let i = 1; i < f.length; i++) expect(f[i].cost).toBeGreaterThanOrEqual(f[i - 1].cost);
    }
  });
});

describe('visitNode', () => {
  it('always picking frontier()[0] gives the same total as runAllSteps', () => {
    let s = initDijkstra(GRAPH, START);
    while (!s.done) s = visitNode(s, GRAPH, END, frontier(s)[0].node);
    expect(s.dist.get(END)).toBe(runAllSteps(GRAPH, START, END).at(-1)!.dist.get(END));
    expect(s.path[0]).toBe(START);
    expect(s.path.at(-1)).toBe(END);
  });

  it('removes the visited dot from the queue entirely', () => {
    let s = visitNode(initDijkstra(GRAPH, START), GRAPH, END, START);
    const next = frontier(s)[0].node;
    s = visitNode(s, GRAPH, END, next);
    expect(s.queue.some((q) => q.node === next)).toBe(false);
  });
});

describe('optionRoutes', () => {
  const { graph, start, end } = CITIES.newdelhi;
  const begun = visitNode(initDijkstra(graph, start), graph, end, start);

  it('gives one route per waiting dot, in the same order as the frontier', () => {
    const opts = optionRoutes(begun);
    expect(opts.map((o) => o.node)).toEqual(frontier(begun).map((q) => q.node));
  });

  it('every route runs from the start to its waiting dot along real roads', () => {
    let s = begun;
    for (let i = 0; i < 4; i++) s = stepDijkstra(s, graph, end);
    for (const o of optionRoutes(s)) {
      expect(o.route[0]).toBe(start);
      expect(o.route[o.route.length - 1]).toBe(o.node);
      for (let i = 1; i < o.route.length; i++)
        expect(graph.edges.some((e) => e.from === o.route[i - 1] && e.to === o.route[i])).toBe(true);
    }
  });

  it('a route costs what its waiting dot says', () => {
    let s = begun;
    for (let i = 0; i < 3; i++) s = stepDijkstra(s, graph, end);
    for (const o of optionRoutes(s)) {
      let total = 0;
      for (let i = 1; i < o.route.length; i++)
        total += graph.edges.find((e) => e.from === o.route[i - 1] && e.to === o.route[i])!.weight;
      expect(total).toBe(o.cost);
    }
  });

  it('each option ends on its own last leg, so a leg on the map names one option', () => {
    let s = begun;
    for (let i = 0; i < 3; i++) s = stepDijkstra(s, graph, end);
    const legs = optionRoutes(s).map((o) => `${o.route[o.route.length - 2]}-${o.node}`);
    expect(new Set(legs).size).toBe(legs.length);
  });
});

describe('A* (straight-line guess)', () => {
  const finalOf = (steps: ReturnType<typeof runAllSteps>) => steps[steps.length - 1];
  const graphs = [
    ...Object.values(CITIES).map((c) => ({ name: c.id, graph: c.graph, start: c.start, end: c.end })),
    ...[1, 2, 3].map((seed) => ({ name: `grid ${seed}`, graph: makeGrid(5, 5, seed), start: 0, end: 24 })),
  ];

  it('never overestimates the time left, from any dot', () => {
    for (const { name, graph, end } of graphs) {
      const guess = straightLineGuess(graph, end);
      // True time left from each dot: a full search outward from the end
      const truth = finalOf(runAllSteps(graph, end, -1)).dist;
      for (const n of graph.nodes) expect(guess.get(n.id)!, `${name} ${n.id}`).toBeLessThanOrEqual(truth.get(n.id)! + 1e-9);
    }
  });

  it('finds a route exactly as fast as plain Dijkstra', () => {
    for (const { name, graph, start, end } of graphs) {
      const plain = finalOf(runAllSteps(graph, start, end));
      const star = finalOf(runAllSteps(graph, start, end, straightLineGuess(graph, end)));
      expect(star.dist.get(end), name).toBe(plain.dist.get(end));
    }
  });

  it('never finishes more dots than plain Dijkstra', () => {
    for (const { name, graph, start, end } of graphs) {
      const plain = finalOf(runAllSteps(graph, start, end));
      const star = finalOf(runAllSteps(graph, start, end, straightLineGuess(graph, end)));
      expect(star.visited.size, name).toBeLessThanOrEqual(plain.visited.size);
    }
  });

  it('with no guess, behaves exactly like before', () => {
    const { graph, start, end } = CITIES.newdelhi;
    const a = runAllSteps(graph, start, end);
    const b = runAllSteps(graph, start, end, new Map());
    expect(b.map((s) => s.current)).toEqual(a.map((s) => s.current));
  });
});
