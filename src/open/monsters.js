import Enemy from '../entities/Enemy.js';
import { ENEMIES } from '../data/enemies.js';
import { makeOrb } from '../render/models.js';
import { height, biome, region, PLACES, SPAWN, TOWNS } from './terrain.js';
import { CAVE_FLOOR } from './cave.js';
import { TIERS, tierFor, setTier, startEvolving, updateEvolving, animateParts } from './evolve.js';
import { nationAt } from './nations.js';
import { arm, stagger, standDown, TURN_TAKERS, PARRIED } from './foes.js';
import { armBoss, markGround, POWERS, WAVE_REACH, WAVE_SPEED } from './bosses.js';

// Monsters in the open world. They use the game's own Enemy class; this file is the small
// `game` it expects, plus spawning around the hero and the hero's health.
const SIZE = 2.5;            // the hero is a lot bigger here than in the main game
const PACE = 1.8;
const MAX_NEAR = 12;
const SPAWN_FROM = 60, SPAWN_TO = 110, FORGET = 190;
const SPAWN_EVERY = 1.2;     // seconds
const WARD = 200;            // tiles around the Hollow's center that monsters won't enter
const DANGER_SPAN = 1500;    // monsters get one level tougher this many tiles from the start
const ELDER_CHANCE = 0.08;
const HURT_GUARD = 0.7;      // seconds of safety after being hit
const KNOCK_LIMIT = 45;
const EVOLVE_CHECK = 1.5;    // seconds between looks for monsters behind the heroes' level
const EVOLVE_ODDS = 0.3;     // chance each look, so a group changes one by one
const EVOLVE_WATCH = 130;    // tiles: they change where you can see it
const HARDEN_ODDS = 0.1;     // chance a monster that survives a blow starts evolving
const GROUPS = [
  ['slime', 'slime', 'boar', 'fireSlime'],  // meadow
  ['boar', 'fireSlime', 'wolf', 'puffcap'], // autumn wood
  ['puffcap', 'wolf', 'wolf', 'wisp'],      // pine wood
];
const PATROLS = 0.25, PATROL_SIZE = 3; // the chance a spawn on hostile land is a patrol, and its size
const BADLANDS = ['scorpion', 'scorpion', 'golem', 'fireSlime'];
const MARSH = ['lurker', 'lurker', 'puffcap', 'wisp'];
const HEIGHTS = ['wraith', 'wraith', 'golem', 'wolf'];
const HIGH_GROUND = 180;
const BOSS_BAR = 110;        // tiles from a boss that its health bar stays up

// A main-game enemy stretched to open-world size, then made tougher by where it lives.
function fit(def, danger, elder) {
  const grow = elder ? 2 : 1;
  return {
    ...def,
    name: elder ? `Elder ${def.name}` : def.name,
    scale: (def.scale ?? 1) * SIZE * grow,
    radius: def.radius * SIZE * grow,
    speed: def.speed * PACE,
    chaseSpeed: def.chaseSpeed * PACE,
    aggro: def.aggro * SIZE * 2,
    keepAway: def.keepAway?.map((d) => d * SIZE),
    shotSpeed: (def.shotSpeed ?? 0) * PACE,
    hp: def.hp * danger * (elder ? 8 : 1),
    damage: def.damage * danger * (elder ? 2 : 1),
  };
}

export default class Monsters {
  constructor(scene, work, players) {
    Object.assign(this, { scene, work, players });
    this.nightfall = false;
    this.list = [];
    this.orbs = [];
    this.marks = [];
    this.waves = [];
    this.quake = null;
    this.time = 0;
    this.spawnIn = 0;
    this.evolveIn = 0;
    this.player = { x: 0, z: 0, dead: false };
    this.pushing = this.player;
    this.collision = {
      // Land only, so nothing wades in after a swimmer.
      move: (e, dx, dz) => {
        const x = e.group.position.x + dx, z = e.group.position.z + dz;
        if (e.cave ? !e.cave.walk(x - e.cave.x, z - e.cave.z) : height(x, z) < 0.5 || this.walled(x, z, e)) return;
        e.group.position.x = x;
        e.group.position.z = z;
      },
    };
  }

