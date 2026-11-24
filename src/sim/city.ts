import { Graph } from './graph';
import { rng } from './traffic';
import { roadShapes, roadWidth } from './roadPath';

export interface Building {
  /** Centre in grid units: col/row space, where intersections sit on integers */
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  colorIndex: number;
  /** Turn around the vertical axis, in radians. Grid buildings leave it unset. */
  rotation?: number;
}

/**
 * Lay out buildings in the blocks between roads. Each block is split into a
 * 2×2 set of lots, and 2 to 4 of them get a building. Sizes are in grid units
 * (1 = distance between two intersections). Deterministic for a given seed.
 */
export function makeBuildings(graph: Graph, seed = 3, colors = 4): Building[] {
  if (graph.rows === undefined || graph.cols === undefined) {
    return scatterBuildings(graph, seed, colors);
  }
  const rand = rng(seed);
  const out: Building[] = [];
  const lot = 0.34; // roughly half the block, leaving room for road and pavement
  for (let r = 0; r < graph.rows - 1; r++) {
    for (let c = 0; c < graph.cols - 1; c++) {
      const cx = c + 0.5;
      const cz = r + 0.5;
      const filled = 2 + Math.floor(rand() * 3);
      const lots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (let i = lots.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [lots[i], lots[j]] = [lots[j], lots[i]];
      }
      lots.length = filled;
      for (const [sx, sz] of lots) {
        out.push({
          x: cx + sx * lot * 0.5,
          z: cz + sz * lot * 0.5,
          width: lot * (0.75 + rand() * 0.2),
          depth: lot * (0.75 + rand() * 0.2),
          height: 0.25 + rand() * rand() * 1.1,
          colorIndex: Math.floor(rand() * colors),
        });
      }
    }
  }
  return out;
}

const PAVEMENT = 0.02; // strip between a road's edge and the nearest building, in grid units

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function inside(px: number, pz: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Buildings for a city with no regular blocks. Drop lots at random, keep the
 * ones that sit clear of every road, park, lake and each other, and turn each
 * to face its nearest road. Deterministic for a given seed.
 */
function scatterBuildings(graph: Graph, seed: number, colors: number, target = 75): Building[] {
  const rand = rng(seed);
  // Every straight piece of every road, with the clearance it needs
  const pieces: { ax: number; az: number; bx: number; bz: number; half: number }[] = [];
  for (const road of roadShapes(graph)) {
    const half = roadWidth(road.lanes, graph.scale) / 2 + PAVEMENT;
    for (let i = 1; i < road.path.length; i++) {
      const [ax, az] = road.path[i - 1];
      const [bx, bz] = road.path[i];
      pieces.push({ ax, az, bx, bz, half });
    }
  }
  const areas = graph.areas ?? [];
  const out: Building[] = [];
  const margin = 0.25;

  for (let tries = 0; tries < 12000 && out.length < target; tries++) {
    const x = -margin + rand() * (graph.width + margin * 2);
    const z = -margin + rand() * (graph.depth + margin * 2);
    const width = 0.15 + rand() * 0.13;
    const depth = 0.15 + rand() * 0.13;
    const radius = Math.hypot(width, depth) / 2;

    let nearest = Infinity;
    let rotation = 0;
    let blocked = false;
    for (const p of pieces) {
      const d = distToSegment(x, z, p.ax, p.az, p.bx, p.bz);
      if (d < radius + p.half) {
        blocked = true;
        break;
      }
      if (d < nearest) {
        nearest = d;
        rotation = Math.atan2(p.bx - p.ax, p.bz - p.az);
      }
    }
    if (blocked) continue;
    // Keep buildings near a road, so open ground reads as open ground
    if (nearest > 0.75) continue;
    // Nothing gets built on a park or a lake, or hanging over the edge of one
    const onArea = areas.some(
      (a) =>
        inside(x, z, a.points) ||
        a.points.some(([px, pz], i) => {
          const [qx, qz] = a.points[(i + 1) % a.points.length];
          return distToSegment(x, z, px, pz, qx, qz) < radius;
        }),
    );
    if (onArea) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < radius + Math.hypot(o.width, o.depth) / 2 + 0.03)) {
      continue;
    }
    out.push({
      x,
      z,
      width,
      depth,
      height: 0.2 + rand() * rand() * 0.9,
      colorIndex: Math.floor(rand() * colors),
      rotation,
    });
  }
  return out;
}
