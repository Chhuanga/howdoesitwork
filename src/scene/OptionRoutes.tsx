'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { color as tok } from '@/lib/tokens';
import { Graph } from '@/sim/graph';
import { optionRoutes } from '@/sim/dijkstra';
import { edgePath } from '@/sim/roadPath';
import { setScene, useSceneStore } from '@/lib/sceneStore';
import { gridToWorld } from './City';

// ── The learner's options, drawn on the map ──────────────────────────────────
// While the learner picks the next dot to finish, each option is drawn in sky
// blue, the colour that means "you can pick this next" (the dots and chips use
// it too). The step each option would add, its last leg, flows toward its dot
// with an arrowhead (the dot itself pulses; see AnimatedNode). The part of the route already
// travelled is shared by several options, so it stays quiet. Pointing at an
// option (its chip, or its route here) draws its whole route solid and dims the
// rest. Each last leg is a tap target that picks that dot, like its chip.

const Y = 0.12;
const SHARED = { color: '#e2e8f0', lineWidth: 2, opacity: 0.22 };
const NEXT = { color: tok.edgeOption, lineWidth: 4.5 };
const POINTED = { color: tok.edgeOption, lineWidth: 7, opacity: 1 };
/** Leave the ends of a leg to the dots, which are tap targets of their own */
const END_GAP = 0.26;

type Pt = [number, number, number];

function legPoints(graph: Graph, from: number, to: number): Pt[] {
  const e = graph.edges.find((x) => x.from === from && x.to === to);
  if (!e) return [];
  return edgePath(graph, e).map(([gx, gz]) => {
    const [x, z] = gridToWorld(graph, gx, gz);
    return [x, Y, z];
  });
}

/** Pieces of a leg to hit-test, with the ends near the dots trimmed off */
function hitPieces(pts: Pt[]): { mid: Pt; angle: number; len: number }[] {
  const out: { mid: Pt; angle: number; len: number }[] = [];
  const total = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[2] - pts[i][2]), 0);
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    // Keep only the part of this piece that is END_GAP clear of both dots
    const lo = Math.max(0, END_GAP - run);
    const hi = Math.min(len, total - END_GAP - run);
    run += len;
    if (hi - lo < 0.05) continue;
    const t = (lo + hi) / 2 / len;
    out.push({
      mid: [a[0] + (b[0] - a[0]) * t, Y, a[2] + (b[2] - a[2]) * t],
      angle: Math.atan2(b[0] - a[0], b[2] - a[2]),
      len: hi - lo,
    });
  }
  return out;
}

/** An option's next step: dashes that flow toward its dot */
function FlowLeg({ pts, opacity, still }: { pts: Pt[]; opacity: number; still: boolean }) {
  const ref = useRef<{ material: { dashOffset: number } } | null>(null);
  useFrame((_, dt) => {
    if (!still && ref.current) ref.current.material.dashOffset -= Math.min(dt, 0.1) * 0.9;
  });
  return (
    <Line
      ref={ref as never}
      points={pts}
      {...NEXT}
      opacity={opacity}
      dashed
      dashSize={0.16}
      gapSize={0.09}
      transparent
      depthWrite={false}
      renderOrder={4}
    />
  );
}

