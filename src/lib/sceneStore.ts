import { create } from 'zustand';
import type { DijkstraState } from '@/sim/dijkstra';
import type { Quality } from './quality';

// What the one shared 3D scene should be showing right now. The scene lives in
// the root layout and stays mounted between pages; the landing page and each
// beat's interaction write here instead of drawing their own canvas.
export interface SceneState {
  /** 'landing' sways the camera gently; 'beat' holds it still for reading */
  mode: 'landing' | 'beat';
  xray: boolean;
  dijkstra: DijkstraState | null;
  /** Bump to restart the search animation from scratch */
  runKey: number;
  /** Show dot names and best-so-far times */
  labels: boolean;
  onNodeClick: ((id: number) => void) | null;
  /**
   * Draw each waiting dot's route so far on the map, as options to pick. The
   * last leg of each route can be clicked: it calls onNodeClick for that dot.
   */
  optionRoutes: boolean;
  /** The option being pointed at, from its chip or its route on the map */
  hoverOption: number | null;
  /** A dot to shake, for a wrong pick. `at` is a performance.now() time. */
  shake: { id: number; at: number } | null;
  /** Height of the bottom sheet in px, so the camera can keep the city clear of it */
  sheetPx: number;
  /** Width in px that a side-docked card takes from the left, on wide screens */
  sidePx: number;
  /** The viewer asked their device for less motion */
  reducedMotion: boolean;
  /** 'low' drops shadows, glow and some cars so slow phones stay smooth */
  quality: Quality;
  /**
   * How much to enlarge 3D labels so they stay readable when the city is drawn
   * small (a narrow phone). 1 on a roomy screen, up to 1.6 on a tight one.
   */
  textScale: number;
  /** Where a dot is on screen, in px, `lift` world units above the ground. Set by the scene; null until it is ready. */
  projectNode: ((id: number, lift?: number) => { x: number; y: number } | null) | null;
  /** How far the X-ray has revealed a dot, 0 to 1. Set by the scene; null until it is ready. */
  nodeReveal: ((id: number) => number) | null;
}

export const useSceneStore = create<SceneState>(() => ({
  mode: 'beat',
  xray: false,
  dijkstra: null,
  runKey: 0,
  labels: false,
  onNodeClick: null,
  optionRoutes: false,
  hoverOption: null,
  shake: null,
  sheetPx: 300,
  sidePx: 0,
  reducedMotion: false,
  quality: 'high',
  textScale: 1,
  projectNode: null,
  nodeReveal: null,
}));

export const setScene = (patch: Partial<SceneState>) => useSceneStore.setState(patch);