  // Walls and buildings stop monsters too.
  walled(x, z, e) {
    const r = e.radius * 0.6;
    return this.work.marks.solids.some((s) => {
      if (s.r) return Math.hypot(x - s.x, z - s.z) < s.r + r;
      return !s.off && x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r;
    });
  }

  // The rest of what Enemy asks of its game. Damage numbers show on the striker's screen.
  get hud() {
    return (this.work.actor ?? this.players[0]).hud;
  }

  ward(x, z) {
    if (Math.hypot(x - PLACES.hollow.x, z - PLACES.hollow.z) < WARD) return PLACES.hollow;
    return TOWNS.find((T) => (T.kind === 'city' || T.kind === 'village') && Math.hypot(x - T.x, z - T.z) < T.r);
  }

  inVillage(x, z) {
    return !!this.ward(x, z);
  }

  villageCenter() {
    return this.ward(this.pushing.x, this.pushing.z) ?? PLACES.hollow;
  }

  fireOrb(e, dx, dz) {
    const orb = makeOrb();
    orb.scale.setScalar(SIZE);
    orb.position.set(e.x, e.group.position.y + 2, e.z);
    this.scene.add(orb);
    this.orbs.push({ orb, dx, dz, speed: e.def.shotSpeed, damage: e.def.damage, life: 4 });
  }

  onEnemyKilled(e) {
    // Evolved monsters teach more and drop more.
    this.work.skills.add('fighting', 3 * (1 + e.tier));
    const drops = {};
    for (const { item, chance } of e.def.drops) if (Math.random() < chance * (1 + e.tier * 0.4)) drops[item] = 1 + Math.floor(e.tier / 2);
    this.work.give(drops);
    if (e.def.splitInto) for (const side of [-1, 1]) this.add(e.def.splitInto, e.x + side * 2, e.z, this.danger(e.x, e.z), false);
  }

  // Is there room for one more to attack this monster's hero?
  takeTurn(e) {
    return this.list.filter((m) => m.turn && m.foe === e.foe).length < TURN_TAKERS;
  }

  // The warning before an attack: a mark over its head, and a ring on the ground for an area.
  warn(e, move) {
    const hero = e.foe;
    if (!hero) return;
    hero.hud.float('!', e.x, e.group.position.y + 4 * e.group.scale.x * 0.4 + 2, e.z, move.heavy ? '#ff4a3a' : '#ffd24a');
    if (move.area) hero.melee.ring(e.x, e.group.position.y, e.z, move.area + e.radius, '#ff6a4a');
  }

  quakeAt(e, area) {
    const y = e.group.position.y;
    this.work.burst(e.x, y + 0.5, e.z, ['#ff6a4a', '#c9bcc4'], 14, 4 + area * 0.4);
    if (e.foe) e.foe.melee.ring(e.x, y, e.z, area + e.radius, '#ffb28a');
  }

  removeEnemy(e) {
    if (e.heldBy) e.heldBy.melee.drop();
    standDown(e);
    this.list.splice(this.list.indexOf(e), 1);
    e.remove();
  }

  danger(x, z) {
    return 1 + Math.hypot(x - SPAWN.x, z - SPAWN.z) / DANGER_SPAN;
  }

  // `cave`: lives in that cave instead of on the land.
  add(type, x, z, danger, elder, cave = null) {
    const e = new Enemy(this, x, z, fit(ENEMIES[type], danger, elder));
    e.air = 0;
    e.rise = 0;
    e.cave = cave;
    if (POWERS[type]) armBoss(e, type, this);
    else arm(e, type, this);
    e.rootScale = e.model.root.scale.x;
    e.group.position.y = cave ? CAVE_FLOOR : height(x, z);
    const hero = this.nearest(e) ?? this.players[0];
    setTier(e, e.def.boss ? 0 : Math.min(TIERS.length - 1, tierFor(hero.body.level) + (elder ? 1 : 0)), hero);
    this.list.push(e);
    return e;
  }

