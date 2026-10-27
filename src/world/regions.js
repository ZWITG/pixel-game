// Named regions of the overworld. Each has its own ground color, trees, monsters and life.
// Shapes are soft circles (center x/y, radius r in tiles) with a wobbly edge; everything
// outside them is the meadow. The village is a rectangle defined in generateWorld.js.
export const MEADOW = {
  id: 'meadow', name: 'Sunpetal Meadow', ground: '#58ab4f',
  trees: { oak: 0.7, birch: 0.3 }, flowers: 0.1,
};

export const REGIONS = [
  {
    id: 'spirit', name: 'Spirit Hill', x: 50, y: 9, r: 7.5, ground: '#62b98a',
    trees: { birch: 1 }, treeDensity: 0.05, flowers: 0.18, flowerColors: ['#9fd8ff', '#e8dcff', '#ffffff'],
  },
  {
    id: 'dimwood', name: 'The Dimwood', x: 10, y: 31, r: 10.5, ground: '#3f7d4a',
    trees: { pine: 0.85, oak: 0.15 }, treeDensity: 0.42, flowers: 0.02,
  },
  {
    id: 'lake', name: 'Glimmer Lake', x: 32, y: 31, r: 10, ground: '#5aae55',
    trees: { birch: 0.6, oak: 0.4 }, treeDensity: 0.03, flowers: 0.06,
  },
  {
    id: 'moors', name: 'Thornback Moors', x: 51, y: 29, r: 10.5, ground: '#94a04e',
    trees: { oak: 0.6, pine: 0.4 }, treeDensity: 0.04, flowers: 0.03, flowerColors: ['#ffcd75', '#ef7d57'],
  },
];

const wobble = (x, y) => 0.12 * Math.sin(x * 0.45 + y * 0.2) + 0.08 * Math.sin(y * 0.6 - x * 0.3);

// 0 at a region's center, 1 at its edge, larger outside.
export function regionDistance(region, x, y) {
  return Math.hypot(x - region.x, y - region.y) / region.r + wobble(x, y);
}

export function regionAt(x, y) {
  let best = MEADOW, bestD = 1;
  for (const region of REGIONS) {
    const d = regionDistance(region, x, y);
    if (d < bestD) {
      best = region;
      bestD = d;
    }
  }
  return best;
}

export const REGION_BY_ID = Object.fromEntries([MEADOW, ...REGIONS].map((r) => [r.id, r]));