/** A small cone just short of the dot, pointing at it */
function Arrow({ pts, opacity }: { pts: Pt[]; opacity: number }) {
  // Walk back from the dot to just outside it
  let back = END_GAP + 0.06;
  let i = pts.length - 1;
  while (i > 0) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    if (len >= back) break;
    back -= len;
    i--;
  }
  if (i === 0) return null;
  const [a, b] = [pts[i - 1], pts[i]];
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
  const t = 1 - back / len;
  const at: Pt = [a[0] + (b[0] - a[0]) * t, Y + 0.02, a[2] + (b[2] - a[2]) * t];
  return (
    <group position={at} rotation={[0, Math.atan2(b[0] - a[0], b[2] - a[2]), 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={6}>
        <coneGeometry args={[0.075, 0.17, 3]} />
        <meshBasicMaterial color={tok.edgeOption} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function OptionRoutes({ graph }: { graph: Graph }) {
  const on = useSceneStore((s) => s.optionRoutes && s.xray);
  const state = useSceneStore((s) => s.dijkstra);
  const hover = useSceneStore((s) => s.hoverOption);
  const onNodeClick = useSceneStore((s) => s.onNodeClick);
  const still = useSceneStore((s) => s.reducedMotion);

  const { legs, options, next } = useMemo(() => {
    if (!state || state.done) return { legs: [], options: [], next: [] };
    const options = optionRoutes(state);
    // The shared, already-travelled part of every route, once each, for the
    // quiet layer. Last legs are drawn on their own below.
    const seen = new Set(options.map((o) => `${o.route[o.route.length - 2]}-${o.node}`));
    const legs: Pt[][] = [];
    for (const o of options)
      for (let i = 1; i < o.route.length - 1; i++) {
        const key = `${o.route[i - 1]}-${o.route[i]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        legs.push(legPoints(graph, o.route[i - 1], o.route[i]));
      }
    const next = options.map((o) => {
      const pts = legPoints(graph, o.route[o.route.length - 2], o.node);
      return { node: o.node, pts };
    });
    return { legs, options, next };
  }, [state, graph]);

  const bright = useMemo(() => {
    const o = options.find((x) => x.node === hover);
    if (!o) return [];
    // The travelled part; its last leg is already drawn bright as a FlowLeg
    return o.route.slice(1, -1).map((to, i) => legPoints(graph, o.route[i], to));
  }, [options, hover, graph]);

  // Never leave a pointer cursor behind
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  if (!on || options.length === 0) return null;

  // Only answer when this leg is the nearest thing under the pointer, so a tap
  // on a dot at the end of a leg is the dot's alone
  const nearest = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.intersections[0]?.object === e.object;
  const isMouse = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    (e.nativeEvent as PointerEvent).pointerType === 'mouse';

  return (
    <group>
      {legs.map((pts, i) => pts.length > 1 && <Line key={i} points={pts} {...SHARED} transparent depthWrite={false} />)}
      {bright.map(
        (pts, i) => pts.length > 1 && <Line key={`b${i}`} points={pts} {...POINTED} transparent depthWrite={false} renderOrder={5} />,
      )}
      {next.map((n) => {
        // With an option pointed at, the others step back
        const opacity = hover === null || hover === n.node ? 1 : 0.35;
        return (
          n.pts.length > 1 && (
            <group key={n.node}>
              {hover === n.node && <Line points={n.pts} {...POINTED} transparent depthWrite={false} renderOrder={5} />}
              <FlowLeg pts={n.pts} opacity={opacity} still={still} />
              <Arrow pts={n.pts} opacity={opacity} />
            </group>
          )
        );
      })}

      {options.map((o) => {
        const pieces = hitPieces(legPoints(graph, o.route[o.route.length - 2], o.node));
        return pieces.map((p, i) => (
          <mesh
            key={`${o.node}-${i}`}
            position={p.mid}
            rotation={[0, p.angle, 0]}
            onPointerOver={(e) => {
              if (!isMouse(e) || !nearest(e)) return;
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
              setScene({ hoverOption: o.node });
            }}
            onPointerOut={(e) => {
              if (!isMouse(e)) return;
              document.body.style.cursor = '';
              if (useSceneStore.getState().hoverOption === o.node) setScene({ hoverOption: null });
            }}
            onClick={(e) => {
              if (!nearest(e)) return;
              e.stopPropagation();
              document.body.style.cursor = '';
              setScene({ hoverOption: null });
              onNodeClick?.(o.node);
            }}
          >
            <boxGeometry args={[0.42, 0.08, p.len]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
        ));
      })}
    </group>
  );
}
