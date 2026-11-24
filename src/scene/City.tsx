'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Graph } from '@/sim/graph';
import { makeBuildings } from '@/sim/city';
import { createTraffic, stepTraffic, laneKey } from '@/sim/traffic';
import { pointAlong, roadWidth } from '@/sim/roadPath';
import { Wave, reveal } from './wave';

// Must match MapScene's SPACING so buildings sit between its roads
export const SPACING = 1.8;

/** Grid units (intersections on integers) → world x/z, centred on the origin */
export function gridToWorld(graph: Graph, gx: number, gz: number): [number, number] {
  const cx = (graph.width * SPACING) / 2;
  const cz = (graph.depth * SPACING) / 2;
  return [gx * SPACING - cx, gz * SPACING - cz];
}

// ── Buildings ──────────────────────────────────────────────────────────────────
// One instanced mesh for every building. As the X-ray wave passes a building
// it sinks to a flat, dim footprint, so the graph is what you notice. Each
// building follows the wave by its own distance, which is what makes the city
// fold down in a ripple instead of all at once.

const BUILDING_COLORS = ['#2b2d52', '#33365f', '#3b3f6e', '#292a45'];
const FLAT_HEIGHT = 0.035;
const FLAT_COLOR = new THREE.Color('#1b1c36');

export function Buildings({ graph, wave, glow = false }: { graph: Graph; wave: Wave; glow?: boolean }) {
  const buildings = useMemo(
    () =>
      makeBuildings(graph, 3, BUILDING_COLORS.length).map((b) => {
        const [x, z] = gridToWorld(graph, b.x, b.z);
        return { ...b, wx: x, wz: z, base: new THREE.Color(BUILDING_COLORS[b.colorIndex]) };
      }),
    [graph],
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const drawnAt = useRef(NaN);

  // Unit cube with its base on the ground, so scaling y grows it upward
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);

  const draw = () => {
    const mesh = meshRef.current;
    if (!mesh) return;
    buildings.forEach((b, i) => {
      const f = reveal(wave, b.wx, b.wz);
      dummy.position.set(b.wx, -0.03, b.wz);
      dummy.rotation.set(0, b.rotation ?? 0, 0);
      dummy.scale.set(b.width * SPACING, b.height + (FLAT_HEIGHT - b.height) * f, b.depth * SPACING);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint.copy(b.base).lerp(FLAT_COLOR, f));
      // A band of lit windows round the taller buildings; it goes out as the building sinks
      const lit = b.height > 0.42 && i % 3 !== 0 ? 1 - f : 0;
      dummy.position.y = -0.03 + b.height * 0.62;
      dummy.scale.set(b.width * SPACING * 1.015 * lit, 0.03 * lit, b.depth * SPACING * 1.015 * lit);
      dummy.updateMatrix();
      lightsRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (lightsRef.current) lightsRef.current.instanceMatrix.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = wave.p < 0.5;
    drawnAt.current = wave.r;
  };

  useLayoutEffect(draw, [buildings, glow]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (drawnAt.current !== wave.r) draw();
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[geometry, undefined, buildings.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.85} metalness={0.05} />
      </instancedMesh>
      {glow && (
        <instancedMesh ref={lightsRef} args={[geometry, undefined, buildings.length]}>
          <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
        </instancedMesh>
      )}
    </>
  );
}

// ── Traffic ────────────────────────────────────────────────────────────────────
// Cars on real trips. Each one drives toward a destination, keeps its distance
// from the car ahead, and waits its turn at junctions, so queues build and
// clear by themselves. A road's weight sets its speed, which is why cars crawl
// bumper to bumper on the heavy (red) roads. Brake lights glow when a car
// slows or stops. Cars keep left, as in India.

const CAR_COLORS = ['#e2e8f0', '#93c5fd', '#fca5a5', '#94a3b8'];
const XRAY_CAR_OPACITY = 0.3;
const BRAKE_ON = new THREE.Color('#ff2d1a');
const BRAKE_OFF = new THREE.Color('#4a0f0a');

export function Traffic({
  graph,
  wave,
  count = 30,
  glow = false,
}: {
  graph: Graph;
  wave: Wave;
  count?: number;
  /** Draw a pool of headlight on the road ahead of each car */
  glow?: boolean;
}) {
  const traffic = useMemo(() => createTraffic(graph, count, 11, CAR_COLORS.length), [graph, count]);
  const cars = traffic.cars;
  const lanesOf = useMemo(
    () => new Map(graph.edges.map((e) => [laneKey(e.from, e.to), e.lanes])),
    [graph],
  );
  // Where each car is drawn: x, z, heading. Eased toward the simulation so
  // cars swing through a turn instead of snapping to the next road.
  const pose = useMemo(() => new Float32Array(cars.length * 3).fill(NaN), [cars]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const brakeRef = useRef<THREE.InstancedMesh>(null);
  const beamRef = useRef<THREE.InstancedMesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const cabinMat = useRef<THREE.MeshStandardMaterial>(null);
  const lightMat = useRef<THREE.MeshStandardMaterial>(null);
  const brakeMat = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // All parts share one matrix per car; the offsets live in the geometry.
  // Local +z is the direction of travel.
  const geo = useMemo(
    () => ({
      body: new THREE.BoxGeometry(0.12, 0.06, 0.24).translate(0, 0.05, 0),
      cabin: new THREE.BoxGeometry(0.1, 0.05, 0.12).translate(0, 0.105, -0.02),
      lights: new THREE.BoxGeometry(0.1, 0.02, 0.01).translate(0, 0.055, 0.12),
      brakes: new THREE.BoxGeometry(0.11, 0.025, 0.012).translate(0, 0.06, -0.121),
      // A flat fan of light on the road, widening ahead of the car
      beam: new THREE.ShapeGeometry(
        new THREE.Shape([new THREE.Vector2(-0.04, 0), new THREE.Vector2(0.04, 0), new THREE.Vector2(0.13, 0.42), new THREE.Vector2(-0.13, 0.42)]),
      )
        .rotateX(Math.PI / 2)
        .translate(0, 0.012, 0.12),
    }),
    [],
  );

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const color = new THREE.Color();
    cars.forEach((c, i) => body.setColorAt(i, color.set(CAR_COLORS[c.colorIndex])));
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
  }, [cars]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1); // don't teleport after a dropped frame
    stepTraffic(traffic, dt);
    const ease = Math.min(1, dt * 14);

    cars.forEach((car, i) => {
      const lane = traffic.lanes.get(laneKey(car.from, car.to))!;
      const at = pointAlong(lane.path, car.s);
      const [px, pz] = gridToWorld(graph, at.x, at.z);
      // Keep to the left half of the road, seen in the direction of travel
      const offset = (roadWidth(lanesOf.get(laneKey(car.from, car.to)), graph.scale) * SPACING) / 4;
      const tx = px + at.dz * offset;
      const tz = pz - at.dx * offset;
      const heading = Math.atan2(at.dx, at.dz);

      const o = i * 3;
      if (Number.isNaN(pose[o])) {
        pose[o] = tx;
        pose[o + 1] = tz;
        pose[o + 2] = heading;
      } else {
        pose[o] += (tx - pose[o]) * ease;
        pose[o + 1] += (tz - pose[o + 1]) * ease;
        // Turn the short way round
        let turn = heading - pose[o + 2];
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        pose[o + 2] += turn * ease;
      }

      dummy.position.set(pose[o], 0, pose[o + 1]);
      dummy.rotation.set(0, pose[o + 2], 0);
      dummy.scale.setScalar(graph.scale ?? 1);
      dummy.updateMatrix();
      bodyRef.current?.setMatrixAt(i, dummy.matrix);
      cabinRef.current?.setMatrixAt(i, dummy.matrix);
      lightRef.current?.setMatrixAt(i, dummy.matrix);
      brakeRef.current?.setMatrixAt(i, dummy.matrix);
      beamRef.current?.setMatrixAt(i, dummy.matrix);
      brakeRef.current?.setColorAt(i, car.braking ? BRAKE_ON : BRAKE_OFF);
    });
    for (const m of [bodyRef, cabinRef, lightRef, brakeRef, beamRef]) {
      if (m.current) m.current.instanceMatrix.needsUpdate = true;
    }
    if (brakeRef.current?.instanceColor) brakeRef.current.instanceColor.needsUpdate = true;

    // Cars dim as the X-ray takes over, so the graph reads over them
    const opacity = 1 - (1 - XRAY_CAR_OPACITY) * wave.p;
    if (beamMat.current) beamMat.current.opacity = 0.22 * (1 - wave.p);
    for (const m of [bodyMat, cabinMat, lightMat, brakeMat]) {
      if (!m.current) continue;
      m.current.opacity = opacity;
      const wantTransparent = wave.p > 0.001;
      if (m.current.transparent !== wantTransparent) {
        m.current.transparent = wantTransparent;
        m.current.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[geo.body, undefined, cars.length]} castShadow>
        <meshStandardMaterial ref={bodyMat} roughness={0.4} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={cabinRef} args={[geo.cabin, undefined, cars.length]}>
        <meshStandardMaterial ref={cabinMat} color="#1e293b" roughness={0.2} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[geo.lights, undefined, cars.length]}>
        <meshStandardMaterial
          ref={lightMat}
          color="#fff7d6"
          emissive="#fff3c4"
          emissiveIntensity={1.4}
        />
      </instancedMesh>
      <instancedMesh ref={brakeRef} args={[geo.brakes, undefined, cars.length]}>
        <meshBasicMaterial ref={brakeMat} toneMapped={false} />
      </instancedMesh>
      {glow && (
        <instancedMesh ref={beamRef} args={[geo.beam, undefined, cars.length]}>
          <meshBasicMaterial
            ref={beamMat}
            color="#fff1c4"
            transparent
            opacity={0.22}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </instancedMesh>
      )}
    </>
  );
}
