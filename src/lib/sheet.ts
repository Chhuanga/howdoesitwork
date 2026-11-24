// How tall the sheet is, where it rests, and how much of the screen it takes
// from the 3D scene. Plain functions, so they can be tested without a browser.

export type Snap = 'peek' | 'half' | 'full';
export type Snaps = Record<Snap, number>;

/** From this screen width up, the sheet becomes a card docked at the side */
export const WIDE = 900;
/** A screen this short and at least this wide (a phone on its side) docks the card too */
export const SHORT = 520;
export const LANDSCAPE_MIN_WIDTH = 640;

// These three rules are mirrored in globals.css, which applies them before
// the page's script has run. Change them in both places.

/** Should the sheet be a card at the side, instead of a sheet at the bottom? */
export function isSide(viewW: number, viewH: number): boolean {
  return viewW >= WIDE || (viewH < SHORT && viewW >= LANDSCAPE_MIN_WIDTH && viewW > viewH);
}

// Sizes below take `rem`, the root font size in px. It is 16 on most screens
// and grows on big ones (see the `html` rule in globals.css), so the card and
// its margins grow with the text inside them.

/** Width of the side card: about a third of the screen, between 20rem and 28.75rem */
export function sideWidth(viewW: number, rem = 16): number {
  return Math.round(Math.min(28.75 * rem, Math.max(20 * rem, viewW * 0.34)));
}

/** Space between the side card and the screen's edges: tighter on short screens */
export function sideGap(viewH: number, rem = 16): number {
  return (viewH < SHORT ? 0.75 : 1.5) * rem;
}

/**
 * The sheet's three resting heights on a phone.
 * `content` is the full height of everything in the sheet and `header` the
 * height of just its handle and question.
 *  - peek: only the question, so the city is in full view
 *  - half: fits the content, but never more than 60% of the screen (54% on a short phone)
 *  - full: fits the content up to 88% of the screen, for reading a long reveal
 * A sheet whose content already fits in `half` has no taller stop.
 */
export function sheetSnaps(viewH: number, content: number, header: number): Snaps {
  const peek = Math.min(header, Math.round(viewH * 0.4));
  // A short phone keeps a little more of its screen for the city
  const cap = viewH < 640 ? 0.54 : 0.6;
  const half = Math.max(peek, Math.min(content, Math.round(viewH * cap)));
  const full = Math.max(half, Math.min(content, Math.round(viewH * 0.88)));
  return { peek, half, full };
}

/**
 * Where a released sheet should rest. A firm flick (px per ms, positive =
 * growing) carries it one stop further in that direction; otherwise it goes
 * to the closest stop.
 */
export function nearestSnap(snaps: Snaps, height: number, velocity = 0): Snap {
  const order: Snap[] = ['peek', 'half', 'full'];
  const closest = order.reduce((a, b) => (Math.abs(snaps[b] - height) < Math.abs(snaps[a] - height) ? b : a));
  if (Math.abs(velocity) < 0.45) return closest;
  const above = order.filter((s) => snaps[s] > height + 1);
  const below = order.filter((s) => snaps[s] < height - 1);
  if (velocity > 0) return above[0] ?? closest;
  return below[below.length - 1] ?? closest;
}

/** Height of the docked card on a wide screen: its content, within the screen's margins. */
export function sideHeight(viewH: number, content: number, rem = 16): number {
  return Math.min(content, viewH - sideGap(viewH, rem) * 2);
}

/**
 * What the sheet takes from the scene: px off the bottom on a phone, px off
 * the left on a wide screen. The camera keeps the city in what is left.
 */
export function sceneInsets(
  viewW: number,
  viewH: number,
  sheetHeight: number,
  rem = 16,
): { sheetPx: number; sidePx: number } {
  return isSide(viewW, viewH)
    ? { sheetPx: 0, sidePx: sideWidth(viewW, rem) + sideGap(viewH, rem) * 2 }
    : { sheetPx: sheetHeight, sidePx: 0 };
}
