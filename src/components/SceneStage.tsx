'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CITIES } from '@/sim/cities';
import { useCityStore } from '@/lib/cityStore';
import { setScene } from '@/lib/sceneStore';
import PinTags from './PinTags';
import NodeLabels from './NodeLabels';

const MapScene = dynamic(() => import('@/scene/MapScene'), { ssr: false });

/**
 * The 3D city, full screen, behind everything. It is mounted once by the root
 * layout and stays alive while the learner moves from the landing page into a
 * topic and between beats, so the camera glides instead of the scene reloading.
 */
export default function SceneStage() {
  const city = CITIES[useCityStore((s) => s.city)];

  useEffect(() => {
    useCityStore.persist.rehydrate();
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setScene({ reducedMotion: query.matches });
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return (
    <div className="fixed inset-0" aria-hidden>
      <MapScene cityId={city.id} graph={city.graph} start={city.start} end={city.end} />
      <NodeLabels graph={city.graph} />
      <PinTags city={city} />
      {/* Darkened corners pull the eye to the middle of the city */}
      <div className="scene-vignette" />
    </div>
  );
}
