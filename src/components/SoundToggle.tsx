'use client';

import { useEffect } from 'react';
import { useSound } from '@/lib/feedback';

/** Turns the little confirmation sounds and buzzes on or off. Remembered between visits. */
export default function SoundToggle() {
  const muted = useSound((s) => s.muted);
  const toggle = useSound((s) => s.toggle);

  useEffect(() => {
    useSound.persist.rehydrate();
  }, []);

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
      className="glass icon-btn pointer-events-auto"
      style={{ position: 'absolute', top: 14, right: 14 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
        {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
    </button>
  );
}
