import { height, biome, region, roadDistance, WORLD } from './terrain.js';
import { streetDistance } from './cityPlan.js';

// Surveys the whole world once, away from the game, and sends the chart back a strip at a time.
const SIZE = 384, STRIP = 24;
const CONTOUR = 45;        // tiles between contour lines
const INK = [58, 40, 28];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v) => Math.min(1, Math.max(0, v));
const MEADOW = [136, 158, 78], AUTUMN = [182, 124, 66], PINE = [58, 104, 78], BAD = [192, 116, 72], SWAMP = [70, 86, 62];
const SHALLOW = [86, 164, 176], DEEP = [24, 66, 104], SAND = [222, 206, 162], ROCK = [150, 140, 134], SNOW = [238, 240, 246], ROAD = [226, 208, 166];

function paint(x, z, h, west, north) {
  if (h < 0) return mix(SHALLOW, DEEP, clamp(-h / 24));
  const [m, a, p] = biome(x, z), [bad, marsh] = region(x, z);
  let c = [0, 1, 2].map((i) => MEADOW[i] * m + AUTUMN[i] * a + PINE[i] * p);
  c = mix(mix(c, BAD, bad), SWAMP, marsh);
  if (h < 2.2) c = mix(c, SAND, 0.8);
  c = mix(c, ROCK, clamp((h - 170) / 110));
  c = mix(c, SNOW, clamp((h - 290) / 60));
  // Sunlight from the north-west, so the mountains stand up off the page.
  const light = 1 + Math.max(-0.42, Math.min(0.32, ((h - west) + (h - north)) * -0.009));
  c = c.map((v) => v * light);
  if (Math.floor(h / CONTOUR) !== Math.floor(west / CONTOUR) || Math.floor(h / CONTOUR) !== Math.floor(north / CONTOUR)) c = mix(c, INK, 0.26);
  if (roadDistance(x, z) < 12 || streetDistance(x, z) < 6) c = mix(c, ROAD, 0.85);
  return c;
}

self.onmessage = () => {
  const cell = WORLD / SIZE;
  let last = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) last[i] = height((i + 0.5) * cell, 0);
  for (let row = 0; row < SIZE; row += STRIP) {
    const rows = Math.min(STRIP, SIZE - row), data = new Uint8ClampedArray(SIZE * rows * 4);
    for (let j = 0; j < rows; j++) {
      const now = new Float32Array(SIZE), z = (row + j + 0.5) * cell;
      for (let i = 0; i < SIZE; i++) {
        const x = (i + 0.5) * cell, h = now[i] = height(x, z);
        data.set([...paint(x, z, h, i ? now[i - 1] : h, last[i]), 255], (j * SIZE + i) * 4);
      }
      last = now;
    }
    self.postMessage({ row, rows, size: SIZE, data }, [data.buffer]);
  }
};
