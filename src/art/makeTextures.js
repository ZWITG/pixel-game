import { PALETTE, SPRITES } from './sprites.js';
import { TILE } from '../world/generateWorld.js';

function paint(ctx, rows, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    });
  });
}

function makeSprite(scene, key, rows) {
  const w = Math.max(...rows.map((r) => r.length));
  const tex = scene.textures.createCanvas(key, w, rows.length);
  paint(tex.getContext(), rows);
  tex.refresh();
}

// Simple seeded noise so tiles look the same every run.
function speckle(ctx, ox, base, dots, seed) {
  ctx.fillStyle = base;
  ctx.fillRect(ox, 0, 16, 16);
  let s = seed;
  for (const [color, count] of dots) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      s = (s * 9301 + 49297) % 233280;
      const x = s % 16;
      s = (s * 9301 + 49297) % 233280;
      const y = s % 16;
      ctx.fillRect(ox + x, y, 1, 1);
    }
  }
}

function makeTileset(scene) {
  const count = Object.keys(TILE).length;
  const tex = scene.textures.createCanvas('tiles', 16 * count, 16);
  const ctx = tex.getContext();
  const ox = (t) => t * 16;

  speckle(ctx, ox(TILE.GRASS), '#3a8f4a', [['#2f7a3e', 14], ['#4fa85a', 8]], 7);
  speckle(ctx, ox(TILE.FLOWERS), '#3a8f4a', [['#2f7a3e', 10], ['#4fa85a', 6]], 11);
  for (const [x, y, c] of [[3, 4, '#ffcd75'], [11, 3, '#f4f4f4'], [6, 11, '#ef7d57'], [13, 12, '#ffcd75']]) {
    ctx.fillStyle = c;
    ctx.fillRect(ox(TILE.FLOWERS) + x, y, 1, 1);
  }
  speckle(ctx, ox(TILE.PATH), '#c9a46a', [['#b08850', 16], ['#dcbc84', 8]], 23);
  speckle(ctx, ox(TILE.WATER), '#3b5dc9', [['#41a6f6', 10]], 5);
  ctx.fillStyle = '#73eff7';
  for (const [x, y] of [[2, 4], [3, 4], [4, 4], [9, 10], [10, 10], [11, 10]]) ctx.fillRect(ox(TILE.WATER) + x, y, 1, 1);
  speckle(ctx, ox(TILE.TREE), '#3a8f4a', [['#2f7a3e', 14]], 7);
  paint(ctx, SPRITES.tree, ox(TILE.TREE), 0);

  tex.refresh();
}

export function makeAllTextures(scene) {
  for (const [key, rows] of Object.entries(SPRITES)) {
    if (key !== 'tree') makeSprite(scene, key, rows);
  }
  makeTileset(scene);
}
