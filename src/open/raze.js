import * as THREE from 'three';
import { height, SEA } from './terrain.js';
import { toon, paint, ball, limb, spike, block, rock, aimed, skin, shine } from './kit.js';

// Strongholds are taken by tearing them down. Each is a handful of works standing in the world,
// every one doing something for as long as it stands, so what to break first is a real choice.
// Anything that lands a blow near one hurts it: fists, powers, fire on the ground.
//   hits: blows of a hero's might to bring it down.   size: its reach in tiles.
const WOOD = '#7a5230', DARK = '#4e3220', STONE = '#8e8490';
const BLOW = 1.3, GROWTH_KEPT = 0.85;
const FALL_SECS = 1.3;
const GARRISON_EVERY = 16;   // seconds between reinforcements from a barracks
const GARRISON = 2, MOST_DEFENDERS = 8;
const TOWER_EVERY = 3, TOWER_REACH = 46;
const MEND_EVERY = 1, MEND = 0.03;   // of its health a work gets back from an idol, each beat
const BANNER_FURY = 1.25;    // defenders hit this much harder while a War Banner flies
const BLAST_SHARE = 2.6;     // of a blow, powder stores do to all around them
const BLAST_REACH = 14;
const STEEPEST = 3.5;         // how far the ground may fall away under a work

export const WORKS = {
  banner: {
    name: 'War Banner', hits: 6, size: 3,
    draw(parts, lit, color) {
      parts.push(paint(limb(0.22, 0.3, 11).translate(0, 11, 0), DARK), paint(block(0.5, 0.5, 5.4).translate(0, 10.6, 0), DARK), paint(block(0.2, 7, 4.4).translate(0, 7, 0.1), color));
      parts.push(paint(rock(1.1).translate(0, 0.3, 0), STONE), paint(aimed(spike(0.4, 1.4), 0, 11, 0, 0, 1, 0), '#c8ccd4'));
    },
  },
  barracks: {
    name: 'Barracks', hits: 14, size: 6.5,
    draw(parts, lit, color) {
      parts.push(paint(block(12, 4, 7).translate(0, 2, 0), WOOD), paint(block(12.8, 0.5, 7.8).translate(0, 4.2, 0), DARK));
      const roof = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-6.8, 4.4, 4.2, 6.8, 4.4, 4.2, 6.8, 7.6, 0, -6.8, 4.4, 4.2, 6.8, 7.6, 0, -6.8, 7.6, 0, 6.8, 4.4, -4.2, -6.8, 4.4, -4.2, -6.8, 7.6, 0, 6.8, 4.4, -4.2, -6.8, 7.6, 0, 6.8, 7.6, 0, 6.8, 4.4, 4.2, 6.8, 4.4, -4.2, 6.8, 7.6, 0, -6.8, 4.4, -4.2, -6.8, 4.4, 4.2, -6.8, 7.6, 0], 3));
      roof.computeVertexNormals();
      parts.push(paint(roof, color), paint(block(3, 3.2, 0.3).translate(0, 1.6, 3.6), '#1a1412'));
      lit.push(...[-4, 4].map((x) => paint(block(1.2, 1.1, 0.1).translate(x, 2.5, 3.56), '#ffb45a')));
    },
  },
  tower: {
    name: 'Watchtower', hits: 10, size: 4,
    draw(parts) {
      for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) parts.push(paint(aimed(limb(0.26, 0.36, 15), x * 0.7, 15, z * 0.7, -x * 0.04, -1, -z * 0.04), DARK));
      parts.push(paint(block(7, 0.6, 7).translate(0, 15, 0), WOOD), paint(block(7.4, 1.8, 0.4).translate(0, 16.4, 3.4), WOOD), paint(block(7.4, 1.8, 0.4).translate(0, 16.4, -3.4), WOOD), paint(block(0.4, 1.8, 7.4).translate(3.4, 16.4, 0), WOOD), paint(block(0.4, 1.8, 7.4).translate(-3.4, 16.4, 0), WOOD));
      parts.push(paint(new THREE.ConeGeometry(5.4, 3.4, 4).rotateY(Math.PI / 4).translate(0, 20.6, 0), DARK), paint(block(0.3, 7, 0.3).translate(0, 18.6, 0), DARK));
    },
  },
  idol: {
    name: 'Blood Idol', hits: 9, size: 3.2,
    draw(parts, lit, color) {
      parts.push(paint(rock(2.2).scale(1, 0.5, 1).translate(0, 0.6, 0), STONE), paint(limb(1.1, 1.5, 7).translate(0, 7.6, 0), '#6e625a'), paint(ball(1.5, 1, 1.15, 1).translate(0, 8.8, 0), '#7c6e64'));
      for (const s of [-1, 1]) parts.push(paint(aimed(spike(0.42, 2.6), s * 1.1, 9.6, 0, s * 0.7, 1, 0), '#d8ccb0'));
      lit.push(...[-1, 1].map((s) => paint(ball(0.3).translate(s * 0.55, 9, 1.32), color)), paint(block(0.22, 3.4, 0.1).translate(0, 4.6, 1.3), color));
    },
  },
  supply: {
    name: 'Powder Stores', hits: 4, size: 4.6,
    draw(parts, lit) {
      const barrel = (x, z, y = 0) => parts.push(paint(limb(0.92, 0.92, 2).translate(x, y + 2, z), '#5a3a22'), paint(limb(0.96, 0.96, 0.16).translate(x, y + 1.5, z), '#2a2a2e'), paint(limb(0.96, 0.96, 0.16).translate(x, y + 0.9, z), '#2a2a2e'));
      [[-1.5, 0], [0.6, -1.2], [0.8, 1.2], [-1, 1.8], [2.6, 0]].forEach(([x, z]) => barrel(x, z));
      barrel(-0.4, 0, 2);
      parts.push(paint(block(2.2, 2, 2.2).translate(-3, 1, -1.4), WOOD), paint(block(1.6, 1.4, 1.6).translate(-3, 2.7, -1.4), WOOD));
      lit.push(paint(block(0.5, 0.5, 0.1).translate(0.6, 1.4, 0.3), '#ff7a2a'));
    },
  },
};
const LAYOUTS = {
  camp: [['banner', 'barracks', 'supply', 'tower'], 17],
  den: [['idol', 'idol', 'banner', 'supply'], 15],
  bandit: [['banner', 'barracks', 'tower', 'supply', 'supply'], 26],
  keep: [['banner', 'idol', 'barracks', 'tower', 'supply'], 30],
  fort: [['banner', 'barracks', 'tower', 'supply'], 15],
  city: [['banner', 'tower', 'tower', 'barracks', 'supply'], 62],
  lair: [['idol', 'idol', 'banner', 'tower'], 46],
};

