'use client';

import { useEffect, useMemo, useRef } from 'react';
import { City } from '@/sim/cities';
import { nodeName } from '@/sim/graph';
import { placeLabel } from '@/sim/summary';
import { useSceneStore } from '@/lib/sceneStore';
import { color as tok } from '@/lib/tokens';

/** How far above the ground the tags float, in world units: just over the cones */
const LIFT = 1.12;

/**
 * The small tags over the start and end cones: "A · Connaught Place". They are
 * page elements laid over the 3D canvas, moved every frame to follow their
 * cones (through the scene's projectNode), so they stay crisp and use the
 * page's own fonts.
 */
export default function PinTags({ city }: { city: City }) {
  const { graph, start, end } = city;
  const tags = useMemo(
    () => [
      { id: start, text: `${nodeName(start)} · ${placeLabel(graph, start)}`, tint: tok.nodeStart },
      { id: end, text: `${nodeName(end)} · ${placeLabel(graph, end)}`, tint: tok.nodeEnd },
    ],
    [graph, start, end],
  );
  const refs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const project = useSceneStore.getState().projectNode;
      tags.forEach((t, i) => {
        const el = refs.current[i];
        if (!el) return;
        const p = project?.(t.id, LIFT);
        const onScreen = p && p.x > -100 && p.y > -40 && p.x < window.innerWidth + 100 && p.y < window.innerHeight + 40;
        el.style.opacity = onScreen ? '1' : '0';
        if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [tags]);

  return (
    <div className="pin-tags">
      {tags.map((t, i) => (
        <span
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="pin-tag"
          style={{ opacity: 0 }}
        >
          <i style={{ background: t.tint }} />
          {t.text}
        </span>
      ))}
    </div>
  );
}
