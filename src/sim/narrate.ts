import { nodeName } from './graph';
import { DijkstraState } from './dijkstra';

export type Change = { kind: 'new' | 'faster'; from: number; to: number };

/** Which dots got a new or better time when `before` became `after`. */
export function changes(before: DijkstraState, after: DijkstraState): Map<number, Change> {
  const out = new Map<number, Change>();
  for (const [id, to] of after.dist) {
    const from = before.dist.get(id) ?? Infinity;
    if (to < from) out.set(id, { kind: from === Infinity ? 'new' : 'faster', from, to });
  }
  return out;
}

/** One sentence on what finishing dot `u` did to its neighbours. */
export function describeChanges(u: number, ch: Map<number, Change>): string {
  if (ch.size === 0) return `No new shortcuts from ${nodeName(u)}.`;
  const parts = [...ch].map(([id, c]) =>
    c.kind === 'new' ? `${nodeName(id)} (${c.to})` : `${nodeName(id)} faster: ${c.from} → ${c.to}`,
  );
  return `From ${nodeName(u)}: ${parts.join(', ')}.`;
}
