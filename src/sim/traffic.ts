import { Graph } from './graph';
import { Point, edgePath, pathLength } from './roadPath';

// Seconds a car takes per unit of edge weight on an empty road. Weight =
// travel time, so a weight-8 road takes 8× longer to drive than a weight-1 road.
export const SECONDS_PER_WEIGHT = 0.8;

// All distances are in grid units, speeds in grid units per second.
export const CAR_LENGTH = 0.13;
/** Bumper-to-bumper space a driver leaves when stopped */
export const MIN_GAP = 0.05;
/** Cars wait this far back from the middle of a junction */
export const STOP_LINE = 0.1;
/** After one car enters a junction, the next waits this long: drivers take turns */
export const JUNCTION_HEADWAY = 0.6;
const ACCEL = 2.5;
const BRAKE = 5;
/** A driver stuck this long at a junction gives up and takes another road */
const PATIENCE = 5;

export interface Car {
  id: number;
  from: number;
  to: number;
  /** Distance driven along the current road, 0 → road length */
  s: number;
  /** Current speed */
  v: number;
  /** Where this trip ends */
  dest: number;
  /** The junction it will turn toward after `to` */
  next: number;
  /** True while slowing down or stopped: drives the brake lights */
  braking: boolean;
  /** Seconds spent stopped at the front of a queue */
  wait: number;
  /** Index into the car colour palette */
  colorIndex: number;
}

export interface Lane {
  /** The road's shape in the direction of travel */
  path: Point[];
  length: number;
  /** Speed on an empty road, so that driving it takes weight × SECONDS_PER_WEIGHT */
  vmax: number;
}

export interface Traffic {
  graph: Graph;
  cars: Car[];
  /** One lane per direction of every road, keyed by laneKey(from, to) */
  lanes: Map<string, Lane>;
  /** hop[a][b] = the next junction on the shortest way (by distance) from a to b */
  hop: number[][];
  out: number[][];
  /** Per junction: the time until which it is taken by a car that just entered */
  busyUntil: number[];
  /** Car length and stopped gap for this city: CAR_LENGTH and MIN_GAP times the city's scale */
  carLength: number;
  minGap: number;
  time: number;
  tick: number;
  /** Trips finished so far */
  trips: number;
  rand: () => number;
}

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 0x100000000;
  };
}

export const laneKey = (from: number, to: number) => `${from}>${to}`;

/**
 * Shortest ways between every pair of junctions, by distance (Floyd–Warshall).
 * Drivers here follow the shortest road, not the fastest one. That is what
 * fills the slow roads and makes the jams Maps then routes around.
 */
function nextHops(graph: Graph, lanes: Map<string, Lane>): number[][] {
  const n = graph.nodes.length;
  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
  );
  const hop = Array.from({ length: n }, () => new Array<number>(n).fill(-1));
  for (const e of graph.edges) {
    dist[e.from][e.to] = lanes.get(laneKey(e.from, e.to))!.length;
    hop[e.from][e.to] = e.to;
  }
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (dist[i][k] + dist[k][j] < dist[i][j]) {
          dist[i][j] = dist[i][k] + dist[k][j];
          hop[i][j] = hop[i][k];
        }
  return hop;
}

/** Start a new trip for a car that has just turned onto the road from → to. */
function planTrip(t: Traffic, car: Car): void {
  const n = t.graph.nodes.length;
  if (car.to === car.dest || t.hop[car.to][car.dest] < 0) {
    if (car.to === car.dest) t.trips++;
    // Prefer a destination that does not start with a U-turn
    let pick = -1;
    for (let i = 0; i < 8; i++) {
      const d = Math.floor(t.rand() * n);
      if (d === car.to || t.hop[car.to][d] < 0) continue;
      pick = d;
      if (t.hop[car.to][d] !== car.from) break;
    }
    car.dest = pick < 0 ? t.out[car.to][0] : pick;
  }
  car.next = t.hop[car.to][car.dest];
}

