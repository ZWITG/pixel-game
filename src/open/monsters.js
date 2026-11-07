import Enemy, { MODELS } from '../entities/Enemy.js';
import { ENEMIES } from '../data/enemies.js';
import { makeOrb } from '../render/models.js';
import { height, biome, region, PLACES, SPAWN, TOWNS } from './terrain.js';
import { CAVE_FLOOR } from './cave.js';
import { TIERS, tierFor, setTier, startEvolving, updateEvolving, animateParts, roleName } from './evolve.js';
import { COMBAT, ROLE_POSTURE } from './combat.js';
import { nationAt } from './nations.js';
import { makeFigure } from './figures.js';
import { makeCreature } from './creatures.js';
import { machineMesh, DOCTRINES } from './doctrines.js';
import { arm, stagger, standDown, TURN_TAKERS } from './foes.js';
import { armBoss, markGround, POWERS, WAVE_REACH, WAVE_SPEED } from './bosses.js';
import { nearSolids } from './solidGrid.js';

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
// Everything that walks the open world wears its new body. The old slime, boar, wisp and
// mushroom models are read as beast shapes here, so one animation drives them all.
MODELS.human = (def) => makeFigure(def.figure ?? def.look, { sword: !!def.sword });
MODELS.beast = (def) => makeCreature(def.shape ?? def.was, def);