  spawn(hero) {
    const near = this.list.filter((e) => Math.hypot(e.x - hero.x, e.z - hero.z) < FORGET);
    if (near.length >= MAX_NEAR) return;
    const a = Math.random() * 6.28, d = SPAWN_FROM + Math.random() * (SPAWN_TO - SPAWN_FROM);
    const x = hero.x + Math.cos(a) * d, z = hero.z + Math.sin(a) * d;
    if (height(x, z) < 2 || this.inVillage(x, z)) return;
    const b = biome(x, z), [bad, marsh] = region(x, z);
    const group = bad > 0.5 ? BADLANDS : marsh > 0.5 ? MARSH : height(x, z) > HIGH_GROUND ? HEIGHTS : GROUPS[b.indexOf(Math.max(...b.slice(0, 3)))], type = this.nightfall ? 'wisp' : group[Math.floor(Math.random() * group.length)];
    // A nation still standing keeps soldiers on its land; conquered ground has none.
    const nation = nationAt(x, z);
    if (nation && !this.world.nations.isFallen(nation) && Math.random() < PATROLS) {
      for (let i = 0; i < PATROL_SIZE; i++) this.add('soldier', x + i * 3, z + (i % 2) * 3, this.danger(x, z), false);
      return;
    }
    this.add(type, x, z, this.danger(x, z), Math.random() < ELDER_CHANCE);
  }

  // Closest monster the hero can reach, for the punch to turn toward.
  target(state) {
    let best = null, score = 5;
    for (const e of this.list) {
      if (e.dying) continue;
      const d = Math.hypot(e.x - state.x, e.z - state.z) - e.radius;
      if (d < score) { score = d; best = e; }
    }
    return best;
  }

  within(x, z, range) {
    return this.list.filter((e) => !e.dying && Math.hypot(e.x - x, e.z - z) - e.radius < range);
  }

  // A blow on a monster: heavier blows send it further and throw it into the air.
  hit(e, force, x, z) {
    if (e.dying) return;
    if (e.heldBy) e.heldBy.melee.drop();
    e.takeHit(Math.round(force * 10) / 10, x, z);
    e.recoil = 1;
    this.work.skills.add('fighting', 1);
    if (e.boss) {
      // Far too big to knock about. It only reels from a parry.
      e.knockUntil = 0;
      e.vel.set(0, 0);
      this.work.actor.melee.struck = e;
      return;
    }
    const fling = Math.min(KNOCK_LIMIT, 7 + force * 1.5);
    e.vel.normalize().multiplyScalar(fling);
    e.knockUntil = this.time + 0.2 + Math.min(0.8, force * 0.02);
    e.rise = Math.min(30, force * 1.2);
    e.air = Math.max(e.air, 0.01);
    if (!e.dying) stagger(e, 0.55, this.time);
    this.work.actor.melee.struck = e;
    // A fight it survives can push it over the edge.
    if (!e.dying && e.evolving === undefined && e.tier < TIERS.length - 1 && Math.random() < HARDEN_ODDS) startEvolving(e);
  }

  // `from` is the monster striking, if any; `heavy` attacks can't simply be blocked.
  hurt(p, amount, fromX, fromZ, { heavy: crushing = false, from = null } = {}) {
    const s = p.state;
    if (p.guard > 0 || (p.rooms.house && !p.rooms.house.hostile)) return;
    const answer = p.melee.defend(amount, fromX, fromZ, crushing);
    if (answer.avoided) {
      if (answer.parried && from) stagger(from, PARRIED, this.time, true);
      return;
    }
    amount = answer.amount;
    const heavy = p.body.massScale, taken = Math.max(0.5, (amount * (1 - p.body.guard)) / Math.sqrt(heavy));
    p.hp -= taken;
    p.flinch = 0.28;
    p.guard = HURT_GUARD;
    p.calm = 0;
    p.skills.add('fighting', 0.5);
    p.hud.float(`-${Math.round(taken * 10) / 10}`, s.x, s.y + 2.6, s.z, '#ff7a6a');
    const d = Math.hypot(s.x - fromX, s.z - fromZ) || 1, push = 2.5 / heavy;
    s.x += ((s.x - fromX) / d) * push;
    s.z += ((s.z - fromZ) / d) * push;
    this.work.shake = Math.max(this.work.shake, 0.2);
    this.work.shakeAt = s;
    if (p.hp <= 0) p.down();
    p.hud.setHealth(p.hp / p.body.maxHealth);
  }

