// Which street names can be painted on the map without clipping or piling on
// top of each other. Plain functions, no three.js.

export type P = [number, number];

export interface StreetLabel {
  name: string;
  /** The stretch of road the name is painted along, in world units */
  a: P;
  b: P;
}

/** Roughly how long a name is when painted at `fontSize` (world units) */
export function labelLength(name: string, fontSize: number): number {
  return name.length * fontSize * 0.56;
}

function segDist(p1: P, p2: P, q1: P, q2: P): number {
  const pt = (p: P, a: P, b: P) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
  };
  const cross = (a: P, b: P, c: P) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const meet =
    cross(p1, p2, q1) * cross(p1, p2, q2) < 0 && cross(q1, q2, p1) * cross(q1, q2, p2) < 0;
  if (meet) return 0;
  return Math.min(pt(p1, q1, q2), pt(p2, q1, q2), pt(q1, p1, p2), pt(q2, p1, p2));
}

/** The part of a stretch a painted name actually covers: centred, its own length */
function footprint(l: StreetLabel, fontSize: number): [P, P] {
  const mid: P = [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2];
  const len = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) || 1;
  const half = labelLength(l.name, fontSize) / 2;
  const ux = (l.b[0] - l.a[0]) / len;
  const uz = (l.b[1] - l.a[1]) / len;
  return [
    [mid[0] - ux * half, mid[1] - uz * half],
    [mid[0] + ux * half, mid[1] + uz * half],
  ];
}

/**
 * The names to show. A name is dropped if it is longer than the stretch it
 * sits on (it would run off the road), or if it would come within about a
 * line's height of a name already kept. Longer stretches are kept first.
 */
export function pickStreetLabels(labels: StreetLabel[], fontSize: number): StreetLabel[] {
  const kept: { l: StreetLabel; f: [P, P] }[] = [];
  const byLength = [...labels].sort(
    (x, y) => Math.hypot(y.b[0] - y.a[0], y.b[1] - y.a[1]) - Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]),
  );
  for (const l of byLength) {
    const len = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]);
    if (labelLength(l.name, fontSize) > len * 0.92) continue;
    const f = footprint(l, fontSize);
    if (kept.some((k) => segDist(f[0], f[1], k.f[0], k.f[1]) < fontSize * 1.3)) continue;
    kept.push({ l, f });
  }
  return kept.map((k) => k.l);
}