const OLD_SHAPES = ['slime', 'boar', 'wisp', 'mushroom'];
const LEAST_TOUGH = 0.75, MOST_TOUGH = 1.9, TOUGH_PER_LEVEL = 0.03;
const PATROLS = 0.14, PATROL_SIZE = 3; // the chance a spawn on hostile land is a patrol, and its size
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
    ...(OLD_SHAPES.includes(def.model) ? { model: 'beast', was: def.model } : {}),
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
        if (e.cave ? !e.cave.walk(x - e.cave.x, z - e.cave.z) : height(x, z) < 0.5 || this.walled(x, z, e)) {
          if (e.flungUntil > this.time && !e.cave && height(x, z) >= 0.5) this.splat(e);
          return;
        }
        e.group.position.x = x;
        e.group.position.z = z;
      },
    };
  }

  // The ground a monster stands on: the land, or the floor of a pit or tunnel dug there.
  groundY(x, z, y = height(x, z)) {
    return this.world.digs?.floor(x, z, y) ?? height(x, z);
  }

  // Walls and buildings stop monsters too.
  walled(x, z, e) {
    const r = e.radius * 0.6;
    return nearSolids(this.work.marks, x, z).some((s) => {
      if (s.off) return false;
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
    this.world.realm.slain(e);
    // The last of a group falls in slow motion.
    const hero = this.work.actor;
    if (hero?.state && this.list.length > 1 && !this.within(hero.state.x, hero.state.z, 45).length) this.work.slow = Math.max(this.work.slow ?? 0, COMBAT.slow.last);
    this.work.actor?.nature.killed();
    // Evolved monsters teach more and drop more.
    this.work.skills.add('fighting', (COMBAT.xp.kill[roleName(e)] ?? 2) * (1 + e.tier * COMBAT.xp.tier) * (e.elder ? 2 : 1));
    this.work.actor?.wrath?.gain(COMBAT.wrath.kill);
    this.work.actor?.powers?.kitDef?.killed?.(this.work.actor.powers, e); // a Gravecaller's kills leave Husks
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

  // Each nation has a level. Under it, its land is dangerous; well over it, its soldiers fold.
  toughness(x, z, hero) {
    const n = nationAt(x, z), left = n && !this.world.nations.isFallen(n);
    return left ? Math.max(LEAST_TOUGH, Math.min(MOST_TOUGH, 1 + (n.level - hero.body.level) * TOUGH_PER_LEVEL)) : 1;
  }

  danger(x, z) {
    return 1 + Math.hypot(x - SPAWN.x, z - SPAWN.z) / DANGER_SPAN;
  }

  // `cave`: lives in that cave instead of on the land.
  add(type, x, z, danger, elder, cave = null) {
    const e = new Enemy(this, x, z, fit(ENEMIES[type], danger, elder));
    e.kind = type;
    e.elder = elder;
    e.air = 0;
    e.rise = 0;
    e.cave = cave;
    if (POWERS[type]) armBoss(e, type, this);
    else arm(e, type, this);
    e.rootScale = e.model.root.scale.x;
    if (e.def.machine) {
      e.model.root.visible = false;
      e.group.add(machineMesh(e.def.machine));
    }
    e.group.position.y = cave ? CAVE_FLOOR : this.groundY(x, z);
    const hero = this.nearest(e) ?? this.players[0];
    e.tough = this.toughness(x, z, hero);
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
      const force = this.world.realm.of(nation.id), kinds = DOCTRINES[nation.id].troops;
      if (force.troops >= 1) {
        for (let i = 0; i < PATROL_SIZE; i++) {
          const e = this.add(kinds[i % kinds.length], x + i * 3, z + (i % 2) * 3, this.danger(x, z), false);
          e.nation = nation.id;
        }
        return;
      }
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

  // A blow on a monster: heavier blows send it further and throw it into the air. `react` names how
  // it's thrown (COMBAT.react); without one, it goes as far as the force sends it. `posture` is the
  // Structure the blow wears down.
  hit(e, force, x, z, react = null, posture = 1) {
    if (e.dying) return;
    if (e.heldBy) e.heldBy.melee.drop();
    e.takeHit(Math.round(force * this.work.actor.nature.edge(e) * 10) / 10, x, z);
    e.recoil = 1;
    this.work.skills.add('fighting', COMBAT.xp.hit);
    this.wear(e, posture);
    if (e.boss) {
      // Far too big to knock about. It only reels from a parry, or when its Structure breaks.
      e.knockUntil = 0;
      e.vel.set(0, 0);
      this.work.actor.melee.struck = e;
      return;
    }
    if (react) return this.react(e, force, react);
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

  // Thrown the way a blow says. Big ones shrug off anything but a stagger until their Structure breaks.
  react(e, force, react) {
    const broken = e.brokenUntil > this.time, big = roleName(e) === 'brute' || e.elder;
    if (big && !broken && react !== 'flinch') react = 'stagger';
    const r = COMBAT.react[react], dir = e.vel.clone().normalize();
    // Dazed first (which stops it dead), then thrown.
    if (!e.dying) stagger(e, Math.max(r.stun, broken ? e.brokenUntil - this.time : 0), this.time, react !== 'flinch' || broken);
    e.vel.copy(dir).multiplyScalar(r.fling);
    e.knockUntil = this.time + Math.max(0.15, r.fling / 30);
    if (r.rise > 0 || e.air > 0) {
      e.rise = r.rise;
      e.air = Math.max(e.air, 0.01);
      if (r.rise > 0) e.hang = 0;
    }
    if (r.down) e.downUntil = this.time + r.down;
    if (r.flung) Object.assign(e, { flungUntil: this.time + r.flung, flungBy: this.work.actor, flungForce: force });
    if (react === 'spike' && e.air > 0) e.spiked = this.work.actor;
    this.work.actor.melee.struck = e;
    if (!e.dying && e.evolving === undefined && e.tier < TIERS.length - 1 && Math.random() < HARDEN_ODDS) startEvolving(e);
  }

  // Wears down a monster's Structure. Full, it's Broken: dazed, open, and ready to be Executed.
  wear(e, amount) {
    if (!amount || e.dying) return;
    e.postureMax ??= ROLE_POSTURE(roleName(e)) * (e.elder ? 1.5 : 1) * (1 + (e.tier ?? 0) * 0.1);
    e.posture = Math.min(e.postureMax, (e.posture ?? 0) + amount);
    e.postureAt = this.time;
    if (e.posture < e.postureMax || e.brokenUntil > this.time) return;
    const secs = COMBAT.broken.foe * (e.boss ? 1.5 : 1), y = e.group.position.y;
    e.brokenUntil = this.time + secs;
    stagger(e, secs, this.time, true);
    e.vel.set(0, 0);
    this.work.burst(e.x, y + 2, e.z, ['#ffffff', '#ffd24a', '#ff5a5a'], 22, 8);
    const hero = this.work.actor ?? this.players[0];
    hero.hud?.float('Broken!', e.x, y + 4.5, e.z, '#ffd24a');
    hero.melee?.ring(e.x, y, e.z, e.radius + 3, '#ffd24a');
    this.work.shake = Math.max(this.work.shake, 0.18);
  }

  // A foe sent flying hits a wall: it hurts more, and it's stuck there a moment.
  splat(e) {
    const by = e.flungBy, y = e.group.position.y;
    e.flungUntil = 0;
    if (by) this.work.actor = by;
    e.takeHit(Math.round((e.flungForce ?? 1) * COMBAT.wall.power * 10) / 10, e.x + Math.sin(e.group.rotation.y), e.z + Math.cos(e.group.rotation.y));
    e.vel.set(0, 0);
    this.wear(e, 2);
    if (!e.dying) stagger(e, COMBAT.wall.stun, this.time, true);
    this.work.burst(e.x, y + 1.5, e.z, ['#f3ead8', '#a89a8c', '#ffffff'], 20, 7);
    by?.hud.float('Wall splat!', e.x, y + 4, e.z, '#ffb547');
    this.work.shake = Math.max(this.work.shake, 0.25);
    if (by) this.work.shakeAt = by.state;
  }

  // `from` is the monster striking, if any; `heavy` attacks can't simply be blocked.
  hurt(p, amount, fromX, fromZ, { heavy: crushing = false, from = null } = {}) {
    const s = p.state;
    if (p.guard > 0 || (p.rooms.house && !p.rooms.house.hostile)) return;
    amount = p.powers.absorb(amount, from);
    const answer = p.melee.defend(amount, fromX, fromZ, crushing, from);
    if (answer.avoided) {
      if (answer.parried && from) stagger(from, answer.perfect ? COMBAT.parried.perfect : COMBAT.parried.plain, this.time, true);
      if (answer.vanished && from && !from.boss) stagger(from, 0.8, this.time, true);
      return;
    }
    amount = answer.amount;
    const heavy = p.body.massScale, taken = Math.max(0.5, (amount * (1 - p.body.guard)) / Math.sqrt(heavy));
    p.hp -= taken;
    p.wrath?.gain((taken / p.body.maxHealth) * COMBAT.wrath.hurt);
    // A smash in progress shrugs the blow off and carries on.
    if (!p.melee.armored) {
      p.flinch = 0.28;
      p.melee.active = null;
      p.melee.hover = 0;
      p.melee.pursuing = null;
    }
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
        // A Frost Mirror near it draws its attention instead.
        const decoy = hero.powers.kitDef?.decoy?.(hero.powers);
        if (decoy && Math.hypot(e.x - decoy.x, e.z - decoy.z) < 25) {
          this.player.x = decoy.x;
          this.player.z = decoy.z;
        }
      }
      if (e.evolving !== undefined && !e.dying) updateEvolving(e, dt, this.time, (m, tier) => this.evolved(m, tier));
      this.pushing = e;
      // One broken monster is taken out of the world; it must never stop the game.
      const wasX = e.group.position.x, wasZ = e.group.position.z;
      // Held still by Stillness: no thought, no motion, a pale glow.
      if (e.frozenUntil > this.time && !e.dying) {
        e.model.mat.emissive?.set('#4a9ad8');
        continue;
      }
      try {
        e.update(dt);
        // Ice underfoot steals most of every step.
        // Quicksand and rifts hold it too.
        const drag = this.world.scars.drag(wasX, wasZ) * (e.sunkUntil > this.time ? 0.2 : 1);
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
      // Knocked flat, or swaying on its feet while Broken.
      if (e.downUntil > this.time && !e.dying) e.model.root.rotation.x = -1.3 * Math.min(1, (e.downUntil - this.time) * 4);
      e.model.root.rotation.z = e.brokenUntil > this.time && !e.dying ? Math.sin(this.time * 13) * 0.16 : 0;
      if (e.air > 0 || e.rise > 0) {
        // Mid-combo it hangs where it was struck.
        if (e.hang > this.time) e.rise = 0;
        else e.rise -= 40 * dt;
        e.air = Math.max(0, e.air + e.rise * dt);
        if (!e.air) {
          e.rise = 0;
          if (e.spiked) {
            e.spiked.melee.spikeLanded(e);
            e.spiked = null;
          }
        }
      }
      // Structure comes back once the blows stop; a Broken foe gets some back when it recovers.
      if (e.brokenUntil && e.brokenUntil <= this.time) {
        e.brokenUntil = 0;
        e.posture = e.postureMax * 0.3;
      } else if (e.posture > 0 && !e.brokenUntil && this.time - e.postureAt > COMBAT.postureRest) e.posture = Math.max(0, e.posture - COMBAT.postureBack * dt);
      // Sunk into sand or a rift: it settles into the ground, and climbs back out when it ends.
      e.sinkNow = (e.sinkNow ?? 0) + ((e.sunkUntil > this.time ? e.sinkTo ?? 1 : 0) - (e.sinkNow ?? 0)) * Math.min(1, dt * 6);
      e.group.position.y = (e.cave ? CAVE_FLOOR : this.groundY(e.x, e.z, e.group.position.y)) + e.air - e.sinkNow;
      if (e.heldBy) e.heldBy.melee.carry(e);
      // A thrown monster hits the ground like a bomb.
      if (e.thrown && !e.air && e.thrown.melee) {
        e.thrown.melee.landed(e);
        e.thrown = null;
      }
    }
    for (const o of this.orbs) {
      if (o.held) {
        o.held = false;
        continue;
      }
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
