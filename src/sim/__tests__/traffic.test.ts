import { describe, it, expect } from 'vitest';
import { Graph, makeGrid } from '../graph';
import { CITIES } from '../cities';
import {
  createTraffic,
  stepTraffic,
  laneKey,
  CAR_LENGTH,
  SECONDS_PER_WEIGHT,
  STOP_LINE,
} from '../traffic';

const DELHI = CITIES.newdelhi.graph;
const isRoad = (g: Graph, a: number, b: number) => g.edges.some((e) => e.from === a && e.to === b);

// One straight road A → B → C, every stretch `weight` minutes
function line(weight: number): Graph {
  const nodes = [0, 1, 2].map((id) => ({ id, x: id, z: 0 }));
  const edges = [[0, 1], [1, 0], [1, 2], [2, 1]].map(([from, to]) => ({
    id: `${from}-${to}`, from, to, weight,
  }));
  return { width: 2, depth: 0, nodes, edges };
}

describe('createTraffic', () => {
  it('places every car on a real road, clear of the others', () => {
    const t = createTraffic(DELHI, 30);
    expect(t.cars).toHaveLength(30);
    for (const c of t.cars) {
      expect(isRoad(DELHI, c.from, c.to)).toBe(true);
      expect(isRoad(DELHI, c.to, c.next)).toBe(true);
      for (const o of t.cars)
        if (o !== c && o.from === c.from && o.to === c.to)
          expect(Math.abs(o.s - c.s)).toBeGreaterThanOrEqual(t.carLength);
    }
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const t = createTraffic(DELHI, 12, 42);
      for (let i = 0; i < 200; i++) stepTraffic(t, 1 / 60);
      return t.cars.map((c) => [c.from, c.to, c.s]);
    };
    expect(run()).toEqual(run());
  });
});

describe('stepTraffic', () => {
  it('an empty road takes weight × SECONDS_PER_WEIGHT to drive', () => {
    for (const weight of [2, 8]) {
      const t = createTraffic(line(weight), 0);
      const lane = t.lanes.get(laneKey(0, 1))!;
      t.cars.push({
        id: 0, from: 0, to: 1, s: 0, v: lane.vmax, dest: 2, next: 2,
        braking: false, wait: 0, colorIndex: 0,
      });
      let time = 0;
      while (t.cars[0].from === 0 && time < 60) {
        stepTraffic(t, 1 / 120);
        time += 1 / 120;
      }
      expect(time).toBeCloseTo(weight * SECONDS_PER_WEIGHT, 1);
    }
  });

  it('cars never overlap, leave the road, or pass the car ahead', () => {
    const t = createTraffic(DELHI, 30);
    for (let step = 0; step < 4000; step++) {
      stepTraffic(t, 1 / 60);
      for (const c of t.cars) {
        expect(isRoad(DELHI, c.from, c.to)).toBe(true);
        const length = t.lanes.get(laneKey(c.from, c.to))!.length;
        expect(c.s).toBeGreaterThanOrEqual(0);
        expect(c.s).toBeLessThanOrEqual(length + 1e-9);
        for (const o of t.cars)
          if (o.id < c.id && o.from === c.from && o.to === c.to)
            expect(Math.abs(o.s - c.s)).toBeGreaterThanOrEqual(t.carLength - 1e-9);
      }
    }
  });

  it('a car queues behind a stopped car instead of driving through it', () => {
    const t = createTraffic(line(2), 0);
    const lane = t.lanes.get(laneKey(0, 1))!;
    const car = (id: number, s: number) => ({
      id, from: 0, to: 1, s, v: 0, dest: 2, next: 2, braking: false, wait: 0, colorIndex: 0,
    });
    t.cars.push(car(0, lane.length - STOP_LINE), car(1, 0));
    t.busyUntil[1] = Infinity; // junction blocked: the front car cannot leave
    for (let i = 0; i < 600; i++) stepTraffic(t, 1 / 60);
    const [front, back] = t.cars;
    expect(front.from).toBe(0);
    expect(back.s).toBeLessThanOrEqual(front.s - CAR_LENGTH);
    expect(back.s).toBeGreaterThan(front.s - CAR_LENGTH * 2);
    expect(back.v).toBe(0);
    expect(back.braking).toBe(true);
  });

  it('traffic keeps flowing: trips finish and nobody is stuck for good', () => {
    const t = createTraffic(DELHI, 30);
    const moved = t.cars.map(() => 0);
    for (let minute = 0; minute < 6; minute++) {
      const before = t.cars.map((c) => `${c.from}>${c.to}`);
      for (let i = 0; i < 1800; i++) stepTraffic(t, 1 / 60);
      t.cars.forEach((c, i) => {
        if (`${c.from}>${c.to}` !== before[i]) moved[i]++;
      });
    }
    expect(t.trips).toBeGreaterThan(30);
    for (const m of moved) expect(m).toBeGreaterThanOrEqual(4);
  });

  it('jammed roads are slower, so cars bunch up on them', () => {
    const t = createTraffic(DELHI, 30);
    const speed = { slow: [0, 0], quick: [0, 0] };
    for (let i = 0; i < 6000; i++) {
      stepTraffic(t, 1 / 60);
      for (const c of t.cars) {
        const w = DELHI.edges.find((e) => e.from === c.from && e.to === c.to)!.weight;
        const bucket = w >= 7 ? speed.slow : w <= 3 ? speed.quick : null;
        if (bucket) {
          bucket[0] += c.v;
          bucket[1]++;
        }
      }
    }
    expect(speed.slow[1]).toBeGreaterThan(0);
    expect(speed.slow[0] / speed.slow[1]).toBeLessThan((speed.quick[0] / speed.quick[1]) * 0.6);
  });

  it('still works on a plain grid', () => {
    const g = makeGrid(4, 4);
    const t = createTraffic(g, 10);
    for (let i = 0; i < 2000; i++) stepTraffic(t, 1 / 60);
    for (const c of t.cars) expect(isRoad(g, c.from, c.to)).toBe(true);
  });
});