export function raises(key) {
  return !!LAYOUTS[key];
}

export function fits(x, z, size, solids) {
  const y = height(x, z);
  if (y < SEA + 1) return false;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (Math.abs(height(x + dx * size, z + dz * size) - y) > STEEPEST) return false;
  return !solids.some((o) => !o.off && (o.r ? Math.hypot(x - o.x, z - o.z) < o.r + size : x > o.x0 - size && x < o.x1 + size && z > o.z0 - size && z < o.z1 + size));
}

// Dry, level ground, clear of what's already built, as near the place it was meant for as there is.
export function ground(a, ring, size, solids, s) {
  for (const far of [1, 1.2, 1.4, 0.8, 1.7]) {
    for (let turn = 0; turn < 16; turn++) {
      const at = a + ((turn % 2 ? 1 : -1) * Math.ceil(turn / 2) * Math.PI) / 16;
      const x = s.x + Math.cos(at) * ring * far, z = s.z + Math.sin(at) * ring * far;
      if (fits(x, z, size, solids)) return [x, z, at];
    }
  }
  return [s.x + Math.cos(a) * ring, s.z + Math.sin(a) * ring, a];
}

// Stands the works up, the first time a hero comes near.
export function raiseWorks(s, scene, solids) {
  const [kinds, ring] = LAYOUTS[s.key], mat = toon();
  s.works = kinds.map((kind, i) => {
    const def = WORKS[kind], [x, z, a] = ground((i / kinds.length) * 6.283 + s.x, ring, def.size, solids, s), y = height(x, z);
    const group = new THREE.Group(), parts = [], lit = [];
    def.draw(parts, lit, s.cat.color);
    skin(group, parts, mat, 0.05);
    shine(group, lit);
    group.position.set(x, y, z);
    group.rotation.y = -a + Math.PI / 2;
    scene.add(group);
    const solid = { x, z, r: def.size * 0.6 };
    solids.push(solid);
    return { kind, def, group, solid, x, y, z, hp: null, age: null };
  });
}

// What a work has left to give, set from the hero first to hit it.
function toughen(w, hero) {
  w.maxHp = w.def.hits * BLOW * hero.body.might ** GROWTH_KEPT;
  w.hp ??= w.maxHp;
}

