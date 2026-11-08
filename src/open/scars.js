import { height, forest, roadDistance, region } from './terrain.js';
import { stagger } from './foes.js';
import { shared, SCAR_CELLS, SCAR_SIZE } from './materials.js';

// What powers do to the land itself. The ground around the heroes is a grid of cells, and each
// element lives on it by its own rules, spreading from cell to cell:
//   fire   runs through grass and tears through forest; stops at water, stone and roads
//   ice    creeps out from where it lands and freezes water hard enough to walk on
//   void   rots slowly outward, draining whatever stands on it
//   storm  barely crawls on land, but a charged lake carries it from shore to shore
//   earth  ruptures outward in a spreading line of stone spikes
// Where two meet they react (REACTIONS): fire and ice make blinding steam, earth on fire makes magma,
// lightning runs through a sheet of ice as through water, and void blights whatever it touches so
// it spreads further. A co-op pair's powers mix the same way.
// The grid goes to the shaders as a texture: R scorch, G frost, B rot, A heat.
const CELL = SCAR_SIZE / SCAR_CELLS;  // tiles
const TICK = 0.25;           // seconds between spreads
const STAY = 170;            // tiles from a hero before a cell is forgotten
const MAX_CELLS = 2600, MAX_BURNING = 420;
const BURN_SECS = 4, FROST_SECS = 45, ROT_SECS = 40, CHARGE_SECS = 1.6, RUPTURE_SECS = 0.7, CHAR_SECS = 150;
const SPREAD = { fire: 0.42, ice: 0.34, void: 0.14, storm: 0.3, earth: 0.5 };
const BURN_WORKS = 0.06;      // of a hero's might, per burning cell, per tick
const BITE = 0.55;           // how hard the ground bites, as a share of a blow per second
const HOSTILE_BITE = 0.006;   // share of health a tick on a nation's fire or rot takes
const SLOW = 0.42;           // how fast anything crosses ice
const ICE_SOLID = 0.35;      // frost past this will bear a hero's weight on water
const REGROW = 15 * 60000;   // ms before a burnt tree grows back
const ZAPS_PER_TICK = 5, ROCKS_PER_TICK = 4;
const WET = 0.4;             // ground under this is water
const SNOW_LINE = 285;
const STEAM_SECS = 3, MAGMA_SECS = 7, BLIGHT_GEN = 2, MAGMA_BITE = 1.6;
const SOAK_SECS = 40;        // how long water a Tidebringer leaves keeps the ground wet
const REACTS_PER_TICK = 6;   // reactions shown each tick (they all still happen)
export const REACTIONS = {
  steam: { name: 'Steam', color: '#e8f0f4' },
  magma: { name: 'Magma', color: '#ff7a2a' },
  conduct: { name: 'Conducted', color: '#fff48a' },
  blight: { name: 'Blight', color: '#b06aff' },
};
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const mod = (a) => ((a % SCAR_CELLS) + SCAR_CELLS) % SCAR_CELLS;

export default class Scars {
  constructor(world) {
    this.world = world;
    this.cells = new Map();
    this.tick = 0;
    this.dirty = false;
    this.data = shared.uScars.value.image.data;
    this.burning = 0;
    this.reacts = REACTS_PER_TICK;
  }

  get(i, j) {
    return this.cells.get(i * 100000 + j);
  }

  at(x, z) {
    return this.get(Math.floor(x / CELL), Math.floor(z / CELL));
  }

  make(i, j) {
    const k = i * 100000 + j;
    let c = this.cells.get(k);
    if (c) return c;
    if (this.cells.size >= MAX_CELLS) return null;
    const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, y = height(x, z), bad = region(x, z)[0];
    // Grass carries a fire; forest feeds it; bare badlands, roads and snow give it nothing.
    const fuel = y < 1.5 || y > SNOW_LINE || roadDistance(x, z) < 4 ? 0 : (0.45 + forest(x, z) * 0.55) * (1 - bad * 0.85);
    c = { i, j, k, x, z, y, wet: y < WET, fuel, char: 0, frost: 0, rot: 0, burn: 0, charge: 0, rupture: 0, steam: 0, magma: 0, soak: 0, gen: 0, owner: null, force: 1, trees: null, shown: [] };
    this.cells.set(k, c);
    return c;
  }

