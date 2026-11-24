import { Edge, Graph, Node } from './graph';
import { rng } from './traffic';
import type { TracedCity } from './data/types';
import { NEW_DELHI } from './data/newdelhi';
import { INDIRANAGAR } from './data/indiranagar';

export type CityId = 'newdelhi' | 'indiranagar';

export interface City {
  id: CityId;
  label: string;
  graph: Graph;
  start: number;
  end: number;
  /** Shown on screen while this city is up, where the map data needs a credit */
  credit?: string;
}

// Both cities are traced from OpenStreetMap (© OpenStreetMap contributors,
// ODbL). Real: junction positions, road names, lengths and shapes, lane
// counts, medians, parks and water. Simplified to fit a phone: only main roads
// are kept, junctions too close to tap apart are drawn as one, and road widths
// are exaggerated. Invented: the traffic.
//
// Central New Delhi: about 3.3 km × 3.8 km, from Connaught Place (B) down past
// India Gate (Q). Each roundabout is one junction. Connaught Place's rings and
// the hexagon around India Gate are drawn, but each is a single junction at
// its centre, so cars cut across the middle instead of circling. Junctions
// closer than 360 m are merged, and a few around Tolstoy Marg are nudged up to
// 85 m apart so each can be tapped.
//
// Indiranagar, Bengaluru: about 1.25 km × 0.95 km around 100 Feet Road.
// Junctions closer than 150 m are drawn as one (10th Main/3rd Main at F,
// 6th Main/Sai Baba Mandir Road at N).

/**
 * Build a city from traced data. Minutes for a road come from its real
 * length: a road `paceMetres` long takes 1.5 to 4 minutes when it is flowing,
 * and about one road in four is jammed and takes roughly twice that.
 * Deterministic for a given seed.
 */
function tracedCity(
  data: TracedCity,
  paceMetres: number,
  seed: number,
  landmarks: { name: string; at: string }[] = [],
  scale = 1,
): Graph {
  const rand = rng(seed);
  const nodes: Node[] = data.junctions.map(([x, z], id) => ({ id, x, z }));
  const edges: Edge[] = [];
  for (const { pair, metres, name, lanes, divided, path } of data.roads) {
    const a = pair.charCodeAt(0) - 65;
    const b = pair.charCodeAt(1) - 65;
    const jammed = rand() < 0.25;
    const pace = jammed ? 5.5 + rand() * 2 : 1.5 + rand() * 2.5;
    const weight = Math.max(1, Math.min(9, Math.round((metres / paceMetres) * pace)));
    const road = { weight, name, lanes, divided };
    edges.push({ id: `${a}-${b}`, from: a, to: b, path, ...road });
    edges.push({ id: `${b}-${a}`, from: b, to: a, path: [...path].reverse(), ...road });
  }
  return {
    width: Math.max(...nodes.map((n) => n.x)),
    depth: Math.max(...nodes.map((n) => n.z)),
    nodes,
    edges,
    scale,
    rings: data.rings,
    areas: data.areas,
    landmarks: landmarks.map(({ name, at }) => {
      const [x, z] = data.junctions[at.charCodeAt(0) - 65];
      return { name, x, z };
    }),
  };
}

export function makeNewDelhi(seed = 4): Graph {
  return tracedCity(NEW_DELHI, 600, seed, [
    { name: 'Connaught Place', at: 'B' },
    { name: 'India Gate', at: 'Q' },
  ], 0.65);
}

export function makeIndiranagar(seed = 9): Graph {
  return tracedCity(INDIRANAGAR, 311, seed);
}

const CREDIT = '© OpenStreetMap contributors';

export const CITIES: Record<CityId, City> = {
  newdelhi: {
    id: 'newdelhi',
    label: 'New Delhi',
    graph: makeNewDelhi(),
    start: 0, // A: north of Connaught Place
    end: 18, // S: Akbar Road, south-west
    credit: CREDIT,
  },
  indiranagar: {
    id: 'indiranagar',
    label: 'Indiranagar',
    graph: makeIndiranagar(),
    start: 0,
    end: 18,
    credit: CREDIT,
  },
};

export const DEFAULT_CITY: CityId = 'newdelhi';