  // ---- what bosses' powers leave in the world ----
  startWave(e, color) {
    const y = e.group.position.y;
    this.waves.push({ x: e.x, z: e.z, r: e.radius, hit: new Set(), damage: e.def.damage });
    if (e.foe) e.foe.melee.ring(e.x, y, e.z, WAVE_REACH, color);
    this.work.burst(e.x, y + 1, e.z, [color, '#c9bcc4'], 24, 12);
    this.work.shake = Math.max(this.work.shake, 0.25);
    this.work.shakeAt = (e.foe ?? this.players[0]).state;
  }

  mark(x, z, size, delay, e, color) {
    const hero = e.foe;
    if (hero) hero.melee.ring(x, markGround(x, z), z, size, color);
    this.marks.push({ x, z, size, at: delay, damage: e.def.damage * 1.2, e, color, ticks: 0 });
  }

  fireOrbFrom(x, y, z, dx, dz, e) {
    const orb = makeOrb();
    orb.scale.setScalar(SIZE * 1.6);
    orb.position.set(x, y, z);
    this.scene.add(orb);
    this.orbs.push({ orb, dx, dz, speed: 15, damage: e.def.damage, life: 4, sinks: (y - 1.5) / 1.2 });
  }

  roar(e) {
    const hero = e.foe;
    if (hero) hero.hud.message(`${e.def.name} rages!`, true);
    this.work.shake = Math.max(this.work.shake, 0.4);
    this.work.shakeAt = (hero ?? this.players[0]).state;
    this.work.burst(e.x, e.group.position.y + 6, e.z, [e.kit.color, '#ffffff'], 40, 12);
  }

  updatePowers(dt) {
    for (const w of this.waves) {
      w.r += WAVE_SPEED * dt;
      for (const p of this.players) {
        const d = Math.hypot(p.state.x - w.x, p.state.z - w.z);
        if (!p.rooms.house && !w.hit.has(p) && Math.abs(d - w.r) < 3 && p.state.air < 1.5) {
          w.hit.add(p);
          this.hurt(p, w.damage, w.x, w.z, { heavy: true });
        }
      }
    }
    this.waves = this.waves.filter((w) => w.r < WAVE_REACH);
    for (const m of this.marks) {
      m.at -= dt;
      if (m.at > 0) continue;
      this.quake.pillar(m.x, m.z, 7 + Math.random() * 7, 0);
      this.work.burst(m.x, markGround(m.x, m.z) + 1, m.z, [m.color, '#ffffff'], 12, 8);
      for (const p of this.players) {
        if (!p.rooms.house && p.state.air < 2 && Math.hypot(p.state.x - m.x, p.state.z - m.z) < m.size) this.hurt(p, m.damage, m.x, m.z);
      }
    }
    this.marks = this.marks.filter((m) => m.at > 0);
  }

  // A monster bursts into its next form.
  evolved(e, tier) {
    const hero = this.nearest(e) ?? this.players[0], { accent } = TIERS[tier];
    setTier(e, tier, hero);
    this.work.burst(e.x, e.group.position.y + 2, e.z, [accent, '#ffffff'], 30, 8);
    hero.melee.ring(e.x, e.group.position.y, e.z, 12, accent);
    hero.hud.float(`${e.def.name}!`, e.x, e.group.position.y + 5, e.z, accent);
    this.work.shake = Math.max(this.work.shake, 0.2);
  }

  // Those behind the heroes' level start to change, one at a time, close enough to watch.
  stir() {
    for (const e of this.list) {
      const hero = this.nearest(e);
      if (!hero || e.boss || e.dying || e.evolving !== undefined || e.tier >= tierFor(hero.body.level)) continue;
      if (Math.hypot(e.x - hero.state.x, e.z - hero.state.z) < EVOLVE_WATCH && Math.random() < EVOLVE_ODDS) startEvolving(e);
    }
  }

  // The closest hero this monster can reach. `e` is a monster, or anything with x and z.
  nearest(e) {
    let best = null, d = 1e9;
    for (const p of this.players) {
      if (p.rooms.house !== (e.cave ?? null) && (p.rooms.house || e.cave)) continue;
      const k = Math.hypot(p.state.x - e.x, p.state.z - e.z);
      if (k < d) { d = k; best = p; }
    }
    return best;
  }

