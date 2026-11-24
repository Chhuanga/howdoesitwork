'use client';

/**
 * A small key to the graph's colours, in the corner of the scene. Roads always;
 * dot states only while a search is running (`search`), and the amber route
 * once it is found (`found`).
 */
export default function GraphLegend({ search = false, found = false }: { search?: boolean; found?: boolean }) {
  return (
    <ul className="graph-legend glass" aria-label="Map key">
      <li>
        <i className="lg-road" /> quick road
      </li>
      <li>
        <i className="lg-road lg-slow" /> jammed road (slow)
      </li>
      {search && (
        <>
          <li>
            <i className="lg-dot lg-locked" /> locked in
          </li>
          <li>
            <i className="lg-dot lg-next" /> could be next
          </li>
        </>
      )}
      {found && (
        <li>
          <i className="lg-road lg-route" /> fastest route
        </li>
      )}
      <li className="lg-note">numbers on roads = minutes</li>
    </ul>
  );
}
