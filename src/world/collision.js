import { SOLID_TILES } from './generateWorld.js';

// Tile-grid and rectangle collision. Entities are treated as squares of half-size `radius`.
export default class Collision {
  constructor(map, rects = []) {
    this.map = map;
    this.rects = rects;
    this.h = map.length;
    this.w = map[0].length;
  }

  solidTile(tx, tz) {
    if (tx < 0 || tz < 0 || tx >= this.w || tz >= this.h) return true;
    return SOLID_TILES.includes(this.map[tz][tx]);
  }

  blocked(x, z, r) {
    for (let tz = Math.floor(z - r); tz <= Math.floor(z + r); tz++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++)
        if (this.solidTile(tx, tz)) return true;
    for (const b of this.rects)
      if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) return true;
    return false;
  }

  // Moves an entity one axis at a time so it slides along walls.
  move(entity, dx, dz) {
    const p = entity.group.position, r = entity.radius;
    if (dx && !this.blocked(p.x + dx, p.z, r)) p.x += dx;
    if (dz && !this.blocked(p.x, p.z + dz, r)) p.z += dz;
  }
}
