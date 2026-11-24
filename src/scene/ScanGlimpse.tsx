'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Graph } from '@/sim/graph';
import { edgePath } from '@/sim/roadPath';
import { scanBand } from '@/sim/motion';
import { useSceneStore } from '@/lib/sceneStore';
import { gridToWorld, SPACING } from './City';

// ── The landing page's scan line ─────────────────────────────────────────────
// Every few seconds a line of light sweeps diagonally across the city, and in
// a narrow band around it the junctions and roads show through the buildings
// as dots and lines. It hints at X-ray without giving it away: the full graph
// is still the learner's to uncover in beat 1. Off for reduced motion and on
// slow devices.

/** Diagonal, top-left to bottom-right as the city is first seen */
const DIR = new THREE.Vector2(1, 1).normalize();
/** Half the width of the band the graph shows through, world units */
const BAND = 0.9;

// Every part shares one rule: fade with distance from the line
const VERT = /* glsl */ `
  uniform vec2 uDir;
  uniform float uPointScale;
  uniform float uPointSize;
  varying float vD;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vD = dot(w.xz, uDir);
    vec4 mv = viewMatrix * w;
    gl_PointSize = uPointSize * uPointScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBand;
  uniform float uWidth;
  uniform float uOpacity;
  uniform bool uRound;
  varying float vD;
  void main() {
    float a = 1.0 - smoothstep(0.0, uWidth, abs(vD - uBand));
    if (uRound) {
      vec2 c = gl_PointCoord - 0.5;
      a *= 1.0 - smoothstep(0.32, 0.5, length(c));
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * uOpacity);
    #include <colorspace_fragment>
  }
`;

function bandMaterial(color: string, width: number, opacity: number, opts: { round?: boolean; size?: number; depthTest?: boolean } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uDir: { value: DIR },
      uColor: { value: new THREE.Color(color) },
      uBand: { value: -1e6 },
      uWidth: { value: width },
      uOpacity: { value: opacity },
      uRound: { value: !!opts.round },
      uPointSize: { value: opts.size ?? 0 },
      uPointScale: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: opts.depthTest ?? false,
    blending: THREE.AdditiveBlending,
  });
}

export default function ScanGlimpse({ graph }: { graph: Graph }) {
  const mode = useSceneStore((s) => s.mode);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const quality = useSceneStore((s) => s.quality);
  const on = mode === 'landing' && !reducedMotion && quality === 'high';

  const { roads, dots, from, to, ground } = useMemo(() => {
    const seg: number[] = [];
    for (const e of graph.edges) {
      if (e.from > e.to && graph.edges.some((x) => x.from === e.to && x.to === e.from)) continue;
      const pts = edgePath(graph, e).map(([gx, gz]) => gridToWorld(graph, gx, gz));
      for (let i = 1; i < pts.length; i++) seg.push(pts[i - 1][0], 0.07, pts[i - 1][1], pts[i][0], 0.07, pts[i][1]);
    }
    const dot: number[] = [];
    for (const n of graph.nodes) {
      const [x, z] = gridToWorld(graph, n.x, n.z);
      dot.push(x, 0.09, z);
    }
    const roads = new THREE.BufferGeometry();
    roads.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    const dots = new THREE.BufferGeometry();
    dots.setAttribute('position', new THREE.Float32BufferAttribute(dot, 3));
    // How far the line must travel to cross the whole city, corner to corner
    const hw = (graph.width * SPACING) / 2 + 0.6;
    const hd = (graph.depth * SPACING) / 2 + 0.6;
    const reach = Math.abs(hw * DIR.x) + Math.abs(hd * DIR.y);
    // The stripe covers the ground and no more, like the Ground mesh
    const ground: [number, number] = [graph.width * SPACING + 1.6, graph.depth * SPACING + 1.6];
    return { roads, dots, from: -reach - BAND, to: reach + BAND, ground };
  }, [graph]);

  const mats = useMemo(
    () => ({
      roads: bandMaterial('#818cf8', BAND, 0.85),
      dots: bandMaterial('#e0e7ff', BAND, 1, { round: true, size: 0.2 }),
      // The line itself: a thin bright stripe on the ground, under the buildings
      line: bandMaterial('#a5b4fc', 0.07, 0.9, { depthTest: true }),
    }),
    [],
  );
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  // The first sweep waits until the camera has flown in
  const started = useRef(performance.now() + 3000);

  useEffect(() => () => { roads.dispose(); dots.dispose(); }, [roads, dots]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame(() => {
    const band = scanBand((performance.now() - started.current) / 1000, from, to);
    const at = band ?? -1e6;
    mats.roads.uniforms.uBand.value = at;
    mats.dots.uniforms.uBand.value = at;
    mats.line.uniforms.uBand.value = at;
    // World size to pixels, so dots keep their size as the camera moves
    mats.dots.uniforms.uPointScale.value = (size.height * 0.5) / Math.tan((camera.fov * Math.PI) / 360) * gl.getPixelRatio();
  });

  if (!on) return null;
  return (
    <group>
      <lineSegments geometry={roads} material={mats.roads} renderOrder={10} />
      <points geometry={dots} material={mats.dots} renderOrder={11} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={mats.line} renderOrder={9}>
        <planeGeometry args={ground} />
      </mesh>
    </group>
  );
}
