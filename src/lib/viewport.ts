'use client';

import { useEffect, useState } from 'react';

export interface Viewport {
  /** Visible width, px */
  w: number;
  /** Visible height, px: shrinks as a phone's browser bars show or its keyboard opens */
  h: number;
  /** The root font size, px. It grows on big screens (see globals.css), so sizes in rem follow it */
  rem: number;
}

/** What the server renders with, before the page's script has measured anything */
const FALLBACK: Viewport = { w: 390, h: 800, rem: 16 };

function read(): Viewport {
  const vv = window.visualViewport;
  // A pinch-zoomed visual viewport is not the layout's size, so ignore it then
  const h = vv && vv.scale <= 1.01 ? vv.height : window.innerHeight;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return { w: window.innerWidth, h: Math.round(h), rem };
}

/** The screen's live size. Updates on resize, rotation, and browser bars showing or hiding. */
export function useViewport(): Viewport {
  const [view, setView] = useState<Viewport>(FALLBACK);

  useEffect(() => {
    const sync = () => {
      const next = read();
      setView((v) => (v.w === next.w && v.h === next.h && v.rem === next.rem ? v : next));
    };
    sync();
    const vv = window.visualViewport;
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    vv?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      vv?.removeEventListener('resize', sync);
    };
  }, []);

  return view;
}
