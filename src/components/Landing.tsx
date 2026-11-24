'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CITIES, CityId } from '@/sim/cities';
import { useCityStore } from '@/lib/cityStore';
import { setScene } from '@/lib/sceneStore';
import { isSide, sceneInsets, sideGap } from '@/lib/sheet';
import { useViewport } from '@/lib/viewport';
import CityCard from './CityCard';

// Kept to two short lines, so both cards are the same height
const BLURB: Record<CityId, string> = {
  newdelhi: 'Roundabouts and radial avenues',
  indiranagar: 'Mains and crosses off 100 Feet Road',
};

/**
 * The front page: the live city up top, slowly swaying, and a glass panel
 * underneath that says what this is and lets the learner pick a city.
 */
export default function Landing() {
  const city = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);
  const panel = useRef<HTMLElement>(null);
  const view = useViewport();

  // Show the plain city, and tell the camera how tall this panel is
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    // This card is narrower than a beat's, so measure it instead of assuming
    const landingInsets = (card: HTMLElement) => {
      const insets = sceneInsets(view.w, view.h, card.offsetHeight, view.rem);
      return isSide(view.w, view.h)
        ? { ...insets, sidePx: card.offsetWidth + sideGap(view.h, view.rem) * 2 }
        : insets;
    };
    const sync = () =>
      setScene({
        mode: 'landing',
        xray: false,
        dijkstra: null,
        labels: false,
        onNodeClick: null,
        ...landingInsets(el),
      });
    sync();
    const watch = new ResizeObserver(sync);
    watch.observe(el);
    return () => watch.disconnect();
  }, [view.w, view.h, view.rem]);

  return (
    <section ref={panel} className="sheet landing-sheet">
      <div className="sheet-content" style={{ paddingTop: '1.5rem', gap: '1rem',overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <p className="eyebrow">How it works</p>
        <h1 className="hero-title">
          See the computer science <em>inside</em> the apps you use.
        </h1>
        <p className="text-[0.9375rem] text-slate-300 leading-relaxed">
          A real city. See it the way Google Maps does.
        </p>

        <div>
          <p className="eyebrow mb-2" style={{ color: '#64748b' }}>
            Pick a city
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(CITIES) as CityId[]).map((id) => (
              <CityCard
                key={id}
                city={CITIES[id]}
                blurb={BLURB[id]}
                selected={city === id}
                onSelect={() => setCity(id)}
              />
            ))}
          </div>
        </div>

        <Link href="/topics/maps/1" className="btn-primary">
          Find the fastest route →
        </Link>
        <p className="text-[0.625rem] text-slate-500 text-center">
          Map data{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
            © OpenStreetMap contributors
          </a>
        </p>
      </div>
    </section>
  );
}
