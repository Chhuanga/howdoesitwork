'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Billboard, QuadraticBezierLine, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Graph, nodeName } from '@/sim/graph';
import { DijkstraState } from '@/sim/dijkstra';
import { Buildings, Traffic, SPACING, gridToWorld } from './City';
import { edgePath, roadShapes, roadWidth } from '@/sim/roadPath';
import { color as tok, HIGH_WEIGHT } from '@/lib/tokens';
import { setScene, useSceneStore } from '@/lib/sceneStore';
import { SETTINGS, guessQuality, isStruggling } from '@/lib/quality';
import { cameraFrame, clamp, easeOutBack, fitCamera, labelScale } from '@/sim/motion';
import { Wave, WAVE_SECONDS, makeWave, reveal } from './wave';
import ScanGlimpse from './ScanGlimpse';
import OptionRoutes from './OptionRoutes';
import { pickStreetLabels, StreetLabel } from '@/sim/streetLabels';

const NODE_R = 0.22;

function worldPos(graph: Graph, id: number): [number, number, number] {
  const n = graph.nodes[id];
  const [x, z] = gridToWorld(graph, n.x, n.z);
  return [x, 0, z];
}

// ── Ground ─────────────────────────────────────────────────────────────────────
function Ground({ graph }: { graph: Graph }) {
  const w = graph.width * SPACING + 1.6;
  const d = graph.depth * SPACING + 1.6;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshLambertMaterial color="#1a1a2e" />
    </mesh>
  );
}

// ── Parks and water ────────────────────────────────────────────────────────────
function Areas({ graph }: { graph: Graph }) {
  const shapes = useMemo(
    () =>
      (graph.areas ?? []).map((area) => {
        const shape = new THREE.Shape();
        area.points.forEach(([gx, gz], i) => {
          const [x, z] = gridToWorld(graph, gx, gz);
          // The mesh is laid flat by a quarter turn, which maps shape y to world -z
          if (i === 0) shape.moveTo(x, -z);
          else shape.lineTo(x, -z);
        });
        return { kind: area.kind, geometry: new THREE.ShapeGeometry(shape) };
      }),
    [graph],
  );
  return (
    <>
      {shapes.map((a, i) => (
        <mesh key={i} geometry={a.geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.045, 0]} receiveShadow>
          <meshLambertMaterial color={a.kind === 'park' ? '#1d4030' : '#1c3f66'} />
        </mesh>
      ))}
    </>
  );
}

