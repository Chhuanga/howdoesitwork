'use client';

import { useMemo } from 'react';
import { City } from '@/sim/cities';
import { graphOutline, graphStats } from '@/sim/summary';

interface Props {
  city: City;
  blurb: string;
  selected: boolean;
  onSelect: () => void;
}

/**
 * One city to pick on the front page. Every card has the same parts in the
 * same places: a thumbnail of the city's real road graph, its name, a
 * two-line description and its real size, so the two line up side by side.
 */
export default function CityCard({ city, blurb, selected, onSelect }: Props) {
  const { graph } = city;
  const outline = useMemo(() => graphOutline(graph), [graph]);
  const stats = useMemo(() => graphStats(graph), [graph]);
  const pad = 0.25;

  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className="city-card">
      <span className="city-thumb-box" aria-hidden>
        <svg
          viewBox={`${-pad} ${-pad} ${graph.width + pad * 2} ${graph.depth + pad * 2}`}
          preserveAspectRatio="xMidYMid meet"
          className="city-graph"
        >
          <path d={outline.roads} className="city-graph-roads" vectorEffect="non-scaling-stroke" />
          {outline.dots.map(([x, z], i) => (
            <circle key={i} cx={x} cy={z} r={0.07} className="city-graph-dot" />
          ))}
        </svg>
        {selected && (
          <span className="city-check">
            <svg viewBox="0 0 12 12" width="10" height="10">
              <path d="M2.5 6.2 5 8.6 9.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </span>
      <span className="city-name">{city.label}</span>
      <span className="city-blurb">{blurb}</span>
      <span className="city-stat">
        {stats.junctions} junctions · {stats.roads} roads
      </span>
    </button>
  );
}
