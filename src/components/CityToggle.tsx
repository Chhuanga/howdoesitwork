'use client';

import { CITIES, CityId } from '@/sim/cities';
import { useCityStore } from '@/lib/cityStore';

/** Switch between the cities. Sits over the top of the scene; the map credit goes on the bottom edge. */
export default function CityToggle() {
  const city = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);
  const ids = Object.keys(CITIES) as CityId[];

  return (
    <>
      {/* The map credit sits on the bottom edge, away from the toggle */}
      {CITIES[city].credit && (
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="map-credit">
          {CITIES[city].credit}
        </a>
      )}
      <div
        role="group"
        aria-label="City"
        style={{ position: 'absolute', top: 14, left: 0, right: 0 }}
        className="flex flex-col items-center gap-1.5"
      >
        <div className="glass pointer-events-auto relative flex p-1 rounded-full">
          {/* The highlight slides under the chosen city */}
          <span
            className="city-thumb"
            style={{
              width: `calc((100% - 8px) / ${ids.length})`,
              transform: `translateX(${ids.indexOf(city) * 100}%)`,
            }}
          />
          {ids.map((id) => (
            <button
              key={id}
              onClick={() => setCity(id)}
              aria-pressed={city === id}
              className={`relative z-10 w-[clamp(5.5rem,27vw,7.25rem)] py-2 rounded-full text-xs font-semibold transition-colors ${
                city === id ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {CITIES[id].label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
