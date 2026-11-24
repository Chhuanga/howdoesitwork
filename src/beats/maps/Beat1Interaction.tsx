'use client';

import { useEffect, useState } from 'react';
import { setScene } from '@/lib/sceneStore';
import CityToggle from '@/components/CityToggle';
import GraphLegend from '@/components/GraphLegend';
import { useReveal } from '@/components/BeatShell';

export default function Beat1Interaction() {
  const [xray, setXray] = useState(false);
  const onReveal = useReveal();

  // Drive the shared scene: this beat shows the plain graph, no search
  useEffect(() => {
    setScene({ xray, dijkstra: null, labels: false, onNodeClick: null });
  }, [xray]);

  const toggle = () => {
    if (!xray) onReveal();
    setXray(!xray);
  };

  return (
    <>
      <CityToggle />
      {xray && <GraphLegend />}
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <button onClick={toggle} className={`pointer-events-auto ${xray ? 'btn-glass glass' : 'btn-primary'}`}>
          {xray ? 'Hide X-ray' : 'Tap X-ray'}
        </button>
      </div>
    </>
  );
}
