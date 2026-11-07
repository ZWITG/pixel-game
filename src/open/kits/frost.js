import * as THREE from 'three';
import { stagger } from '../foes.js';

// The Frostwarden's kit (v0.36.0): ice as weapons, glaciers and stillness. Same shape as kits/titan.js.
//   Frostforge: the Frostwarden fights with an ice weapon that changes the rush chain (WEAPONS).
//   The Frostforge power swaps it: Blade, Maul, Glaive, and from Mastery 12 the Bow.
//   Shatter: a smash or Execute on a frozen foe (or one sealed in a Crystal Prison) does three times
//   the harm and bursts into shards that hit what's near.
// Hooks: weapon (melee reads it), smashed (Shatter), afflicted (frost marks a foe frozen), absorb (Frost
// Armor freezes whoever strikes it), onPunch (the Bow), decoy (Frost Mirror), tick, finisher.
export const WEAPONS = {
  blade: { name: 'Ice Blade', time: 0.8, power: 0.95, posture: 1, reach: 0, all: false, color: '#dff4ff' },
  maul: { name: 'Ice Maul', time: 1.5, power: 1.7, posture: 2.2, reach: 0, all: false, shatter: 1.5, color: '#bfeaff' },
  glaive: { name: 'Ice Glaive', time: 1.15, power: 1.1, posture: 1, reach: 4.5, all: true, color: '#cfefff' },
  bow: { name: 'Ice Bow', time: 1, power: 1, posture: 1, reach: 0, all: false, ranged: true, color: '#e8f8ff' },
};
const ORDER = ['blade', 'maul', 'glaive', 'bow'];
const BOW_MASTERY = 12, SHATTER = 3, SHATTER_REACH = 5;
const ICE = ['#dff4ff', '#8fe0ff', '#ffffff'];
const time = (set) => set.player.melee.monsters.time;
const near = (set, x, z, r) => set.player.melee.monsters.within(x, z, r);
const ground = (set, x, z) => set.player.melee.height(x, z);

const frozen = (set, e) => e.frostUntil > time(set) || e.prisonUntil > time(set);

function freeze(set, pid, e, chill, rank = 0) {
  set.afflict(pid, e, { status: 'freeze', chill }, rank);
}

// Ice weapons in the hand: one mesh each, made once and hung on the hand bone of the current hero.
const iceMat = new THREE.MeshLambertMaterial({ color: '#d8f4ff', emissive: '#4ac0f0', emissiveIntensity: 0.8, flatShading: true, transparent: true, opacity: 0.92 });
function weaponMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'blade') {
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 2.2, 4).translate(0, -1.25, 0), iceMat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.14).translate(0, -0.12, 0), iceMat));
  } else if (kind === 'maul') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6).translate(0, -0.55, 0), iceMat));
    g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0).translate(0, -1.2, 0), iceMat));
  } else if (kind === 'glaive') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6).translate(0, -0.9, 0), iceMat));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 4).translate(0, -2.9, 0), iceMat));
  } else {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 16, Math.PI).rotateZ(Math.PI / 2), iceMat));
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
const MESHES = {};