  // An element takes hold over a circle of ground. `gen`: how far it may go on spreading.
  // With no `owner` it belongs to a nation, and it's the heroes it hurts.
  mark(kind, x, z, reach, owner, gen, force = 1) {
    if (owner?.rooms.house) return;
    const r = Math.ceil(reach / CELL), ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.hypot(i, j) * CELL > reach) continue;
      const c = this.make(ci + i, cj + j);
      if (c) this.take(c, kind, owner, gen, force);
    }
  }

  // One cell catches. Fire and ice undo each other; water will not burn.
  take(c, kind, owner, gen, force) {
    // The second five Conquerors (v0.54.0): water soaks and douses, blight rots, time leaves ash.
    // Mind and night leave nothing on the land itself.
    if (kind === 'mind' || kind === 'night') return false;
    if (kind === 'water') {
      if (c.burn > 0) {
        c.burn = 0;
        this.burning--;
        this.react('steam', c, owner);
      }
      c.frost = Math.min(c.frost, 0.2);
      c.soak = SOAK_SECS;
      this.dirty = true;
      return true;
    }
    if (kind === 'blight') kind = 'void';
    if (kind === 'time') {
      c.char = Math.max(c.char, 0.85);
      if (c.fuel > 0.3) this.fellTrees(c);
      this.dirty = true;
      return true;
    }
    // Void rots its way into any element already there, and sends it further.
    if (kind === 'void' && (c.burn > 0 || c.frost > 0.2 || c.charge > 0 || c.rupture > 0)) {
      c.gen += BLIGHT_GEN;
      this.react('blight', c, owner);
    }
    if (kind === 'fire') {
      if (c.frost > 0.2) {
        c.frost = 0;
        this.react('steam', c, owner);
        this.dirty = true;
        return false;
      }
      if (c.burn > 0 || c.wet || c.char > 0.7 || this.burning >= MAX_BURNING) return false;
      c.burn = BURN_SECS * (0.7 + c.fuel * 0.8);
      this.burning++;
    } else if (kind === 'ice') {
      if (c.burn > 0) {
        c.burn = 0;
        this.burning--;
        this.react('steam', c, owner);
      }
      if (c.frost >= 1) return false;
      c.frost = 1;
    } else if (kind === 'void') {
      if (c.rot >= 1 || c.wet) return false;
      c.rot = 1;
    } else if (kind === 'storm') {
      if (c.charge > 0) return false;
      c.charge = CHARGE_SECS;
      if (c.frost > ICE_SOLID) this.react('conduct', c, owner);
    } else {
      // Stone driven through fire comes up molten.
      if (c.burn > 0 || c.char > 0.7) {
        c.magma = MAGMA_SECS;
        this.react('magma', c, owner);
      }
      if (c.rupture > 0 || c.wet) return false;
      c.rupture = RUPTURE_SECS;
      c.char = Math.max(c.char, 0.55);
      this.rocks.push(c);
    }
    c.gen = Math.max(c.gen, gen);
    c.owner = owner;
    c.force = force;
    c.kind = kind;
    this.dirty = true;
    return true;
  }

  // What the ground is here, for the hero's feet: ice over water is a floor.
  floor(x, z, y) {
    if (y >= 0) return y;
    const c = this.at(x, z);
    return c && c.frost > ICE_SOLID ? 0.08 : y;
  }

  // How much of a step survives the ground underfoot.
  drag(x, z) {
    const c = this.at(x, z);
    return c && c.frost > ICE_SOLID ? SLOW : 1;
  }

  spread(c, kind, odds) {
    for (const [di, dj] of NEIGHBORS) {
      if (Math.random() > odds) continue;
      const n = this.make(c.i + di, c.j + dj);
      if (!n) continue;
      // Forest keeps a fire going; open ground uses it up. A charged lake carries it whole.
      // Ice carries lightning as well as water does.
      const sheet = (cell) => cell.wet || cell.frost > ICE_SOLID;
      const cost = kind === 'fire' ? (Math.random() < n.fuel * 0.82 ? 0 : 1) : kind === 'storm' && sheet(n) ? 0 : 1;
      if (kind === 'fire' && Math.random() > n.fuel) continue;
      if (kind === 'storm' && !sheet(n) && !sheet(c)) continue;
      this.take(n, kind, c.owner, c.gen - cost, c.force);
    }
  }

  // Trees standing in a burning cell go up with it.
  burnTrees(c) {
    c.trees ??= this.world.chunks.near(c.x, c.z, CELL).filter((o) => o.type === 'tree');
    for (const o of c.trees) {
      if (!this.world.chunks.gone.has(o.id)) this.world.fx.flame(o.x + (Math.random() - 0.5) * 3, o.y + 3 + Math.random() * 11, o.z + (Math.random() - 0.5) * 3, 5, 0.7, 0);
    }
  }

  fellTrees(c) {
    for (const o of c.trees ?? []) {
      if (this.world.chunks.gone.has(o.id)) continue;
      this.world.chunks.remove(o, Date.now() + REGROW);
      this.world.work.burst(o.x, o.y + 6, o.z, ['#ff7a2a', '#3a2c22', '#1a1412'], 10, 6);
    }
    c.trees = null;
  }

  live(c) {
    const dt = TICK, { fx } = this.world;
    if (c.burn > 0) {
      this.burnTrees(c);
      c.burn -= dt;
      c.char = Math.min(1, c.char + dt * 0.7);
      if (c.gen > 0) this.spread(c, 'fire', SPREAD.fire);
      if (c.burn <= 0) {
        c.burn = 0;
        this.burning--;
        this.fellTrees(c);
      }
    }
    if (c.soak > 0) c.soak = Math.max(0, c.soak - dt);
    if (c.frost > 0) {
      c.frost = Math.max(0, c.frost - dt / FROST_SECS);
      if (c.gen > 0 && c.kind === 'ice') {
        this.spread(c, 'ice', SPREAD.ice);
        c.gen = 0;
      }
    }
    if (c.rot > 0) {
      c.rot = Math.max(0, c.rot - dt / ROT_SECS);
      if (c.gen > 0 && c.kind === 'void' && Math.random() < 0.5) {
        this.spread(c, 'void', SPREAD.void * 4);
        c.gen -= 0.5;
      }
      if (Math.random() < 0.03) fx.flame(c.x + (Math.random() - 0.5) * CELL, c.y + 0.3, c.z + (Math.random() - 0.5) * CELL, 1.6, 1, 1);
    }
    if (c.charge > 0) {
      c.charge -= dt;
      if (c.gen > 0) {
        this.spread(c, 'storm', c.wet || c.frost > ICE_SOLID ? 0.95 : SPREAD.storm);
        c.gen = 0;
      }
      if (this.zaps-- > 0) {
        const y = Math.max(c.y, 0) + 0.2, a = Math.random() * 6.28;
        fx.lightning({ x: c.x, y: y + 2, z: c.z }, { x: c.x + Math.cos(a) * CELL * 1.5, y, z: c.z + Math.sin(a) * CELL * 1.5 }, '#fff48a', 0.08);
      }
    }
    if (c.rupture > 0) {
      c.rupture -= dt;
      if (c.gen > 0) {
        this.spread(c, 'earth', SPREAD.earth);
        c.gen = 0;
      }
    }
    if (c.steam > 0) {
      c.steam -= dt;
      if (Math.random() < 0.35) this.world.smoke?.puff(c.x + (Math.random() - 0.5) * CELL, Math.max(c.y, 0) + 0.5, c.z + (Math.random() - 0.5) * CELL, { size: 3, grow: 2.2, life: 2.5, tint: '#eef2f4', alpha: 0.55, lift: 2.5 });
    }
    if (c.magma > 0) {
      c.magma -= dt;
      c.char = 1;
      if (Math.random() < 0.4) fx.flame(c.x + (Math.random() - 0.5) * CELL, c.y + 0.1, c.z + (Math.random() - 0.5) * CELL, 1.8 + Math.random() * 1.6, 0.6, 0);
      if (Math.random() < 0.2) fx.glow(c.x, c.y + 0.4, c.z, CELL * 1.4, '#ff5a1a', 0.5, 1.1);
    }
    if (c.char > 0 && !c.burn) c.char = Math.max(0, c.char - dt / CHAR_SECS);
  }

  // Two elements met in this cell. Everything a reaction does to foes is in harm(); this is the show.
  react(kind, c, owner) {
    if (kind === 'steam') c.steam = STEAM_SECS;
    if (this.reacts-- <= 0) return;
    const { fx, smoke } = this.world, y = Math.max(c.y, 0), r = REACTIONS[kind];
    if (kind === 'steam') smoke?.puff(c.x, y + 0.6, c.z, { size: 5, grow: 2.6, life: 3, tint: '#f4f8fa', alpha: 0.7, lift: 3, spread: 1.4 });
    else if (kind === 'magma') fx.impact('fire', c.x, y, c.z, CELL * 1.2);
    else if (kind === 'conduct') fx.lightning({ x: c.x, y: y + 3, z: c.z }, { x: c.x + (Math.random() - 0.5) * CELL * 3, y, z: c.z + (Math.random() - 0.5) * CELL * 3 }, r.color, 0.18, 0.2);
    else fx.flame(c.x, y + 0.2, c.z, 3, 0.8, 1);
    // Named once in a while, so the player learns what made it happen.
    const now = performance.now();
    if (owner?.hud && now - (this.named?.[kind] ?? 0) > 4000) {
      (this.named ??= {})[kind] = now;
      owner.hud.float(`${r.name}!`, c.x, y + 3, c.z, r.color);
    }
  }

  // What the ground does to the enemies standing on it.
  harm() {
    const { monsters } = this.world;
    for (const e of monsters.list) {
      if (e.dying || e.cave) continue;
      const c = this.at(e.x, e.z);
      if (!c?.owner) continue;
      const { powers, body, nature } = c.owner, bite = body.might * c.force * TICK * BITE * (c.burn > 0 ? nature.pyromancy : 1);
      if (c.burn > 0) {
        powers.sting(e, bite * 0.8);
        powers.burns.set(e, { left: 2, dps: body.might * c.force * 0.12 });
      }
      if (c.rot > 0.25) {
        powers.sting(e, bite * 0.5);
        powers.heal(0.08);
      }
      if (c.charge > 0) {
        powers.sting(e, bite);
        if (!e.boss) stagger(e, 0.3, monsters.time, true);
      }
      if (c.rupture > 0) {
        powers.sting(e, bite * 2);
        e.rise = Math.max(e.rise ?? 0, 9);
        e.air = Math.max(e.air ?? 0, 0.01);
      }
      if (c.magma > 0) {
        powers.sting(e, bite * MAGMA_BITE);
        powers.burns.set(e, { left: 3, dps: body.might * c.force * 0.2 });
      }
      // Lost in the steam: it can't see to fight.
      if (c.steam > 0 && !e.boss) stagger(e, TICK + 0.1, monsters.time, true);
    }
  }

  // Timber burns, and frost leaves anything standing brittle.
  eatWorks() {
    const { sites } = this.world;
    for (const c of this.cells.values()) {
      if (c.burn > 0) {
        this.world.voxels?.ignite(c.x, c.y + 0.8, c.z, CELL * 0.7, c.owner);
        this.world.smoke?.column(c.x, c.y, c.z, 0.5, 1.2);
      }
      if (!c.owner) continue;
      if (c.burn > 0 || c.rupture > 0) {
        sites.scorch(c.x, c.z, c.owner.body.might * BURN_WORKS * c.owner.nature.pyromancy, c.owner);
        if (c.burn > 0) this.world.estates?.scorch(c.x, c.z, c.owner.body.might * BURN_WORKS * c.owner.nature.pyromancy, c.owner);
      }
      else if (c.frost > 0.5) sites.chill(c.x, c.z);
    }
  }

  // Where the ground is burning, a few spots for the fire light: the burning cells, gathered
  // into clumps a few cells wide.
  fires() {
    const out = [];
    for (const c of this.cells.values()) {
      if (c.burn <= 0) continue;
      const near = out.find((f) => Math.hypot(f.x - c.x, f.z - c.z) < CELL * 4);
      if (near) near.strength = Math.min(2, near.strength + 0.15);
      else if (out.length < 8) out.push({ x: c.x, y: c.y, z: c.z, strength: 0.5 });
    }
    return out;
  }

  // Fire and rot set by a nation hurt the heroes who stand in them.
  harmHeroes() {
    for (const p of this.world.players) {
      if (p.rooms.house || p.state.air > 1.5) continue;
      const c = this.at(p.state.x, p.state.z);
      if (c && !c.owner && (c.burn > 0 || c.rot > 0.25)) this.world.monsters.hurt(p, Math.max(0.5, p.body.maxHealth * HOSTILE_BITE), c.x, c.z);
    }
  }

  paint() {
    const { data } = this;
    data.fill(0);
    for (const c of this.cells.values()) {
      const at = (mod(c.j) * SCAR_CELLS + mod(c.i)) * 4;
      data[at] = c.char * 255;
      data[at + 1] = c.frost * 255;
      data[at + 2] = c.rot * 255;
      data[at + 3] = Math.min(1, c.burn / 1.5) * 255;
    }
    shared.uScars.value.needsUpdate = true;
  }

  rise(fx) {
    for (const c of this.rocks.splice(0, ROCKS_PER_TICK)) {
      fx.rock(c.x + (Math.random() - 0.5) * CELL, c.y, c.z + (Math.random() - 0.5) * CELL, 0.7 + Math.random() * 0.9, 7 + Math.random() * 4);
    }
    this.rocks.length = Math.min(this.rocks.length, 60);
  }

  update(dt) {
    this.flames();
    if ((this.tick -= dt) > 0) return;
    this.tick = TICK;
    if (!this.cells.size) return;
    const { players, fx } = this.world;
    this.zaps = ZAPS_PER_TICK;
    this.reacts = REACTS_PER_TICK;
    for (const c of [...this.cells.values()]) {
      this.live(c);
      const idle = !c.char && !c.frost && !c.rot && !c.burn && c.charge <= 0 && c.rupture <= 0 && c.steam <= 0 && c.magma <= 0 && !(c.soak > 0);
      const far = players.every((p) => Math.hypot(p.state.x - c.x, p.state.z - c.z) > STAY);
      if (idle || far) {
        if (c.burn > 0) this.burning--;
        this.cells.delete(c.k);
      }
    }
    this.rise(fx);
    this.harm();
    this.eatWorks();
    this.harmHeroes();
    this.paint();
  }

  // Fire you can see: flames on the burning cells closest to a hero.
  flames() {
    const { fx, players } = this.world, list = [];
    if (!this.burning) return;
    const { x, z } = players[0].state;
    for (const c of this.cells.values()) if (c.burn > 0) list.push(c);
    list.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    for (const c of list.slice(0, 90)) {
      if (Math.random() < 0.5) fx.flame(c.x + (Math.random() - 0.5) * CELL * 1.2, c.y + 0.1, c.z + (Math.random() - 0.5) * CELL * 1.2, 2.4 + Math.random() * 2.4, 0.5, 0);
    }
  }

  rocks = [];
}
