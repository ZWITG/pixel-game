import { PALETTE, SPRITES, NPC_LOOKS, recolor } from './sprites.js';
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

// Buildings are bigger than a tile, so they are drawn with rectangles instead of grids.
function makeHouse(scene, key, roof, roofShade) {
  const tex = scene.textures.createCanvas(key, 32, 32);
  const ctx = tex.getContext();
  const px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  px(3, 13, 26, 19, '#1a1c2c');
  px(4, 14, 24, 17, '#e8d5b0');
  px(4, 29, 24, 2, '#c9b48c');
  px(13, 21, 6, 11, '#1a1c2c');
  px(14, 22, 4, 10, '#7a5230');
  px(17, 26, 1, 1, '#ffcd75');
  for (const wx of [6, 21]) {
    px(wx, 17, 5, 5, '#1a1c2c');
    px(wx + 1, 18, 3, 3, '#73eff7');
    px(wx + 1, 18, 1, 1, '#f4f4f4');
  }
  for (let y = 0; y < 14; y++) {
    const half = 6 + Math.floor((y * 10) / 13);
    px(16 - half, y, half * 2, 1, '#1a1c2c');
    if (y > 0 && y < 13) px(17 - half, y, half * 2 - 2, 1, y % 3 === 0 ? roofShade : roof);
  }
  tex.refresh();
}

function makeStall(scene) {
  const tex = scene.textures.createCanvas('stall', 32, 20);
  const ctx = tex.getContext();
  const px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  px(0, 0, 32, 7, '#1a1c2c');
  for (let x = 1; x < 31; x++) px(x, 1, 1, 5, Math.floor((x - 1) / 5) % 2 ? '#f4f4f4' : '#b13e53');
  px(2, 7, 2, 6, '#5a3a22');
  px(28, 7, 2, 6, '#5a3a22');
  px(6, 10, 3, 3, '#e04060');
  px(12, 10, 2, 3, '#73eff7');
  px(20, 11, 4, 2, '#ffcd75');
  px(0, 12, 32, 8, '#1a1c2c');
  px(1, 13, 30, 6, '#7a5230');
  px(1, 13, 30, 1, '#a86a3a');
  tex.refresh();
}

export function makeAllTextures(scene) {
  for (const [key, rows] of Object.entries(SPRITES)) {
    if (key !== 'tree') makeSprite(scene, key, rows);
  }
  for (const [look, colors] of Object.entries(NPC_LOOKS)) {
    makeSprite(scene, `npc_${look}`, recolor(SPRITES.hero_0, colors));
  }
  makeHouse(scene, 'house_red', '#b13e53', '#8a2e40');
  makeHouse(scene, 'house_blue', '#3b5dc9', '#2c4498');
  makeHouse(scene, 'house_green', '#257179', '#1a535a');
  makeStall(scene);
  makeTileset(scene);
}
