import { waveReveal } from '@/sim/motion';

/**
 * The X-ray scan: a circle that grows out from one point. Everything in the
 * scene asks it "have you reached me yet?" and changes as it passes.
 * It is one plain object, updated in place every frame.
 */
export interface Wave {
  /** Centre, in world x/z */
  ox: number;
  oz: number;
  /** Current radius */
  r: number;
  /** Radius at which the whole city is covered */
  max: number;
  /** r ÷ max: 0 = normal city, 1 = full X-ray */
  p: number;
  moving: boolean;
}

/** Width of the wave's leading edge, in world units */
export const WAVE_BAND = 1.3;
/** Seconds for the wave to cross the city */
export const WAVE_SECONDS = 1.5;

export function makeWave(ox: number, oz: number, farthest: number, on: boolean): Wave {
  const max = farthest + WAVE_BAND + 0.1;
  return { ox, oz, r: on ? max : 0, max, p: on ? 1 : 0, moving: false };
}

/** 0 = not reached, 1 = fully X-rayed, for something at world x/z. */
export function reveal(wave: Wave, x: number, z: number): number {
  return waveReveal(wave.r, Math.hypot(x - wave.ox, z - wave.oz), WAVE_BAND);
}
