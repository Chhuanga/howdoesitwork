import { describe, it, expect } from 'vitest';
import { guessQuality, isStruggling, SETTINGS } from '../quality';

describe('guessQuality', () => {
  it('starts weak phones on low', () => {
    expect(guessQuality({ memoryGb: 4, cores: 8 })).toBe('low');
    expect(guessQuality({ memoryGb: 8, cores: 4 })).toBe('low');
    expect(guessQuality({ saveData: true, memoryGb: 16, cores: 12 })).toBe('low');
  });

  it('starts strong or unknown devices on high', () => {
    expect(guessQuality({ memoryGb: 8, cores: 8 })).toBe('high');
    expect(guessQuality({})).toBe('high');
  });
});

describe('isStruggling', () => {
  it('needs a second of frames before it judges', () => {
    expect(isStruggling(new Array(30).fill(1 / 20))).toBe(false);
  });

  it('flags a slow device and leaves a smooth one alone', () => {
    expect(isStruggling(new Array(90).fill(1 / 25))).toBe(true);
    expect(isStruggling(new Array(90).fill(1 / 58))).toBe(false);
  });
});

describe('SETTINGS', () => {
  it('low draws fewer cars and no extras', () => {
    expect(SETTINGS.low.cars).toBeLessThan(SETTINGS.high.cars);
    expect(SETTINGS.low.shadows).toBe(false);
    expect(SETTINGS.low.glow).toBe(false);
  });
});