// One blow on one work. Frozen works shatter more easily. Returns true if it fell.
export function strike(w, force, hero, fx, burst) {
  if (w.age !== null) return false;
  if (w.hp === null) toughen(w, hero);
  w.hp -= force * (w.brittle > 0 ? 1.5 : 1);
  w.group.rotation.z = (1 - Math.max(0, w.hp) / w.maxHp) * 0.05;
  burst(w.x, w.y + 3, w.z, ['#c9bcc4', '#7a5230', '#a89a8c'], 6, 5);
  if (w.hp > 0) return false;
  w.age = 0;
  w.solid.off = true;
  fx.impact('earth', w.x, w.y, w.z, w.def.size);
  return true;
}

// Topple what's fallen, and restore what a nation has rebuilt.
export function settleWorks(s, dt) {
  for (const w of s.works ?? []) {
    w.brittle = Math.max(0, (w.brittle ?? 0) - dt);
    if (w.age === null) continue;
    w.age += dt;
    const k = Math.min(1, w.age / FALL_SECS);
    w.group.rotation.x = k * k * 1.3;
    w.group.position.y = w.y - k * k * 7;
    if (k >= 1) w.group.visible = false;
  }
}

export function restoreWorks(s) {
  for (const w of s.works ?? []) {
    Object.assign(w, { hp: null, age: null, brittle: 0 });
    w.solid.off = false;
    w.group.visible = true;
    w.group.position.y = w.y;
    w.group.rotation.x = w.group.rotation.z = 0;
  }
}

// For good: a place the world has already lost.
export function razeWorks(s) {
  for (const w of s.works ?? []) {
    w.age ??= FALL_SECS;
    w.solid.off = true;
    w.group.visible = false;
  }
}

export const standing = (s) => (s.works ?? []).filter((w) => w.age === null);

// Defenders fight harder under a banner, and lose heart when it falls.
export const fury = (s) => (standing(s).some((w) => w.kind === 'banner') ? BANNER_FURY : 1);
export function dishearten(s) {
  if (fury(s) === 1) for (const e of s.mobs ?? []) e.def.damage /= BANNER_FURY;
}

// What the works do while they stand.
export function workDuties(s, dt, sites, hero) {
  const up = standing(s), { monsters, work } = sites;
  if ((s.beat = (s.beat ?? 0) - dt) > 0) return;
  s.beat = MEND_EVERY;
  s.clock = (s.clock ?? 0) + MEND_EVERY;
  if (up.some((w) => w.kind === 'idol')) {
    for (const w of up) {
      if (w.kind !== 'idol' && w.hp !== null && w.hp < w.maxHp) {
        w.hp = Math.min(w.maxHp, w.hp + w.maxHp * MEND);
        work.burst(w.x, w.y + 3, w.z, [s.cat.color], 2, 2);
      }
    }
  }
  const barracks = up.find((w) => w.kind === 'barracks');
  if (barracks && s.clock % GARRISON_EVERY === 0 && (s.mobs?.filter((e) => monsters.list.includes(e) && !e.dying).length ?? 0) < MOST_DEFENDERS) {
    for (let i = 0; i < GARRISON; i++) {
      const e = monsters.add(s.cat.mobs[(i + 1) % s.cat.mobs.length], barracks.x + i * 3, barracks.z + 6, monsters.danger(s.x, s.z), false);
      e.def.damage *= fury(s);
      s.mobs?.push(e);
    }
  }
  for (const w of up) {
    if (w.kind !== 'tower' || s.clock % TOWER_EVERY !== 0) continue;
    const d = Math.hypot(hero.state.x - w.x, hero.state.z - w.z) || 1;
    if (d < TOWER_REACH && !hero.rooms.house) monsters.fireOrbFrom(w.x, w.y + 17, w.z, (hero.state.x - w.x) / d, (hero.state.z - w.z) / d, { def: { damage: hero.body.maxHealth * 0.07 * Math.sqrt(hero.body.massScale) } });
  }
}

// Powder goes up, hurting everything around it and setting the ground alight.
export function explode(w, sites, hero, world) {
  const force = hero.body.might * BLAST_SHARE;
  for (const e of sites.monsters.within(w.x, w.z, BLAST_REACH)) sites.monsters.hit(e, force, w.x, w.z);
  world.fx.impact('fire', w.x, w.y, w.z, BLAST_REACH * 0.7);
  world.scars.mark('fire', w.x, w.z, 8, hero, 2);
  for (const o of sites.nearby(w, BLAST_REACH)) strike(o, force, hero, world.fx, sites.work.burst.bind(sites.work));
  sites.work.shake = 0.5;
  sites.work.shakeAt = hero.state;
}
