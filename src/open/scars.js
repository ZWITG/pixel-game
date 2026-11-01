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
    c = { i, j, k, x, z, y, wet: y < WET, fuel, char: 0, frost: 0, rot: 0, burn: 0, charge: 0, rupture: 0, gen: 0, owner: null, force: 1, trees: null, shown: [] };
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
    if (kind === 'fire') {
      if (c.frost > 0.2) {
        c.frost = 0;
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
      }
      if (c.frost >= 1) return false;
      c.frost = 1;
    } else if (kind === 'void') {
      if (c.rot >= 1 || c.wet) return false;
      c.rot = 1;
    } else if (kind === 'storm') {
      if (c.charge > 0) return false;
      c.charge = CHARGE_SECS;
    } else {
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
      const cost = kind === 'fire' ? (Math.random() < n.fuel * 0.82 ? 0 : 1) : kind === 'storm' && n.wet ? 0 : 1;
      if (kind === 'fire' && Math.random() > n.fuel) continue;
      if (kind === 'storm' && !n.wet && !c.wet) continue;
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
        this.spread(c, 'storm', c.wet ? 0.95 : SPREAD.storm);
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
    if (c.char > 0 && !c.burn) c.char = Math.max(0, c.char - dt / CHAR_SECS);
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
    }
  }

  // Timber burns, and frost leaves anything standing brittle.
  eatWorks() {
    const { sites } = this.world;
    for (const c of this.cells.values()) {
      if (!c.owner) continue;
      if (c.burn > 0 || c.rupture > 0) sites.scorch(c.x, c.z, c.owner.body.might * BURN_WORKS * c.owner.nature.pyromancy, c.owner);
      else if (c.frost > 0.5) sites.chill(c.x, c.z);
    }
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
    for (const c of [...this.cells.values()]) {
      this.live(c);
      const idle = !c.char && !c.frost && !c.rot && !c.burn && c.charge <= 0 && c.rupture <= 0;
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