  update(dt) {
    this.time += dt;
    const out = this.players.filter((p) => !p.rooms.house);
    if ((this.spawnIn -= dt) <= 0 && out.length) {
      this.spawnIn = SPAWN_EVERY;
      this.spawn(out[Math.floor(Math.random() * out.length)].state);
    }
    if ((this.evolveIn -= dt) <= 0) {
      this.evolveIn = EVOLVE_CHECK;
      this.stir();
    }
    for (const e of [...this.list]) {
      const hero = this.nearest(e);
      const far = hero ? Math.hypot(e.x - hero.state.x, e.z - hero.state.z) : 0;
      if (far > FORGET * 1.3 && !e.cave) {
        this.removeEnemy(e);
        continue;
      }
      // Enemy reads one `player`, so it's pointed at whoever this monster is nearest.
      this.player.dead = !hero;
      e.foe = hero;
      if (hero) {
        this.player.x = hero.state.x;
        this.player.z = hero.state.z;
      }
      if (e.evolving !== undefined && !e.dying) updateEvolving(e, dt, this.time, (m, tier) => this.evolved(m, tier));
      this.pushing = e;
      // One broken monster is taken out of the world; it must never stop the game.
      const wasX = e.group.position.x, wasZ = e.group.position.z;
      try {
        e.update(dt);
        // Ice underfoot steals most of every step.
        const drag = this.world.scars.drag(wasX, wasZ);
        if (drag < 1) {
          e.group.position.x = wasX + (e.group.position.x - wasX) * drag;
          e.group.position.z = wasZ + (e.group.position.z - wasZ) * drag;
        }
      } catch (error) {
        console.error(`${e.def.name} failed and was removed:`, error);
        this.removeEnemy(e);
        continue;
      }
      if (this.list.indexOf(e) < 0) continue;
      animateParts(e, dt, this.time);
      // A blow squashes it, and it springs back.
      if (e.recoil > 0 && !e.dying) {
        e.recoil = Math.max(0, e.recoil - dt * 5);
        const k = Math.sin(e.recoil * Math.PI) * 0.3, root = e.model.root;
        // Slimes reset their own scale every frame; other models hold theirs, so set it outright.
        const base = e.def.model === 'slime' || e.def.model === 'mushroom' ? root.scale.y : e.rootScale;
        root.scale.set(base * (1 + k), base * (1 - k), base * (1 + k));
      }
      // Lunging: a monster about to bite rears up at its target.
      e.model.root.rotation.x = hero && !e.dying && e.evolving === undefined && far < e.radius + 5 ? -0.25 * (1 - far / (e.radius + 5)) : 0;
      if (e.air > 0 || e.rise > 0) {
        e.rise -= 40 * dt;
        e.air = Math.max(0, e.air + e.rise * dt);
        if (!e.air) e.rise = 0;
      }
      e.group.position.y = (e.cave ? CAVE_FLOOR : height(e.x, e.z)) + e.air;
      if (e.heldBy) e.heldBy.melee.carry(e);
      // A thrown monster hits the ground like a bomb.
      if (e.thrown && !e.air && e.thrown.melee) {
        e.thrown.melee.landed(e);
        e.thrown = null;
      }
    }
    for (const o of this.orbs) {
      o.life -= dt;
      o.orb.position.x += o.dx * o.speed * dt;
      o.orb.position.z += o.dz * o.speed * dt;
      if (o.sinks) o.orb.position.y = Math.max(height(o.orb.position.x, o.orb.position.z) + 1.5, o.orb.position.y - o.sinks * dt);
      for (const p of out) {
        if (Math.hypot(o.orb.position.x - p.state.x, o.orb.position.z - p.state.z) < 1) {
          this.hurt(p, o.damage, o.orb.position.x, o.orb.position.z);
          o.life = 0;
        }
      }
      if (o.life <= 0) this.scene.remove(o.orb);
    }
    this.orbs = this.orbs.filter((o) => o.life > 0);
    this.updatePowers(dt);
    // A boss's health stays on the screen of anyone fighting it.
    for (const e of this.list) {
      if (!e.boss) continue;
      for (const p of this.players) {
        if (Math.hypot(p.state.x - e.x, p.state.z - e.z) < BOSS_BAR) {
          p.melee.barOn = e;
          p.melee.barFor = 1;
        }
      }
    }
  }
}
