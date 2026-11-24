export type Point = [number, number];

export interface TracedRoad {
  /** The two junction letters, e.g. 'AB' */
  pair: string;
  /** Real length of the road between the two junctions */
  metres: number;
  name?: string;
  /** Lanes, both directions together */
  lanes: number;
  /** True where a median separates the two directions */
  divided: boolean;
  /** The road's real shape, from the first junction to the second */
  path: Point[];
}

export interface TracedArea {
  kind: 'park' | 'water';
  points: Point[];
}

export interface TracedCity {
  /** Metres per grid unit */
  unitMetres: number;
  junctions: Point[];
  roads: TracedRoad[];
  /** Ring roads that are drawn but are not part of the graph (see cities.ts) */
  rings: Point[][];
  areas: TracedArea[];
}
