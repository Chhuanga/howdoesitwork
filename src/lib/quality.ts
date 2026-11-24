export type Quality = 'high' | 'low';

/**
 * A first guess at what a device can draw smoothly, from what the browser
 * says about it. Phones with little memory or few cores start on 'low'.
 * The scene also watches its own frame rate and steps down if this guess
 * was too hopeful (see FrameWatch in MapScene).
 */
export function guessQuality(device: { memoryGb?: number; cores?: number; saveData?: boolean }): Quality {
  if (device.saveData) return 'low';
  if (device.memoryGb !== undefined && device.memoryGb <= 4) return 'low';
  if (device.cores !== undefined && device.cores <= 4) return 'low';
  return 'high';
}

/** Frames per second below which the scene gives up its extras */
export const SLOW_FPS = 40;

/** Given recent frame times in seconds, is the device struggling? */
export function isStruggling(frameTimes: number[]): boolean {
  if (frameTimes.length < 60) return false;
  const mean = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  return 1 / mean < SLOW_FPS;
}

export const SETTINGS: Record<Quality, { dpr: [number, number]; shadows: boolean; cars: number; glow: boolean }> = {
  high: { dpr: [1, 2], shadows: true, cars: 30, glow: true },
  low: { dpr: [1, 1.25], shadows: false, cars: 14, glow: false },
};