// ── Static roads ───────────────────────────────────────────────────────────────
// Every road follows its real shape. One instanced box per straight piece, a
// disc at each bend so wide roads turn without gaps, and a pale strip down
// the middle of roads that have a median.
function Roads({ graph }: { graph: Graph }) {
  const { pieces, bends, medians } = useMemo(() => {
    const pieces: { x: number; z: number; len: number; width: number; angle: number }[] = [];
    const bends: { x: number; z: number; width: number }[] = [];
    const medians: typeof pieces = [];
    for (const road of roadShapes(graph)) {
      const width = roadWidth(road.lanes, graph.scale) * SPACING;
      const pts = road.path.map(([gx, gz]) => gridToWorld(graph, gx, gz));
      pts.forEach(([x, z]) => bends.push({ x, z, width }));
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const [bx, bz] = pts[i];
        const piece = {
          x: (ax + bx) / 2,
          z: (az + bz) / 2,
          len: Math.hypot(bx - ax, bz - az),
          width,
          angle: Math.atan2(bx - ax, bz - az),
        };
        pieces.push(piece);
        if (road.divided) medians.push(piece);
      }
    }
    return { pieces, bends, medians };
  }, [graph]);

  const pieceRef = useRef<THREE.InstancedMesh>(null);
  const bendRef = useRef<THREE.InstancedMesh>(null);
  const medianRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const write = (mesh: THREE.InstancedMesh | null, n: number, place: (i: number) => void) => {
      if (!mesh) return;
      for (let i = 0; i < n; i++) {
        dummy.rotation.set(0, 0, 0);
        place(i);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(pieceRef.current, pieces.length, (i) => {
      const p = pieces[i];
      dummy.position.set(p.x, -0.02, p.z);
      dummy.rotation.set(0, p.angle, 0);
      dummy.scale.set(p.width, 0.04, p.len);
    });
    write(bendRef.current, bends.length, (i) => {
      const b = bends[i];
      dummy.position.set(b.x, -0.02, b.z);
      dummy.scale.set(b.width, 0.04, b.width);
    });
    write(medianRef.current, medians.length, (i) => {
      const m = medians[i];
      dummy.position.set(m.x, 0.002, m.z);
      dummy.rotation.set(0, m.angle, 0);
      dummy.scale.set(0.022, 0.012, m.len);
    });
  }, [pieces, bends, medians]);

  return (
    <>
      <instancedMesh ref={pieceRef} args={[undefined, undefined, pieces.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#252540" />
      </instancedMesh>
      <instancedMesh ref={bendRef} args={[undefined, undefined, bends.length]} receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 1, 14]} />
        <meshLambertMaterial color="#252540" />
      </instancedMesh>
      {medians.length > 0 && (
        <instancedMesh ref={medianRef} args={[undefined, undefined, medians.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="#565a85" />
        </instancedMesh>
      )}
    </>
  );
}

// ── Street names ───────────────────────────────────────────────────────────────
// Real cities carry street names, but painted all at once they pile up and
// run off their roads. So: none on the front page (only the landmarks); in a
// beat, only the names that fit their stretch and clear their neighbours (see
// pickStreetLabels). Any road can still say its name: hover it with a mouse,
// or tap it on a phone and it shows for a few seconds. Hidden on X-ray.
const STREET_FONT = 0.15;
const TAP_SHOW_MS = 3500;

function StreetName({ label }: { label: StreetLabel }) {
  // Read left to right whichever way the road was drawn
  const [p, q] = label.a[0] <= label.b[0] ? [label.a, label.b] : [label.b, label.a];
  const spin = Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
  return (
    <Text
      position={[(p[0] + q[0]) / 2, 0.012, (p[1] + q[1]) / 2]}
      rotation={[-Math.PI / 2, 0, spin]}
      fontSize={STREET_FONT}
      color="#9aa3d4"
      anchorX="center"
      anchorY="middle"
    >
      {label.name}
    </Text>
  );
}

function StreetNames({ graph }: { graph: Graph }) {
  const mode = useSceneStore((s) => s.mode);
  const { segments, picked } = useMemo(() => {
    const segments: StreetLabel[] = [];
    const longest = new Map<string, StreetLabel>();
    const size = (l: StreetLabel) => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]);
    for (const road of roadShapes(graph)) {
      if (!road.name) continue;
      for (let i = 1; i < road.path.length; i++) {
        const a = gridToWorld(graph, road.path[i - 1][0], road.path[i - 1][1]);
        const b = gridToWorld(graph, road.path[i][0], road.path[i][1]);
        const seg: StreetLabel = { name: road.name, a: [a[0], a[1]], b: [b[0], b[1]] };
        segments.push(seg);
        const best = longest.get(road.name);
        if (!best || size(seg) > size(best)) longest.set(road.name, seg);
      }
    }
    return { segments, picked: pickStreetLabels([...longest.values()], STREET_FONT) };
  }, [graph]);

  // The one road asking for its name right now: hovered, or tapped a moment ago
  const [asked, setAsked] = useState<{ label: StreetLabel; tapped: boolean } | null>(null);
  useEffect(() => {
    if (!asked?.tapped) return;
    const id = setTimeout(() => setAsked(null), TAP_SHOW_MS);
    return () => clearTimeout(id);
  }, [asked]);

  const always = mode === "landing" ? [] : picked;
  const extra = asked && !always.some((l) => l.name === asked.label.name) ? asked.label : null;
  const isMouse = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    (e.nativeEvent as PointerEvent).pointerType === "mouse";

  return (
    <>
      {always.map((l) => (
        <StreetName key={l.name} label={l} />
      ))}
      {extra && <StreetName key={`asked-${extra.name}`} label={extra} />}
      {/* Invisible strips along every named road, to hover or tap */}
      {segments.map((seg, i) => {
        const dx = seg.b[0] - seg.a[0];
        const dz = seg.b[1] - seg.a[1];
        return (
          <mesh
            key={i}
            position={[(seg.a[0] + seg.b[0]) / 2, 0.02, (seg.a[1] + seg.b[1]) / 2]}
            rotation={[0, Math.atan2(dx, dz), 0]}
            onPointerOver={(e) => {
              if (!isMouse(e)) return;
              e.stopPropagation();
              setAsked({ label: seg, tapped: false });
            }}
            onPointerOut={(e) => {
              if (!isMouse(e)) return;
              setAsked((cur) => (cur && !cur.tapped && cur.label === seg ? null : cur));
            }}
            onClick={(e) => {
              if (isMouse(e)) return;
              e.stopPropagation();
              setAsked((cur) => (cur?.label.name === seg.name ? null : { label: seg, tapped: true }));
            }}
          >
            <boxGeometry args={[0.35, 0.05, Math.hypot(dx, dz)]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Landmarks ──────────────────────────────────────────────────────────────────
// A name floating over a place people know. Hidden on X-ray, where the same
// spot is just another dot.
// A plain sandstone arch, facing along Kartavya Path like the real one
function Arch() {
  const stone = <meshStandardMaterial color="#d6b98c" roughness={0.9} />;
  return (
    <group>
      <mesh position={[0, 0.2, -0.15]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.09]} />
        {stone}
      </mesh>
      <mesh position={[0, 0.2, 0.15]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.09]} />
        {stone}
      </mesh>
      <mesh position={[0, 0.455, 0]} castShadow>
        <boxGeometry args={[0.11, 0.11, 0.42]} />
        {stone}
      </mesh>
    </group>
  );
}

function Landmarks({ graph }: { graph: Graph }) {
  const textScale = useSceneStore((s) => s.textScale);
  return (
    <>
      {(graph.landmarks ?? []).map((m) => {
        const [x, z] = gridToWorld(graph, m.x, m.z);
        return (
          <group key={m.name} position={[x, 0, z]}>
            {m.name === 'India Gate' && <Arch />}
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
              <meshBasicMaterial color={tok.landmarkPin} />
            </mesh>
            <Text
              position={[0, 0.72, 0]}
              rotation={[-Math.PI / 5, 0, 0]}
              fontSize={0.2 * textScale}
              color={tok.landmark}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="#0f0f1a"
            >
              {m.name}
            </Text>
          </group>
        );
      })}
    </>
  );
}

// ── Animated node: pulse scale + emissive spike + expanding ripple ring ────────
function AnimatedNode({
  pos,
  color,
  emissive,
  visitTime,
  pathRevealTime,
  isOnPartialPath,
  ring,
  onClick,
  wave,
  shakeAt,
  glow,
}: {
  wave: Wave;
  /** When this dot was last picked wrongly, as a performance.now() time */
  shakeAt: number | null;
  glow: boolean;
  pos: [number, number, number];
  color: string;
  emissive: string;
  visitTime: number | null;
  pathRevealTime: number | null;
  isOnPartialPath: boolean;
  /** The outline: none, a faint ring (not reached yet), or a pulsing one (could be next) */
  ring: 'none' | 'faint' | 'pulse';
  onClick?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const outlineRef = useRef<THREE.Mesh>(null);
  const outlineMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const still = useSceneStore((s) => s.reducedMotion);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Keep color in sync via refs so useEffect isn't needed
  const colorRef = useRef(new THREE.Color(color));
  const emissiveRef = useRef(new THREE.Color(emissive));
  colorRef.current.set(color);
  emissiveRef.current.set(emissive);

  useFrame(() => {
    // Pop in as the X-ray wave arrives, and out again as it retreats
    if (groupRef.current) {
      const f = reveal(wave, pos[0], pos[2]);
      groupRef.current.visible = f > 0;
      groupRef.current.scale.setScalar(easeOutBack(f));
      // A wrong pick: a quick side-to-side "no"
      const t = shakeAt === null ? 1 : (performance.now() - shakeAt) / 450;
      groupRef.current.position.x = pos[0] + (t < 1 ? Math.sin(t * Math.PI * 6) * 0.08 * (1 - t) : 0);
    }
    // The outline ring: steady and faint, or swelling and fading for "pick me"
    if (outlineRef.current && outlineMatRef.current) {
      outlineRef.current.visible = ring !== 'none';
      if (ring === 'pulse' && !still) {
        const p = (performance.now() / 1000 / 1.6) % 1;
        outlineRef.current.scale.setScalar(1 + p * 0.8);
        outlineMatRef.current.opacity = 0.9 * (1 - p);
      } else {
        outlineRef.current.scale.setScalar(1);
        outlineMatRef.current.opacity = ring === 'pulse' ? 0.8 : 0.55;
      }
    }
    if (!meshRef.current || !matRef.current) return;
    const now = performance.now();

    matRef.current.color.copy(colorRef.current);
    matRef.current.emissive.copy(emissiveRef.current);

    // ── Node pulse ────────────────────────────────────────────────────────────
    const eventTime = pathRevealTime ?? visitTime;
    if (eventTime !== null) {
      const t = Math.min((now - eventTime) / 600, 1);
      if (t < 1) {
        const baseScale = isOnPartialPath ? 1.2 : 1.0;
        meshRef.current.scale.setScalar(baseScale + Math.sin(t * Math.PI) * 0.55);
        matRef.current.emissiveIntensity = 0.4 + (1 - t) * 1.8;
      } else {
        // Partial-path nodes sit at 1.2× to stay visually prominent
        meshRef.current.scale.setScalar(isOnPartialPath ? 1.2 : 1.0);
        matRef.current.emissiveIntensity = pathRevealTime !== null ? 1.0
          : isOnPartialPath ? 0.75
          : 0.35;
      }
    } else {
      meshRef.current.scale.setScalar(isOnPartialPath ? 1.2 : 1.0);
      matRef.current.emissiveIntensity = isOnPartialPath ? 0.75 : 0.12;
    }

    // ── Ripple ring ───────────────────────────────────────────────────────────
    if (ringRef.current && ringMatRef.current && visitTime !== null) {
      const t = Math.min((now - visitTime) / 1000, 1);
      if (t < 1) {
        ringRef.current.visible = true;
        ringRef.current.scale.setScalar(1 + t * 5.5);
        ringMatRef.current.opacity = 0.85 * (1 - t * t);
      } else {
        ringRef.current.visible = false;
      }
    } else if (ringRef.current) {
      ringRef.current.visible = false;
    }
  });

  return (
    <group ref={groupRef} position={pos} visible={false}>
      {/* Main node cylinder */}
      <mesh ref={meshRef} position={[0, 0.07, 0]}>
        <cylinderGeometry args={[NODE_R, NODE_R, 0.14, 20]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={emissive}
          emissiveIntensity={0.12}
          roughness={0.4}
          metalness={0.15}
        />
      </mesh>

      {/* Soft pool of light under the dot */}
      {glow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <circleGeometry args={[NODE_R * 2.2, 28]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}

      {/* Ripple ring — flat on the ground, starts at node edge */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        visible={false}
      >
        <ringGeometry args={[NODE_R * 0.9, NODE_R * 1.08, 40]} />
        <meshStandardMaterial
          ref={ringMatRef}
          color={emissive}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outline ring, flat on the ground just outside the dot */}
      <mesh ref={outlineRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]} visible={false}>
        <ringGeometry args={[NODE_R * 1.18, NODE_R * 1.36, 40]} />
        <meshBasicMaterial
          ref={outlineMatRef}
          color={ring === 'pulse' ? tok.nodeOption : tok.nodeRing}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Invisible, finger-sized tap target */}
      {onClick && (
        <mesh
          position={[0, 0.1, 0]}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        >
          <cylinderGeometry args={[0.44, 0.44, 0.3, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ── Animated edge: the line draws itself on, then its number pops in ───────────
function AnimatedEdge({
  wave,
  mid,
  angle,
  length,
  thick,
  color,
  glow,
  weight,
  slow,
  halo,
}: {
  wave: Wave;
  /** Draw a wide soft glow under the line */
  halo: boolean;
  mid: [number, number, number];
  angle: number;
  length: number;
  thick: number;
  color: string;
  glow: number;
  weight: number;
  slow: boolean;
}) {
  const textScale = useSceneStore((s) => s.textScale);
  const lineRef = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const f = reveal(wave, mid[0], mid[2]);
    if (lineRef.current) {
      lineRef.current.visible = f > 0;
      lineRef.current.scale.z = Math.max(f, 0.001);
    }
    if (labelRef.current) {
      // The number waits until its line is most of the way drawn
      const g = clamp((f - 0.5) * 2, 0, 1);
      labelRef.current.visible = g > 0;
      labelRef.current.scale.setScalar(easeOutBack(g));
    }
  });

  return (
    <>
      <group ref={lineRef} position={mid} rotation={[0, angle, 0]} visible={false}>
        <mesh>
          <boxGeometry args={[thick, 0.04, length]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} />
        </mesh>
        {halo && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
            <planeGeometry args={[thick * 4.5, length]} />
            <meshBasicMaterial color={color} transparent opacity={0.1 + glow * 0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        )}
      </group>
      {/* Minutes to drive this road: small, dim, haloed, always facing the viewer */}
      <group ref={labelRef} position={[mid[0], 0.14, mid[2]]} visible={false}>
        <Billboard>
          <Text
            fontSize={0.15 * textScale}
            color={slow ? tok.edgeSlowLabel : '#94a3b8'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.035}
            outlineColor="#0b0b16"
          >
            {weight}
          </Text>
        </Billboard>
      </group>
    </>
  );
}

// ── Sparks: a dot of light runs from a finished dot to each neighbour it improved ─
interface Pulse {
  from: number;
  to: number;
  at: number;
}
const MAX_PULSES = 16;
const PULSE_MS = 480;

function Pulses({ graph, list }: { graph: Graph; list: { current: Pulse[] } }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const now = performance.now();
    for (let i = 0; i < MAX_PULSES; i++) {
      const pulse = list.current[i];
      const t = pulse ? (now - pulse.at) / PULSE_MS : 1;
      if (!pulse || t >= 1 || !graph.nodes[pulse.from] || !graph.nodes[pulse.to]) {
        dummy.scale.setScalar(0);
      } else {
        const a = worldPos(graph, pulse.from);
        const b = worldPos(graph, pulse.to);
        dummy.position.set(a[0] + (b[0] - a[0]) * t, 0.13, a[2] + (b[2] - a[2]) * t);
        dummy.scale.setScalar(0.07 + 0.06 * Math.sin(Math.PI * t));
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_PULSES]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshBasicMaterial color="#e0f2fe" toneMapped={false} />
    </instancedMesh>
  );
}

// ── The answer, driven: a gold light runs the final route along the real roads ──
function RouteRunner({ graph, path }: { graph: Graph; path: number[] }) {
  const ref = useRef<THREE.Group>(null);
  const line = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 1; i < path.length; i++) {
      const e = graph.edges.find((x) => x.from === path[i - 1] && x.to === path[i]);
      if (!e) continue;
      for (const [gx, gz] of edgePath(graph, e)) pts.push(gridToWorld(graph, gx, gz));
    }
    const at = [0];
    for (let i = 1; i < pts.length; i++)
      at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, at, total: at[at.length - 1] ?? 0 };
  }, [graph, path]);
  const started = useRef(performance.now());

  useFrame(() => {
    if (!ref.current || line.total === 0) return;
    // Drive the route, wait a moment at the end, then go again
    const lap = line.total / 2.4 + 0.9;
    const s = Math.min(line.total, (((performance.now() - started.current) / 1000) % lap) * 2.4);
    let i = 1;
    while (i < line.at.length - 1 && line.at[i] < s) i++;
    const span = line.at[i] - line.at[i - 1] || 1;
    const t = (s - line.at[i - 1]) / span;
    ref.current.position.set(
      line.pts[i - 1][0] + (line.pts[i][0] - line.pts[i - 1][0]) * t,
      0.16,
      line.pts[i - 1][1] + (line.pts[i][1] - line.pts[i - 1][1]) * t,
    );
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshBasicMaterial color={tok.routeGlow} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <circleGeometry args={[0.36, 24]} />
        <meshBasicMaterial color={tok.nodePath} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Graph overlay ──────────────────────────────────────────────────────────────
function GraphOverlay({
  graph,
  dijkstra,
  start,
  end,
  labels,
  onNodeClick,
  wave,
  glow,
}: {
  graph: Graph;
  dijkstra: DijkstraState | null;
  start: number;
  end: number;
  labels: boolean;
  onNodeClick?: (id: number) => void;
  wave: Wave;
  glow: boolean;
}) {
  const shake = useSceneStore((s) => s.shake);
  const pulses = useRef<Pulse[]>([]);
  const prevDist = useRef<Map<number, number>>(new Map());
  // Refs updated during render — safe because they don't trigger re-renders
  const visitTimesRef = useRef<Map<number, number>>(new Map());
  const pathRevealTimeRef = useRef<number | null>(null);
  const prevCurrentRef = useRef<number | null>(null);
  const prevDoneRef = useRef(false);

  if (!dijkstra) {
    // Full reset when caller clears dijkstra
    visitTimesRef.current.clear();
    pathRevealTimeRef.current = null;
    prevCurrentRef.current = null;
    prevDoneRef.current = false;
    prevDist.current = new Map();
  } else {
    // Record timestamp for newly dequeued node
    if (
      dijkstra.current !== null &&
      dijkstra.current !== prevCurrentRef.current
    ) {
      visitTimesRef.current.set(dijkstra.current, performance.now());
      prevCurrentRef.current = dijkstra.current;
      // Send a spark down every road that just gave a neighbour a better time
      for (const [id, d] of dijkstra.dist) {
        if (d < (prevDist.current.get(id) ?? Infinity) && dijkstra.prev.get(id) === dijkstra.current) {
          pulses.current.push({ from: dijkstra.current, to: id, at: performance.now() });
        }
      }
      pulses.current = pulses.current.slice(-MAX_PULSES);
    }
    prevDist.current = dijkstra.dist;
    // Record when path is first revealed
    if (dijkstra.done && !prevDoneRef.current) {
      pathRevealTimeRef.current = performance.now();
      prevDoneRef.current = true;
    }
  }

  // ── Node color helpers ──────────────────────────────────────────────────────
  // Priority: final path > locked in > waiting > not reached. Names and times
  // are page elements over the canvas (components/NodeLabels.tsx).
  const nodeColor = (id: number) => {
    if (!dijkstra) {
      if (id === start) return { color: tok.nodeStart, emissive: tok.nodeStart };
      if (id === end) return { color: tok.nodeEnd, emissive: tok.nodeEnd };
      return { color: tok.nodeDefault, emissive: tok.nodeDefault };
    }
    if (dijkstra.path.includes(id)) return { color: tok.nodePath, emissive: tok.nodePath };        // amber — the answer
    if (dijkstra.visited.has(id))   return { color: tok.nodeVisited, emissive: tok.nodeVisited };  // green — locked in
    if (isWaiting(id))              return { color: tok.nodeOption, emissive: tok.nodeOption };    // sky — could be next
    return { color: tok.nodeUntouched, emissive: tok.nodeUntouched };                              // dark — not reached yet
  };

  // Reached (has a time) but not finished yet
  const isWaiting = (id: number) =>
    !!dijkstra && !dijkstra.visited.has(id) && (dijkstra.dist.get(id) ?? Infinity) < Infinity;

  // ── Edge helpers ────────────────────────────────────────────────────────────
  const isConsecutiveInPath = (arr: number[], from: number, to: number) => {
    for (let i = 0; i < arr.length - 1; i++)
      if ((arr[i] === from && arr[i + 1] === to) || (arr[i] === to && arr[i + 1] === from))
        return true;
    return false;
  };

  const isPathEdge = (from: number, to: number) =>
    dijkstra ? isConsecutiveInPath(dijkstra.path, from, to) : false;

  const isPartialPathEdge = (from: number, to: number) =>
    dijkstra ? isConsecutiveInPath(dijkstra.partialPath, from, to) : false;

  const seen = new Set<string>();

  return (
    <>
      {/* Edges with weight labels */}
      {graph.edges.map((e) => {
        const key = [e.from, e.to].sort().join('-');
        if (seen.has(key)) return null;
        seen.add(key);

        const a = worldPos(graph, e.from);
        const b = worldPos(graph, e.to);
        const mx = (a[0] + b[0]) / 2;
        const mz = (a[2] + b[2]) / 2;
        const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[2] - a[2]) ** 2);
        const angle = Math.atan2(b[0] - a[0], b[2] - a[2]);

        const onPath = isPathEdge(e.from, e.to);
        const onPartial = !onPath && isPartialPathEdge(e.from, e.to);
        const slow = e.weight >= HIGH_WEIGHT;
        const lineColor = onPath ? tok.edgePath : onPartial ? tok.edgePartial : slow ? tok.edgeSlow : tok.edgeDefault;
        const thick = onPath ? 0.1 : onPartial ? 0.09 : slow ? 0.11 : 0.065;
        const yPos = onPath || onPartial ? 0.07 : 0.03;
        const emissiveStrength = onPath ? 0.7 : onPartial ? 0.6 : 0.35;

        return (
          <AnimatedEdge
            key={key}
            wave={wave}
            mid={[mx, yPos, mz]}
            angle={angle}
            length={len - NODE_R * 2}
            thick={thick}
            color={lineColor}
            glow={emissiveStrength}
            weight={e.weight}
            slow={slow}
            halo={glow && (onPath || onPartial || slow)}
          />
        );
      })}

      {/* Animated nodes */}
      {graph.nodes.map((n) => {
        const { color, emissive } = nodeColor(n.id);
        const onFinalPath = dijkstra?.path.includes(n.id) ?? false;
        const onPartialPath = dijkstra?.partialPath.includes(n.id) ?? false;
        const ring = !dijkstra || dijkstra.visited.has(n.id) ? 'none' : isWaiting(n.id) ? 'pulse' : 'faint';
        return (
          <AnimatedNode
            key={n.id}
            pos={worldPos(graph, n.id)}
            color={color}
            emissive={emissive}
            visitTime={visitTimesRef.current.get(n.id) ?? null}
            pathRevealTime={onFinalPath ? pathRevealTimeRef.current : null}
            isOnPartialPath={onPartialPath && !onFinalPath}
            ring={ring}
            onClick={onNodeClick ? () => onNodeClick(n.id) : undefined}
            wave={wave}
            shakeAt={shake?.id === n.id ? shake.at : null}
            glow={glow}
          />
        );
      })}

      <Pulses graph={graph} list={pulses} />
      {dijkstra?.done && dijkstra.path.length > 1 && <RouteRunner graph={graph} path={dijkstra.path} />}
    </>
  );
}

// ── Start / End pins ───────────────────────────────────────────────────────────
// Two cones mark where the trip starts and ends; their tags ("A · Connaught
// Place") are page elements drawn over the canvas (components/PinTags.tsx).
// Until X-ray, a faint dotted arc joins them: the trip you are about to plan.
function Pins({ graph, start, end, hint }: { graph: Graph; start: number; end: number; hint: boolean }) {
  const [sx, , sz] = worldPos(graph, start);
  const [ex, , ez] = worldPos(graph, end);
  const lift = 0.25 * Math.hypot(ex - sx, ez - sz) + 0.6;
  return (
    <>
      <mesh position={[sx, 0.65, sz]}>
        <coneGeometry args={[0.18, 0.4, 8]} />
        <meshStandardMaterial color={tok.nodeStart} emissive={tok.nodeStart} emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[ex, 0.65, ez]}>
        <coneGeometry args={[0.18, 0.4, 8]} />
        <meshStandardMaterial color={tok.nodeEnd} emissive={tok.nodeEnd} emissiveIntensity={0.7} />
      </mesh>
      {hint && (
        <QuadraticBezierLine
          start={[sx, 0.9, sz]}
          end={[ex, 0.9, ez]}
          mid={[(sx + ex) / 2, 0.9 + lift, (sz + ez) / 2]}
          color={tok.routeHint}
          lineWidth={1.5}
          dashed
          dashSize={0.14}
          gapSize={0.12}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      )}
    </>
  );
}

// ── The scan ring: a bright edge with a soft trail, riding the front of the wave ─
function ScanRing({ wave }: { wave: Wave }) {
  const ref = useRef<THREE.Group>(null);
  const edge = useRef<THREE.MeshBasicMaterial>(null);
  const trail = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.visible = wave.moving && wave.r > 0.05;
    ref.current.scale.setScalar(Math.max(wave.r, 0.001));
    // Brightest mid-sweep, gone by the time it leaves the city
    const strength = Math.sin(Math.PI * wave.p);
    if (edge.current) edge.current.opacity = 0.2 + 0.7 * strength;
    if (trail.current) trail.current.opacity = 0.16 * strength;
  });

  return (
    <group ref={ref} position={[wave.ox, 0.06, wave.oz]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <mesh>
        <ringGeometry args={[0.985, 1, 96]} />
        <meshBasicMaterial ref={edge} color="#a5b4fc" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.8, 0.985, 96]} />
        <meshBasicMaterial ref={trail} color="#6366f1" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Camera ─────────────────────────────────────────────────────────────────────
// The camera orbits the city's centre at a distance that always fits the city
// in the part of the screen above the bottom sheet. It flies in on load, tips
// toward a top-down view on X-ray, and shifts the picture up as the sheet grows.

const VFOV = 46;
const ELEVATION_REST = 0.73;  // ≈ 42° above the ground: the isometric city view
const ELEVATION_XRAY = 1.12;  // ≈ 64°: close to a map, so the graph reads flat
/** Roughly the top of the tallest building, so tall blocks at the edge stay in frame */
const CITY_TOP = 1.5;
/** How far the landing camera sways either way, radians */
const SWAY = 0.32;
const SWAY_SAMPLES = [-SWAY, -SWAY / 2, 0, SWAY / 2, SWAY];

function CameraRig({ graph, xray }: { graph: Graph; xray: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  // Start high, wide and off to one side; ease into place
  const rig = useRef({ azimuth: -0.6, elevation: 1.2, pull: 1.8, shift: -1, slide: 0, fit: 0 });
  const seen = useRef(graph);

  useFrame((_, rawDt) => {
    const { sheetPx, sidePx, reducedMotion, mode } = useSceneStore.getState();
    const r = rig.current;
    const dt = Math.min(rawDt, 0.1);

    if (seen.current !== graph) {
      // A different city: pull back a little and settle again
      seen.current = graph;
      r.pull = 1.25;
      r.azimuth = 0.25;
    }

    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.4);
    // On the landing page the camera sways slowly from side to side
    const sway = mode === 'landing' && !reducedMotion ? SWAY * Math.sin(performance.now() / 4200) : 0;
    r.azimuth += (sway - r.azimuth) * k;
    r.elevation += ((xray ? ELEVATION_XRAY : ELEVATION_REST) - r.elevation) * k;
    r.pull += (1 - r.pull) * k;

    // In a beat the whole city fits in the part of the screen the sheet leaves
    // clear; on the landing page it fills the screen behind the card (see
    // cameraFrame). Either way it takes the same share on every screen size,
    // and on the landing page the fit covers the whole sway, so it holds still.
    const frame = cameraFrame(mode, { width: size.width, height: size.height, sidePx, sheetPx });
    const target = fitCamera({
      halfW: (graph.width * SPACING) / 2 + 0.6,
      halfD: (graph.depth * SPACING) / 2 + 0.6,
      // On X-ray the buildings flatten, so they need no headroom
      top: xray ? 0.3 : CITY_TOP,
      aspect: size.width / size.height,
      vfov: (VFOV * Math.PI) / 180,
      elevation: r.elevation,
      azimuths: mode === 'landing' && !reducedMotion ? SWAY_SAMPLES : [r.azimuth],
      clearW: frame.clearW,
      clearH: frame.clearH,
      fill: frame.fill,
    });
    // Ease between fits (landing → beat, sheet moving) instead of jumping
    r.fit = r.fit === 0 || reducedMotion ? target : r.fit + (target - r.fit) * k;
    const distance = r.pull * r.fit;
    // Labels are sized in world units, so they shrink as the camera backs away
    // on a narrow screen. Work out the enlargement that keeps them readable.
    const pxPerUnit = size.height / (2 * Math.tan((VFOV * Math.PI) / 360) * r.fit);
    const textScale = labelScale(0.2, pxPerUnit);
    if (textScale !== useSceneStore.getState().textScale) setScene({ textScale });

    const flat = Math.cos(r.elevation) * distance;
    camera.position.set(Math.sin(r.azimuth) * flat, Math.sin(r.elevation) * distance, Math.cos(r.azimuth) * flat);
    camera.lookAt(0, 0, 0);

    // Slide the picture up, out from under a bottom sheet, or right, out from
    // under a side card: all the way to the middle of the clear part in a beat,
    // part way on the landing page
    const first = r.shift < 0 || reducedMotion;
    const ease = 1 - Math.exp(-dt * 12);
    r.slide = first ? frame.slide : r.slide + (frame.slide - r.slide) * ease;
    r.shift = first ? frame.shift : r.shift + (frame.shift - r.shift) * ease;
    camera.setViewOffset(size.width, size.height, -r.slide, r.shift, size.width, size.height);
  });

  return null;
}

// ── Lets the page ask where a dot is on screen (for chips that fly to and from it) ─
function ProjectBridge({ graph }: { graph: Graph }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const v = new THREE.Vector3();
    setScene({
      projectNode: (id, lift = 0.1) => {
        const n = graph.nodes[id];
        if (!n) return null;
        const [x, z] = gridToWorld(graph, n.x, n.z);
        v.set(x, lift, z).project(camera);
        return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
      },
    });
    return () => setScene({ projectNode: null });
  }, [graph, camera, size]);
  return null;
}

// ── Watches the frame rate and gives up the extras on a device that can't keep up ─
function FrameWatch() {
  const times = useRef<number[]>([]);
  const waited = useRef(0);
  useFrame((_, dt) => {
    if (useSceneStore.getState().quality === 'low') return;
    // Skip the first two seconds: loading and the fly-in are not a fair test
    waited.current += dt;
    if (waited.current < 2 || dt > 0.25) return;
    times.current.push(dt);
    if (times.current.length > 120) times.current.shift();
    if (isStruggling(times.current)) setScene({ quality: 'low' });
  });
  return null;
}

// ── One city: everything that is rebuilt when the city changes ─────────────────
function CityScene({ graph, start, end }: { graph: Graph; start: number; end: number }) {
  const xray = useSceneStore((s) => s.xray);
  const dijkstra = useSceneStore((s) => s.dijkstra);
  const runKey = useSceneStore((s) => s.runKey);
  const labels = useSceneStore((s) => s.labels);
  const onNodeClick = useSceneStore((s) => s.onNodeClick);
  const settings = SETTINGS[useSceneStore((s) => s.quality)];

  // The wave starts at the start pin and must reach the farthest junction
  const wave = useMemo(() => {
    const [ox, , oz] = worldPos(graph, start);
    const farthest = Math.max(
      ...graph.nodes.map((n) => {
        const [x, , z] = worldPos(graph, n.id);
        return Math.hypot(x - ox, z - oz);
      }),
    );
    return makeWave(ox, oz, farthest + 1.5, false);
  }, [graph, start]);

  // Let page elements (dot names and times) appear in step with the X-ray wave
  useEffect(() => {
    setScene({
      nodeReveal: (id) => {
        const n = graph.nodes[id];
        if (!n) return 0;
        const [x, , z] = worldPos(graph, id);
        return reveal(wave, x, z);
      },
    });
    return () => setScene({ nodeReveal: null });
  }, [graph, wave]);

  // The graph is only mounted while some of it shows
  const [overlay, setOverlay] = useState(false);

  useFrame((_, rawDt) => {
    const target = xray ? wave.max : 0;
    if (wave.r !== target) {
      const quick = useSceneStore.getState().reducedMotion ? 6 : 1;
      const step = (wave.max / WAVE_SECONDS) * Math.min(rawDt, 0.1) * quick;
      wave.r = target > wave.r ? Math.min(target, wave.r + step) : Math.max(target, wave.r - step);
    }
    wave.p = wave.r / wave.max;
    wave.moving = wave.r !== target;
    const show = xray || wave.r > 0;
    if (show !== overlay) setOverlay(show);
  });

  return (
    <>
      <Ground graph={graph} />
      <Areas graph={graph} />
      <Roads graph={graph} />
      {!xray && <StreetNames graph={graph} />}
      {!xray && <Landmarks graph={graph} />}
      <Buildings graph={graph} wave={wave} glow={settings.glow} />
      <Traffic graph={graph} wave={wave} count={settings.cars} glow={settings.glow} />
      <ProjectBridge graph={graph} />
      <ScanRing wave={wave} />
      {!xray && <ScanGlimpse graph={graph} />}
      <OptionRoutes graph={graph} />
      {overlay && (
        <GraphOverlay
          key={runKey}
          graph={graph}
          dijkstra={xray ? dijkstra : null}
          start={start}
          end={end}
          labels={labels}
          onNodeClick={onNodeClick ?? undefined}
          wave={wave}
          glow={settings.glow}
        />
      )}
      {/* The hint arc goes once X-ray starts: from there the real route takes over */}
      <Pins graph={graph} start={start} end={end} hint={!xray} />
    </>
  );
}

// ── Main export: the one canvas, kept alive between beats ──────────────────────
export default function MapScene({
  cityId,
  graph,
  start,
  end,
}: {
  cityId: string;
  graph: Graph;
  start: number;
  end: number;
}) {
  const xray = useSceneStore((s) => s.xray);
  const settings = SETTINGS[useSceneStore((s) => s.quality)];
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    setScene({
      quality: guessQuality({
        memoryGb: nav.deviceMemory,
        cores: nav.hardwareConcurrency,
        saveData: nav.connection?.saveData,
      }),
    });
    setReady(true);
  }, []);

  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: tok.bg, opacity: ready ? 1 : 0, transition: 'opacity 600ms ease' }}
      camera={{ position: [0, 30, 14], fov: VFOV, near: 0.1, far: 300 }}
      dpr={settings.dpr}
      shadows={settings.shadows}
    >
      <fog attach="fog" args={[tok.bg, 30, 90]} />
      {/* Dusk: cool light from the sky, a low warm sun from one side */}
      <ambientLight intensity={0.3} color="#b9b4ff" />
      <hemisphereLight args={['#8f86ff', '#1a1030', 0.5]} />
      <directionalLight
        position={[8, 6.5, 3]}
        color="#ffc49a"
        intensity={1.25}
        castShadow={settings.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0005}
      />
      <FrameWatch />
      <CameraRig graph={graph} xray={xray} />
      <CityScene key={cityId} graph={graph} start={start} end={end} />
    </Canvas>
  );
}