export const FROST = {
  weapon(set) {
    return WEAPONS[set.weapon ?? 'blade'];
  },

  afflicted(set, e, def) {
    if (def?.status !== 'freeze' || e.dying) return;
    e.frostUntil = Math.max(e.frostUntil ?? 0, time(set) + 1 + (def.chill ?? 1) * 1.5);
  },

  // A smash on a frozen foe: Shatter.
  smashed(set, e) {
    if (!frozen(set, e)) return 1;
    const p = set.player, wpn = FROST.weapon(set), mult = SHATTER * (wpn.shatter ?? 1) * (p.world.scars.at(e.x, e.z)?.frost > 0.35 ? 1.3 : 1);
    e.frostUntil = 0;
    e.prisonUntil = 0;
    p.hud.float('Shatter!', e.x, e.group.position.y + 4, e.z, '#dff4ff');
    set.fx.impact('ice', e.x, ground(set, e.x, e.z), e.z, 4);
    p.world.vfx.burst(e.x, e.group.position.y + 1.5, e.z, ICE, 30, 16);
    // The shards fly into whatever stands near.
    for (const o of near(set, e.x, e.z, SHATTER_REACH)) if (o !== e) set.harm('shards', o, p.melee.force * 0.8);
    p.world.work.impact = 0.05;
    return mult;
  },

  // Frost Armor: whoever lands a blow on it is frozen where they stand.
  absorb(set, amount, from) {
    if (!(set.armorUntil > time(set)) || !from || from.dying) return amount;
    if (!from.boss) stagger(from, 1.4, time(set), true);
    from.frostUntil = time(set) + 2.5;
    set.fx.crystal(from.x, ground(set, from.x, from.z), from.z, 1.6, 0.8);
    set.player.hud.float('Frozen!', from.x, from.group.position.y + 4, from.z, '#bfeaff');
    return amount;
  },

  // With the Bow in hand, Square looses a charged ice arrow instead of a punch.
  onPunch(set) {
    if (set.weapon !== 'bow' || (set.bowWait ?? 0) > time(set)) return set.weapon === 'bow';
    set.bowWait = time(set) + 0.35;
    const def = { name: 'Ice Arrow', power: 1.1, speed: 90, range: 70, pierce: true, status: 'freeze', chill: 0.8, size: 0.5 };
    const rank = set.rank('flash');
    set.bolt({ pid: 'flash', def, rank, force: set.player.melee.force * 1.1, color: '#dff4ff' }, set.aim());
    set.casting = 0.25;
    set.pose = 'punch';
    return true;
  },

  // Change weapon: Blade, Maul, Glaive, and the Bow once Mastery reaches 12.
  forge(set) {
    const list = ORDER.filter((k) => k !== 'bow' || set.mastery >= BOW_MASTERY), now = set.weapon ?? 'blade';
    set.weapon = list[(list.indexOf(now) + 1) % list.length];
    const s = set.player.state;
    set.player.hud.message(`Frostforge: ${WEAPONS[set.weapon].name}`);
    set.player.world.vfx.burst(s.x, s.y + s.air + 1.6, s.z, ICE, 24, 8);
    set.keepReady = 'flash';
  },

  // Ice spears rain on the target area, each pinning what it hits.
  hail(set, job, aim) {
    set.strike(job, aim);
  },

  // Seal one foe in crystal: it can do nothing until it's broken (and breaking it Shatters).
  prison(set, job, aim) {
    const { def, rank } = job, e = aim.target ?? near(set, aim.x, aim.z, 6)[0];
    if (!e) return set.player.hud.message('Nothing to seal.');
    const secs = (def.secs + rank * 0.4) * (e.boss || e.elder ? 0.4 : 1);
    stagger(e, secs, time(set), true);
    e.vel.set(0, 0);
    e.prisonUntil = time(set) + secs;
    set.fx.crystal(e.x, ground(set, e.x, e.z), e.z, secs, 1 + e.radius * 0.6);
    set.player.world.vfx.shock(e.x, ground(set, e.x, e.z), e.z, e.radius + 3, '#bfeaff', 0.35);
    set.harm(job.pid, e, job.force);
  },

  // An ice copy of you that draws every attack near it, then bursts and freezes them.
  mirror(set, job, aim) {
    const p = set.player, s = p.state, { def, rank } = job, x = s.x, z = s.z;
    set.decoy = { x, z, until: time(set) + def.secs + rank * 0.5 };
    set.fx.crystal(x, ground(set, x, z), z, def.secs + rank * 0.5, 1.3);
    const glow = set.fx.glow(x, ground(set, x, z) + 2, z, 3, '#bfeaff', def.secs + rank * 0.5, 1);
    // Step back out of it.
    const len = Math.hypot(aim.dx, aim.dz) || 1;
    p.melee.blink(s, s.x - (aim.dx / len) * 12, s.z - (aim.dz / len) * 12, { x, z });
    set.kit.push({
      update() {
        if (set.decoy && set.decoy.until > time(set)) return true;
        p.world.work.actor = p;
        p.melee.blast(x, z, job.force, def.burst, 0, '#bfeaff', null, 'stagger', true, 2);
        for (const e of near(set, x, z, def.burst)) freeze(set, job.pid, e, 2, rank);
        set.fx.impact('ice', x, ground(set, x, z), z, def.burst * 0.6);
        glow.o.visible = false;
        set.decoy = null;
        return false;
      },
    });
  },

  decoy(set) {
    return set.decoy && set.decoy.until > time(set) ? set.decoy : null;
  },

  // Frost Armor: a shell of ice that takes the worst of every blow, and freezes whoever lands one.
  armor(set, job) {
    set.buff(job);
    set.armorUntil = time(set) + job.def.secs * (1 + job.rank * 0.1);
  },

  // The ground freezes over the target; foes slide and slow, and Shatter there goes deeper.
  rime(set, job, aim) {
    set.zone(job, aim);
    set.player.world.scars.mark('ice', aim.x, aim.z, job.def.reach, set.player, 2, 0.6);
  },

  // A glacier races out across the land and up its hills, freezing everything it reaches.
  glacier(set, job, aim) {
    const p = set.player, { def, rank, force } = job, s = p.state, n = def.count + rank, hit = new Set();
    for (let i = 1; i <= n; i++) {
      set.fx.after(i * 0.045, () => {
        const x = s.x + aim.dx * i * def.step, z = s.z + aim.dz * i * def.step, g = ground(set, x, z);
        for (let k = -1; k <= 1; k++) set.fx.crystal(x - aim.dz * k * 2.2, g, z + aim.dx * k * 2.2, def.stay, 0.9 + Math.random() * 0.7);
        p.world.scars.mark('ice', x, z, 3.5, p, 1, 0.6);
        for (const e of near(set, x, z, 4)) {
          if (hit.has(e)) continue;
          hit.add(e);
          set.harm(job.pid, e, force);
          freeze(set, job.pid, e, def.chill, rank);
        }
      });
    }
  },

  // Everything for a long way round turns to ice: water you can walk on, and every foe in it frozen.
  sea(set, job) {
    const p = set.player, { def, rank, force } = job, s = p.state, r = def.reach + rank * 3;
    p.world.scars.mark('ice', s.x, s.z, r, p, 3, 0.7);
    for (const e of near(set, s.x, s.z, r)) {
      set.harm(job.pid, e, force);
      freeze(set, job.pid, e, def.chill, rank);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 6.283, d = r * (0.3 + Math.random() * 0.7), x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      set.fx.after(d / 60, () => set.fx.crystal(x, ground(set, x, z), z, 4, 0.6 + Math.random() * 0.8));
    }
    p.world.vfx.shock(s.x, ground(set, s.x, s.z), s.z, r, '#dff4ff', 0.8);
    p.world.vfx.tint('#cfeaff', 0.3, 1.2, 0.3);
  },

  tick(set) {
    const p = set.player, hand = p.hero.bones?.hand0;
    // The ice weapon in the hand follows the current one (and the current hero model).
    const kind = set.weapon ?? 'blade';
    if (hand && (set.weaponHeld !== kind || set.weaponHand !== hand)) {
      if (set.weaponMesh) set.weaponMesh.parent?.remove(set.weaponMesh);
      set.weaponMesh = MESHES[kind] ??= weaponMesh(kind);
      hand.add(set.weaponMesh);
      set.weaponHeld = kind;
      set.weaponHand = hand;
    }
    // Frozen foes glitter.
    if ((set.glint = (set.glint ?? 0) - 1 / 60) <= 0) {
      set.glint = 0.2;
      for (const e of near(set, p.state.x, p.state.z, 60)) if (frozen(set, e) && Math.random() < 0.4) p.world.vfx.burst(e.x, e.group.position.y + 2, e.z, ICE, 1, 3, { fall: 0, life: 0.3 });
    }
  },

  // Shatterpoint: the weapon breaks on the foe and every shard flies out, freezing what it hits.
  finisher(melee, e) {
    const p = melee.player, set = p.powers;
    for (const o of near(set, e.x, e.z, 7)) {
      if (o === e) continue;
      set.harm('shards', o, melee.force * 0.7);
      freeze(set, 'shards', o, 1.2);
    }
    freeze(set, 'shards', e, 1.5);
    set.fx.impact('ice', e.x, ground(set, e.x, e.z), e.z, 6);
    p.world.vfx.burst(e.x, e.group.position.y + 1.5, e.z, ICE, 40, 20);
    p.world.work.impact = 0.05;
    return 'fly';
  },
};
