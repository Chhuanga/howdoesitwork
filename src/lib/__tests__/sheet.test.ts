import { describe, it, expect } from 'vitest';
import { isSide, nearestSnap, sceneInsets, sheetSnaps, sideGap, sideHeight, sideWidth } from '../sheet';

describe('sheetSnaps', () => {
  it('half fits short content exactly, with no taller stop', () => {
    const s = sheetSnaps(844, 300, 120);
    expect(s).toEqual({ peek: 120, half: 300, full: 300 });
  });

  it('long content is capped at 60% for half and 88% for full', () => {
    const s = sheetSnaps(844, 2000, 120);
    expect(s.half).toBe(Math.round(844 * 0.6));
    expect(sheetSnaps(568, 2000, 120).half).toBe(Math.round(568 * 0.54));
    expect(s.full).toBe(Math.round(844 * 0.88));
  });

  it('content between the two caps makes full fit it exactly', () => {
    expect(sheetSnaps(844, 600, 120).full).toBe(600);
  });

  it('is always ordered peek ≤ half ≤ full and stays on screen', () => {
    for (const viewH of [480, 568, 844, 1080])
      for (const content of [90, 250, 700, 3000]) {
        const s = sheetSnaps(viewH, content, 130);
        expect(s.peek).toBeLessThanOrEqual(s.half);
        expect(s.half).toBeLessThanOrEqual(s.full);
        expect(s.full).toBeLessThan(viewH);
      }
  });
});

describe('nearestSnap', () => {
  const s = { peek: 132, half: 340, full: 720 };

  it('settles on the closest stop after a slow drag', () => {
    expect(nearestSnap(s, 150)).toBe('peek');
    expect(nearestSnap(s, 300)).toBe('half');
    expect(nearestSnap(s, 650)).toBe('full');
  });

  it('a flick carries it one stop in that direction', () => {
    expect(nearestSnap(s, 360, 1)).toBe('full');
    expect(nearestSnap(s, 320, -1)).toBe('peek');
    expect(nearestSnap(s, 700, -1)).toBe('half');
  });

  it('a flick past the last stop stays on it', () => {
    expect(nearestSnap(s, 730, 1)).toBe('full');
    expect(nearestSnap(s, 120, -1)).toBe('peek');
  });

  it('a flick up on a sheet with no taller stop stays put', () => {
    const short = { peek: 120, half: 300, full: 300 };
    expect(short[nearestSnap(short, 300, 1)]).toBe(300);
  });
});

describe('wide screens', () => {
  it('the docked card fits its content but keeps a margin', () => {
    expect(sideHeight(900, 400)).toBe(400);
    expect(sideHeight(900, 5000)).toBe(900 - sideGap(900) * 2);
  });

  it('a phone gives up the bottom of the scene, a wide screen the left', () => {
    expect(sceneInsets(390, 844, 320)).toEqual({ sheetPx: 320, sidePx: 0 });
    const wide = sceneInsets(1440, 900, 320);
    expect(wide.sheetPx).toBe(0);
    expect(wide.sidePx).toBe(sideWidth(1440) + sideGap(900) * 2);
  });
});

describe('which layout a screen gets', () => {
  it('phones and tablets held upright get the bottom sheet', () => {
    for (const [w, h] of [[320, 568], [390, 844], [430, 932], [768, 1024], [820, 1180]]) expect(isSide(w, h), `${w}×${h}`).toBe(false);
  });

  it('laptops, desktops and tablets on their side get the side card', () => {
    for (const [w, h] of [[1024, 768], [1280, 720], [1440, 900], [2560, 1440]]) expect(isSide(w, h), `${w}×${h}`).toBe(true);
  });

  it('a phone on its side gets the side card, because a bottom sheet would leave no city', () => {
    expect(isSide(844, 390)).toBe(true);
    expect(isSide(667, 375)).toBe(true);
  });

  it('a very small phone on its side keeps the bottom sheet: too narrow to split', () => {
    expect(isSide(568, 320)).toBe(false);
  });

  it('the side card is about a third of the screen, between 320 and 460 px', () => {
    expect(sideWidth(667)).toBe(320);
    expect(sideWidth(1100)).toBe(374);
    expect(sideWidth(2560)).toBe(460);
  });

  it('the side card always leaves more than half the width for the city', () => {
    for (const w of [640, 667, 844, 900, 1280, 1920]) expect(sceneInsets(w, 400, 0).sidePx).toBeLessThan(w * 0.56);
  });

  it('on a big screen with larger root text, the card and its margins grow with it', () => {
    expect(sideWidth(2560, 20)).toBe(575);
    expect(sideWidth(1100, 20)).toBe(400);
    expect(sideGap(1440, 20)).toBe(30);
    expect(sceneInsets(2560, 1440, 0, 20).sidePx).toBe(575 + 60);
  });

  it('short screens get a tighter margin', () => {
    expect(sideGap(390)).toBeLessThan(sideGap(900));
  });

  it('a short phone caps the sheet lower than a tall one', () => {
    expect(sheetSnaps(568, 3000, 120).half / 568).toBeLessThan(sheetSnaps(844, 3000, 120).half / 844);
  });
});
