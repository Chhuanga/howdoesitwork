'use client';

import { useEffect, useRef } from 'react';
import { Graph, dotName } from '@/sim/graph';
import { useSceneStore } from '@/lib/sceneStore';

type State = 'path' | 'locked' | 'next' | 'none';

/**
 * Each dot's name and best time so far, while a search is on screen. Two
 * separate marks, so the numbers never run together:
 *  - the name (A, B, C… or a town) just under the dot, bold mono
 *  - the best time so far in a small pill above it, coloured by the dot's
 *    state: green locked in, sky could be next, amber on the final route
 * Road minutes are the third kind of number; they sit on the roads, in the
 * 3D scene. These are page elements laid over the canvas and moved every frame,
 * so they always face the viewer and use the page's fonts. They appear as the
 * X-ray wave reaches each dot.
 */
export default function NodeLabels({ graph }: { graph: Graph }) {
  const show = useSceneStore((s) => s.labels && s.xray);
  const dijkstra = useSceneStore((s) => s.dijkstra);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!show) return;
    let frame = 0;
    const tick = () => {
      const { projectNode, nodeReveal } = useSceneStore.getState();
      graph.nodes.forEach((n, i) => {
        const el = refs.current[i];
        if (!el) return;
        const p = projectNode?.(n.id, 0.1);
        const f = nodeReveal?.(n.id) ?? 0;
        el.style.opacity = p ? String(Math.min(1, f * 1.5)) : '0';
        if (p) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [show, graph]);

  if (!show) return null;

  const stateOf = (id: number): State => {
    if (!dijkstra) return 'none';
    if (dijkstra.path.includes(id)) return 'path';
    if (dijkstra.visited.has(id)) return 'locked';
    if ((dijkstra.dist.get(id) ?? Infinity) < Infinity) return 'next';
    return 'none';
  };

  return (
    <div className="node-labels">
      {graph.nodes.map((n, i) => {
        const state = stateOf(n.id);
        const time = dijkstra?.dist.get(n.id) ?? Infinity;
        return (
          <div
            key={n.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="node-label"
            data-state={state}
            style={{ opacity: 0 }}
          >
            {Number.isFinite(time) && <span className="node-time">{time}</span>}
            <span className="node-name">{dotName(graph, n.id)}</span>
          </div>
        );
      })}
    </div>
  );
}
