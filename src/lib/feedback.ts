import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Small sounds and phone buzzes that confirm what the learner just did.
// Sounds are made on the spot with the Web Audio API, so there are no files.

interface SoundState {
  muted: boolean;
  toggle: () => void;
}

export const useSound = create<SoundState>()(
  persist((set) => ({ muted: false, toggle: () => set((s) => ({ muted: !s.muted })) }), {
    name: 'howitworks-sound',
    skipHydration: true,
  }),
);

let audio: AudioContext | null = null;

function tone(freq: number, start: number, length: number, volume: number, type: OscillatorType = 'sine') {
  if (useSound.getState().muted || typeof window === 'undefined') return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const t = audio.currentTime + start;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  } catch {
    // No audio on this device: carry on silently
  }
}

function buzz(pattern: number | number[]) {
  if (useSound.getState().muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not every browser lets pages vibrate
  }
}

/** A dot locked in */
export function playTick() {
  tone(880, 0, 0.09, 0.06);
  buzz(8);
}

/** A wrong pick */
export function playWrong() {
  tone(196, 0, 0.16, 0.05, 'triangle');
  buzz([12, 40, 12]);
}

/** The route is found */
export function playChime() {
  [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.05));
  buzz(24);
}
