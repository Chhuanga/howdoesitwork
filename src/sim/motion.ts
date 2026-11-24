// Small pure helpers for animation and camera framing. No React, no three.js.

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** 0 → 1 with a soft start and a soft stop. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** 0 → 1, overshooting a little before it settles. Used when things pop in. */
export function easeOutBack(t: number): number {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

/**
 * How far a wave of radius `r` has got with something `d` away from its
 * centre: 0 before the wave arrives, 1 once it has fully passed. `band` is how
 * wide the wave's leading edge is.
 */
export function waveReveal(r: number, d: number, band: number): number {
  return smoothstep((r - d) / band);
}

/**
 * How much to enlarge 3D labels so they are at least `minPx` tall on screen.
 * `worldSize` is the label's height in world units and `pxPerUnit` how many
 * screen pixels one world unit covers at the city's centre. Rounded to tenths
 * so labels are not rebuilt on every tiny resize.
 */
export function labelScale(worldSize: number, pxPerUnit: number, minPx = 12): number {
  return Math.round(clamp(minPx / (worldSize * pxPerUnit), 1, 1.6) * 10) / 10;
}

/**
 * How far back a camera must sit so the whole city, buildings included, fits
 * inside the part of the screen the sheet leaves clear, with a margin.
 *
 * This projects the city's real corners through a
 * perspective camera, so the near edge of a tilted city (which looks bigger)
 * and corners swung out by a rotated view are both accounted for. That makes
 * the city fill the same share of the clear area on every screen.
 *
 *  - `halfW`, `halfD`: half the city's width and depth; `top`: its tallest building
 *  - `aspect`: the whole canvas's width ÷ height; `vfov` in radians
 *  - `elevation`: camera angle above the ground; `azimuths`: every orbit angle
 *    the camera will pass through, so the distance holds still while it sways
 *  - `clearW`, `clearH`: share of the canvas's width and height left clear (0–1)
 *  - `fill`: the most of the clear area the city may take up, e.g. 0.8
 */
export function fitCamera(o: {
  halfW: number;
  halfD: number;
  top: number;
  aspect: number;
  vfov: number;
  elevation: number;
  azimuths: number[];
  clearW: number;
  clearH: number;
  fill: number;
}): number {
  const t = Math.tan(o.vfov / 2);
  const limX = o.clearW * o.fill;
  const limY = o.clearH * o.fill;
  const corners: [number, number, number][] = [];
  for (const x of [-o.halfW, o.halfW])
    for (const z of [-o.halfD, o.halfD]) for (const y of [0, o.top]) corners.push([x, y, z]);

  const fits = (d: number) => {
    for (const az of o.azimuths) {
      const ce = Math.cos(o.elevation);
      const se = Math.sin(o.elevation);
      // Camera position on its orbit, and its forward / right / up directions
      const px = Math.sin(az) * ce * d;
      const py = se * d;
      const pz = Math.cos(az) * ce * d;
      const f = [-Math.sin(az) * ce, -se, -Math.cos(az) * ce];
      const r = [Math.cos(az), 0, -Math.sin(az)];
      const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      for (const [cx, cy, cz] of corners) {
        const v = [cx - px, cy - py, cz - pz];
        const depth = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
        if (depth <= 0.1) return false;
        const sx = (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (depth * t * o.aspect);
        const sy = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (depth * t);
        if (Math.abs(sx) > limX || Math.abs(sy) > limY) return false;
      }
    }
    return true;
  };

  // Further away always fits better, so search for the closest distance that fits
  let lo = 2;
  let hi = 4;
  while (!fits(hi) && hi < 2000) hi *= 2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return Math.max(hi, 6);
}

/**
 * How the camera frames the city in each mode.
 *  - beat: the whole city fits, with a margin, in the part of the screen the
 *    sheet leaves clear, so every junction can be seen and tapped.
 *  - landing: the city is the hero. It is framed against the whole screen and
 *    drawn larger than the screen, so its edges crop off and the card floats
 *    over it. Its middle is nudged only part way out from under the card, so
 *    the city still reads as one picture behind it.
 * `sidePx` / `sheetPx` are what the card covers; the result feeds fitCamera
 * (fill, clearW, clearH) and the camera's view offset (slide, shift, in px).
 */
export const BEAT_FILL = 0.9;
export const LANDING_FILL = 1.3;

export function cameraFrame(
  mode: 'landing' | 'beat',
  view: { width: number; height: number; sidePx: number; sheetPx: number },
): { fill: number; clearW: number; clearH: number; slide: number; shift: number } {
  if (mode === 'landing')
    return { fill: LANDING_FILL, clearW: 1, clearH: 1, slide: view.sidePx / 4, shift: view.sheetPx / 4 };
  return {
    fill: BEAT_FILL,
    clearW: clamp((view.width - view.sidePx) / view.width, 0.3, 1),
    clearH: clamp((view.height - view.sheetPx) / view.height, 0.3, 1),
    slide: view.sidePx / 2,
    shift: view.sheetPx / 2,
  };
}

/**
 * Where the landing page's scan line is, `t` seconds in. Every `period`
 * seconds it sweeps once across the city, from `from` to `to` (distances along
 * the sweep direction), easing in and out over `sweep` seconds; between sweeps
 * it rests, and this returns null.
 */
export function scanBand(t: number, from: number, to: number, period = 9, sweep = 2.6): number | null {
  const s = (((t % period) + period) % period) / sweep;
  if (s >= 1) return null;
  return from + (to - from) * smoothstep(s);
}
