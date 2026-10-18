// Quality levels and automatic reduction on slow devices.
// Level 2 = high, 1 = medium, 0 = low.

const PIXEL_RATIO_CAP = [1, 1.5, 2];

export function initialQualityLevel() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (cores <= 2 || memory <= 2) return 0;
  if (coarse || cores <= 4 || memory <= 4) return 1;
  return 2;
}

export function pixelRatioFor(level) {
  return Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP[level]);
}

// Watches frame times and calls onDrop(newLevel) when frames are persistently slow.
export function createQualityMonitor(startLevel, onDrop) {
  let level = startLevel;
  let samples = [];
  let cooldown = 2; // seconds to ignore after start or after a drop
  return {
    get level() { return level; },
    sample(dtSeconds) {
      if (cooldown > 0) { cooldown -= dtSeconds; return; }
      samples.push(dtSeconds);
      if (samples.length < 90) return;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      samples = [];
      if (avg > 1 / 30 && level > 0) {
        level -= 1;
        cooldown = 2;
        onDrop(level);
      }
    },
  };
}
