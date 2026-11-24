import { describe, it, expect } from 'vitest';
import { cameraFrame, easeOutBack, fitCamera, labelScale, scanBand, smoothstep, waveReveal } from '../motion';

describe('easing', () => {
  it('smoothstep runs 0 → 1 and clamps outside', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
    expect(smoothstep(2)).toBe(1);
  });

  it('easeOutBack starts at 0, overshoots, and lands on 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1);
  });
});

describe('waveReveal', () => {
  it('is 0 ahead of the wave, 1 behind it, and in between on its edge', () => {
    expect(waveReveal(2, 5, 1)).toBe(0);
    expect(waveReveal(5.5, 5, 1)).toBeCloseTo(0.5);
    expect(waveReveal(7, 5, 1)).toBe(1);
  });

  it('reaches nearer things first', () => {
    expect(waveReveal(3, 2.5, 1)).toBeGreaterThan(waveReveal(3, 2.9, 1));
  });
});

describe('labelScale', () => {
  it('leaves labels alone when they are already big enough', () => {
    expect(labelScale(0.2, 90)).toBe(1);
  });

  it('enlarges labels on a small screen, up to a limit', () => {
    expect(labelScale(0.2, 46)).toBe(1.3);
    expect(labelScale(0.2, 20)).toBe(1.6);
  });
});

describe('fitCamera', () => {
  const vfov = (46 * Math.PI) / 180;
  const base = { halfW: 8, halfD: 8, top: 1.5, vfov, elevation: 0.73, azimuths: [0], clearW: 1, clearH: 1, fill: 0.8 };

  // Where the city corners land on screen (NDC), at a given distance
  function extent(o: typeof base & { aspect: number }, d: number) {
    let x = 0;
    let y = 0;
    for (const az of o.azimuths) {
      const ce = Math.cos(o.elevation), se = Math.sin(o.elevation);
      const p = [Math.sin(az) * ce * d, se * d, Math.cos(az) * ce * d];
      const f = [-Math.sin(az) * ce, -se, -Math.cos(az) * ce];
      const r = [Math.cos(az), 0, -Math.sin(az)];
      const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      for (const cx of [-o.halfW, o.halfW]) for (const cz of [-o.halfD, o.halfD]) for (const cy of [0, o.top]) {
        const v = [cx - p[0], cy - p[1], cz - p[2]];
        const dep = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
        x = Math.max(x, Math.abs((v[0] * r[0] + v[2] * r[2]) / (dep * Math.tan(vfov / 2) * o.aspect)));
        y = Math.max(y, Math.abs((v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (dep * Math.tan(vfov / 2))));
      }
    }
    return { x, y };
  }

  it('keeps every corner of the city inside the clear area, with a margin', () => {
    for (const o of [
      { ...base, aspect: 0.46, clearH: 0.5 },
      { ...base, aspect: 1.8, clearW: 0.66 },
      { ...base, aspect: 2.4, clearW: 0.75, azimuths: [-0.32, 0, 0.32] },
    ]) {
      const e = extent(o, fitCamera(o));
      expect(e.x).toBeLessThanOrEqual(o.clearW * o.fill + 1e-3);
      expect(e.y).toBeLessThanOrEqual(o.clearH * o.fill + 1e-3);
    }
  });

  it('the city fills the same share of the clear area on any screen', () => {
    for (const o of [
      { ...base, aspect: 0.46, clearH: 0.55 },
      { ...base, aspect: 1.33, clearW: 0.62 },
      { ...base, aspect: 1.78, clearW: 0.7 },
      { ...base, aspect: 2.4, clearW: 0.78 },
    ]) {
      const e = extent(o, fitCamera(o));
      // The tighter side touches the margin, whatever the screen
      const used = Math.max(e.x / (o.clearW * o.fill), e.y / (o.clearH * o.fill));
      expect(used).toBeCloseTo(1, 2);
    }
  });

  it('a narrow phone screen needs the camera further back than a wide one', () => {
    expect(fitCamera({ ...base, aspect: 0.46 })).toBeGreaterThan(fitCamera({ ...base, aspect: 1.8 }));
  });

  it('a smaller fill zooms out', () => {
    expect(fitCamera({ ...base, aspect: 1.8, fill: 0.7 })).toBeGreaterThan(fitCamera({ ...base, aspect: 1.8, fill: 0.9 }));
  });
});

describe('cameraFrame', () => {
  const desk = { width: 1440, height: 900, sidePx: 520, sheetPx: 0 };
  const phone = { width: 390, height: 844, sidePx: 0, sheetPx: 420 };

  it('beats fit the whole city inside the clear area', () => {
    const f = cameraFrame('beat', desk);
    expect(f.fill).toBeLessThan(1);
    expect(f.clearW).toBeCloseTo((1440 - 520) / 1440);
    expect(f.slide).toBe(260);
  });

  it('the landing page draws the city larger than the screen, behind the card', () => {
    for (const v of [desk, phone]) {
      const f = cameraFrame('landing', v);
      expect(f.fill).toBeGreaterThan(1);
      expect(f.clearW).toBe(1);
      expect(f.clearH).toBe(1);
    }
  });

  it('the landing city is nudged out from under the card, but less than in a beat', () => {
    const land = cameraFrame('landing', phone);
    const beat = cameraFrame('beat', phone);
    expect(land.shift).toBeGreaterThan(0);
    expect(land.shift).toBeLessThan(beat.shift);
  });

  it('the landing city is zoomed in relative to a beat on the same screen', () => {
    const base = { halfW: 3.6, halfD: 4.1, top: 1.5, vfov: (46 * Math.PI) / 180, elevation: 0.73, azimuths: [0] };
    for (const v of [desk, phone]) {
      const aspect = v.width / v.height;
      const land = cameraFrame('landing', v);
      const beat = cameraFrame('beat', v);
      expect(fitCamera({ ...base, aspect, ...land })).toBeLessThan(fitCamera({ ...base, aspect, ...beat }));
    }
  });
});

describe('scanBand', () => {
  it('sweeps from one side to the other, then rests', () => {
    expect(scanBand(0, -5, 5)).toBe(-5);
    expect(scanBand(1.3, -5, 5)).toBeCloseTo(0);
    expect(scanBand(2.59, -5, 5)!).toBeGreaterThan(4.9);
    expect(scanBand(4, -5, 5)).toBeNull();
  });

  it('repeats every period', () => {
    expect(scanBand(9 + 1.3, -5, 5)).toBeCloseTo(scanBand(1.3, -5, 5)!);
  });

  it('only sweeps a small share of the time, so it stays a glimpse', () => {
    let on = 0;
    for (let t = 0; t < 9; t += 0.01) if (scanBand(t, 0, 1) !== null) on++;
    expect(on / 900).toBeLessThan(0.35);
  });
});