export function createTraffic(graph: Graph, count: number, seed = 11, colors = 4): Traffic {
  const rand = rng(seed);
  const lanes = new Map<string, Lane>();
  const out: number[][] = graph.nodes.map(() => []);
  for (const e of graph.edges) {
    const path = edgePath(graph, e);
    const length = pathLength(path);
    lanes.set(laneKey(e.from, e.to), { path, length, vmax: length / (e.weight * SECONDS_PER_WEIGHT) });
    out[e.from].push(e.to);
  }
  const t: Traffic = {
    graph,
    cars: [],
    lanes,
    hop: [],
    out,
    busyUntil: graph.nodes.map(() => 0),
    carLength: CAR_LENGTH * (graph.scale ?? 1),
    minGap: MIN_GAP * (graph.scale ?? 1),
    time: 0,
    tick: 0,
    trips: 0,
    rand,
  };
  t.hop = nextHops(graph, lanes);

  for (let id = 0; id < count; id++) {
    // Drop each car on a random road, clear of the cars already there
    for (let tries = 0; tries < 60; tries++) {
      const e = graph.edges[Math.floor(rand() * graph.edges.length)];
      const lane = lanes.get(laneKey(e.from, e.to))!;
      const room = lane.length - STOP_LINE;
      if (room <= 0) continue;
      const s = rand() * room;
      const clash = t.cars.some(
        (c) => c.from === e.from && c.to === e.to && Math.abs(c.s - s) < t.carLength + t.minGap,
      );
      if (clash) continue;
      const car: Car = {
        id,
        from: e.from,
        to: e.to,
        s,
        v: lane.vmax * rand(),
        dest: e.to,
        next: -1,
        braking: false,
        wait: 0,
        colorIndex: id % colors,
      };
      planTrip(t, car);
      t.trips = 0;
      t.cars.push(car);
      break;
    }
  }
  return t;
}

/** Is there room for one more car at the start of the road from → to? */
function hasRoom(t: Traffic, queues: Map<string, Car[]>, from: number, to: number): boolean {
  const q = queues.get(laneKey(from, to));
  if (!q || q.length === 0) return true;
  return q[q.length - 1].s >= t.carLength + t.minGap;
}

function stepOnce(t: Traffic, dt: number): void {
  t.time += dt;
  t.tick++;

  // Cars on each lane, front car first
  const queues = new Map<string, Car[]>();
  for (const car of t.cars) {
    const key = laneKey(car.from, car.to);
    const q = queues.get(key);
    if (q) q.push(car);
    else queues.set(key, [car]);
  }
  const keys = [...queues.keys()];
  for (const key of keys) queues.get(key)!.sort((a, b) => b.s - a.s);

  // Start from a different lane each tick so no approach always wins a junction
  for (let k = 0; k < keys.length; k++) {
    const key = keys[(k + t.tick) % keys.length];
    const lane = t.lanes.get(key)!;
    const q = queues.get(key)!;

    for (let i = 0; i < q.length; i++) {
      const car = q[i];
      let gap: number;
      let mayCross = false;

      if (i > 0) {
        // Follow the car ahead
        gap = q[i - 1].s - t.carLength - t.minGap - car.s;
      } else {
        // Front of the queue: go if the junction is free and the next road has room
        mayCross = t.time >= t.busyUntil[car.to] && hasRoom(t, queues, car.to, car.next);
        gap = mayCross ? Infinity : lane.length - STOP_LINE - car.s;
      }

      // Never drive faster than you can stop in the space ahead
      const safe = Math.sqrt(2 * BRAKE * Math.max(gap, 0));
      const before = car.v;
      car.v = Math.min(car.v + ACCEL * dt, lane.vmax, safe);
      car.braking = car.v < before - 1e-6 || car.v < lane.vmax * 0.05;
      car.s += Math.min(car.v * dt, Math.max(gap, 0));

      if (i === 0 && !mayCross && car.v < 1e-3) {
        car.wait += dt;
        if (car.wait > PATIENCE) {
          // Stuck: try any other road out of this junction that has room
          const options = t.out[car.to].filter(
            (o) => o !== car.next && hasRoom(t, queues, car.to, o),
          );
          const forward = options.filter((o) => o !== car.from);
          const pool = forward.length > 0 ? forward : options;
          if (pool.length > 0) car.next = pool[Math.floor(t.rand() * pool.length)];
          car.wait = 0;
        }
      } else {
        car.wait = 0;
      }

      if (mayCross && car.s >= lane.length) {
        // Turn onto the next road
        const over = car.s - lane.length;
        t.busyUntil[car.to] = t.time + JUNCTION_HEADWAY;
        const nextKey = laneKey(car.to, car.next);
        const nextLane = t.lanes.get(nextKey)!;
        const ahead = queues.get(nextKey);
        const limit = ahead && ahead.length > 0
          ? Math.max(0, ahead[ahead.length - 1].s - t.carLength - t.minGap)
          : nextLane.length - STOP_LINE;
        car.from = car.to;
        car.to = car.next;
        car.s = Math.min(over, limit);
        car.v = Math.min(car.v, nextLane.vmax);
        planTrip(t, car);
        if (ahead) ahead.push(car);
        else queues.set(nextKey, [car]);
      }
    }
  }
}

/** Advance the traffic by `dt` seconds, in place. */
export function stepTraffic(t: Traffic, dt: number): void {
  // Small fixed steps keep following distances stable after a slow frame
  const steps = Math.max(1, Math.ceil(dt / 0.04));
  for (let i = 0; i < steps; i++) stepOnce(t, dt / steps);
}
