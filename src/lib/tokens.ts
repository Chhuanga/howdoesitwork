// Design tokens — import these instead of hardcoding values anywhere.

export const color = {
  bg:          '#0f0f1a',
  surface:     '#13132b',
  border:      'rgba(99,102,241,0.25)',

  // Amber means "the answer": the fastest route, and nothing else. Landmarks,
  // slow roads and warnings use other colours so the eye learns that rule.

  // Node / path states
  nodeDefault: '#6366f1',
  /** Green means "locked in": a dot whose fastest time is final */
  nodeVisited: '#34d399',
  nodePartial: '#c4b5fd', // lavender: the route so far, from the violet A pin
  /** Sky blue means "you can pick this next": waiting dots, their routes, their chips */
  nodeOption:  '#38bdf8',
  nodeCurrent: '#34d399',
  /** A dot no road has reached yet: dark, with a faint ring so it never vanishes */
  nodeUntouched: '#1e2340',
  nodeRing:    '#64748b',
  nodePath:    '#fbbf24',
  nodeStart:   '#a78bfa',
  nodeEnd:     '#f472b6',

  // Edge states
  edgeDefault: '#4f46e5',
  edgeSlow:    '#ef4444', // red, like a jam on a traffic map
  edgeSlowLabel: '#f87171',
  edgePath:    '#fbbf24',
  edgePartial: '#c4b5fd',
  edgeOption:  '#38bdf8',
  /** The light that drives the found route */
  routeGlow:   '#fde68a',

  // Map furniture
  landmark:    '#e0e7ff',
  landmarkPin: '#a5b4fc',
  /** The dotted A-to-S line before a route is found */
  routeHint:   '#cbd5e1',

  // UI
  accent:      '#6366f1',
  accentHover: '#4f46e5',
  text:        '#f1f5f9',
  textMuted:   '#94a3b8',
  textDim:     '#475569',
} as const;

export const HIGH_WEIGHT = 7;  // edges at or above this weight are "slow"
