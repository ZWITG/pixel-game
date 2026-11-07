import * as THREE from 'three';
import { VoxelBuilder, vmat } from '../render/voxel.js';

// Monsters grow with the heroes. Each form is reached at a hero level, adds visible parts to
// whatever monster wears it, and scales stats from the nearest hero, so a fight stays a fight.
export const TIERS = [
  { name: '', level: 1, hp: 1, damage: 1, size: 1, pace: 1, tint: '#ffffff', accent: '#f3ead8' },
  { name: 'Thorned', level: 6, hp: 1.15, damage: 1.06, size: 1.15, pace: 1.05, tint: '#e6dcc8', accent: '#e8dcc0' },
  { name: 'Ironhide', level: 14, hp: 1.35, damage: 1.12, size: 1.3, pace: 1.1, tint: '#bdb6cc', accent: '#c9d4e2' },
  { name: 'Dread', level: 26, hp: 1.6, damage: 1.2, size: 1.5, pace: 1.15, tint: '#9484b4', accent: '#ff8a4c' },
  { name: 'Ancient', level: 42, hp: 1.9, damage: 1.28, size: 1.75, pace: 1.2, tint: '#745c94', accent: '#ff5a5a' },
  { name: 'Cataclysm', level: 64, hp: 2.3, damage: 1.36, size: 2, pace: 1.25, tint: '#4e3468', accent: '#9fe8ff' },
];
// What each kind of enemy is meant to be in a fight against a hero of its own level: `hits` of
// that hero's blows to bring it down, and `bite`, the share of the hero's health a plain strike
// takes. These two numbers are the whole of the balance; tune here first.
export const ROLES = {
  fodder: { hits: 4, bite: 0.06 },
  fighter: { hits: 7, bite: 0.09 },
  brute: { hits: 12, bite: 0.13 },
  machine: { hits: 10, bite: 0.09 },
  ruler: { hits: 90, bite: 0.13 },
  watcher: { hits: 45, bite: 0.11 },
};
const ROLE_OF = { slime: 'fodder', sporeling: 'fodder', bat: 'fodder', puffcap: 'fodder', wisp: 'fodder', fireSlime: 'fodder', bomber: 'fodder', drowned: 'fodder', assassin: 'fodder', golem: 'brute', iceGuard: 'brute', chief: 'brute' };
const GROWTH_KEPT = 0.85;     // monsters keep up with a hero's might, but only this far: strength is felt
const BLOW = 1.3;             // an average blow in a chain, of a hero's might
const ELDER_HITS = 2.4, ELDER_BITE = 1.3;
export const roleName = (e) => (e.def.boss ? 'ruler' : e.def.watcher ? 'watcher' : e.def.machine ? 'machine' : ROLE_OF[e.kind] ?? 'fighter');
export const roleOf = (e) => ROLES[roleName(e)];
const EVOLVE_TIME = 2.4; // seconds of shaking and glowing before the new form breaks out
const box3 = new THREE.Box3(), up = new THREE.Vector3(0, 1, 0);

export const tierFor = (level) => TIERS.reduce((best, t, i) => (level >= t.level ? i : best), 0);

// How tough a monster should be against this hero: its role, then how far it's out of the
// hero's league. `e.tough` comes from whose land this is (see Monsters.add).
function scales(e, hero) {
  const role = roleOf(e), { might, maxHealth, massScale } = hero.body, tough = e.tough ?? 1;
  return {
    hp: role.hits * BLOW * might ** GROWTH_KEPT * tough * (e.elder ? ELDER_HITS : 1),
    damage: role.bite * maxHealth * Math.sqrt(massScale) * tough * (e.elder ? ELDER_BITE : 1),
  };
}

// The monster's size, measured with nothing else moving it.
function measure(e) {
  const g = e.group, pos = g.position.clone(), rot = g.rotation.y, sc = g.scale.x;
  g.position.set(0, 0, 0);
  g.rotation.y = 0;
  g.scale.setScalar(1);
  g.updateMatrixWorld(true);
  box3.setFromObject(e.model.root);
  g.position.copy(pos);
  g.rotation.y = rot;
  g.scale.setScalar(sc);
  return box3.clone();
}

// Each form keeps the parts of the one before and adds its own.
function buildParts(box, tier, accent) {
  const b = new VoxelBuilder(), glow = new VoxelBuilder();
  const w = box.max.x - box.min.x, h = box.max.y - box.min.y, d = box.max.z - box.min.z, top = box.max.y, u = Math.max(w, d);
  const cy = (box.max.y + box.min.y) / 2;
  if (tier >= 1) {
    // A ridge of spikes down the back.
    for (let i = -3; i <= 3; i++) {
      const z = (i / 3) * d * 0.42, x = (i % 2 ? 1 : -1) * 0.1 * w, tall = (0.17 - Math.abs(i) * 0.02) * u * (1 + tier * 0.12);
      // Three shrinking steps make a thorn rather than a post.
      b.box(x, top + tall * 0.2, z, 0.1 * u, tall * 0.5, 0.1 * u, '#3a2c30', 0.05);
      b.box(x, top + tall * 0.6, z, 0.065 * u, tall * 0.5, 0.065 * u, accent, 0.05);
      b.box(x, top + tall, z, 0.03 * u, tall * 0.5, 0.03 * u, '#ffffff', 0);
    }
  }
  if (tier >= 2) {
    // Plates of armor on the flanks, and eyes that burn.
    for (const side of [-1, 1]) {
      b.box(side * (w / 2 + 0.03 * u), cy + h * 0.08, 0, 0.09 * u, h * 0.5, d * 0.62, '#7c8494', 0.06);
      b.box(side * (w / 2 + 0.06 * u), cy + h * 0.08, 0, 0.05 * u, h * 0.2, d * 0.2, accent, 0);
      glow.box(side * 0.14 * w, cy + h * 0.15, box.max.z + 0.01, 0.13 * u, 0.09 * u, 0.04, '#ffffff', 0);
    }
  }
  if (tier >= 3) {
    // Horns, two segments each, sweeping up from the front.
    for (const side of [-1, 1]) {
      b.box(side * w * 0.3, top + 0.04 * u, box.max.z - d * 0.15, 0.1 * u, 0.14 * u, 0.1 * u, '#2a2030', 0.05);
      b.box(side * w * 0.37, top + 0.16 * u, box.max.z - d * 0.1, 0.07 * u, 0.14 * u, 0.07 * u, '#2a2030', 0.05);
      b.box(side * w * 0.44, top + 0.28 * u, box.max.z - d * 0.06, 0.04 * u, 0.14 * u, 0.04 * u, accent, 0);
    }
  }
  if (tier >= 4) {
    // A crown of points.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box(Math.cos(a) * 0.3 * u, top + 0.3 * u, Math.sin(a) * 0.3 * u, 0.06 * u, (i % 2 ? 0.1 : 0.2) * u, 0.06 * u, accent, 0);
    }
  }
  if (tier >= 5) {
    // Molten seams along the body.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      glow.box(Math.cos(a) * (w / 2 + 0.02), box.min.y + (i % 3 + 1) * h * 0.24, Math.sin(a) * (d / 2 + 0.02), 0.08 * u, h * 0.3, 0.08 * u, '#ffffff', 0);
    }
  }
  return { body: b, glow };
}

// Swaps the worn parts for those of a form.
function dress(e, tier) {
  if (e.parts) {
    e.model.root.remove(e.parts);
    e.parts.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  if (e.aura) {
    e.group.remove(e.aura);
    e.aura.geometry.dispose();
    e.aura.material.dispose();
    e.aura = null;
  }
  e.parts = new THREE.Group();
  e.shards = null;
  const { accent, tint } = TIERS[tier];
  e.model.mat.color.set(tint);
  const { body, glow } = buildParts(e.box, tier, accent);
  if (tier >= 1 && !e.def.plain) {
    const mesh = new THREE.Mesh(body.build(), vmat());
    mesh.castShadow = true;
    e.parts.add(mesh);
  }
  if (tier >= 2 && !e.def.plain) e.parts.add(new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ color: accent, vertexColors: true })));
  if (tier >= 3) {
    e.aura = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    e.aura.position.y = 0.05;
    e.group.add(e.aura);
  }
  if (tier >= 4 && !e.def.plain) {
    // Stones that circle it.
    const b = new VoxelBuilder(), u = e.box.max.x - e.box.min.x;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.box(Math.cos(a) * u, (e.box.max.y + e.box.min.y) / 2, Math.sin(a) * u, 0.16 * u, 0.2 * u, 0.16 * u, accent, 0.1);
    }
    e.shards = new THREE.Mesh(b.build(), vmat());
    e.parts.add(e.shards);
  }
  e.model.root.add(e.parts);
  // Beasts carry a little light of their own, so dark hides still read against the grass.
  e.baseGlow.set(tier >= 3 ? accent : '#ffffff').multiplyScalar(tier >= 3 ? 0.18 : e.def.model === 'beast' ? 0.14 : 0);
}

// Sets a monster's form and stats from a hero. Called on spawning and on evolving.
export function setTier(e, tier, hero) {
  e.base ??= { hp: e.def.hp, damage: e.def.damage, radius: e.radius, speed: e.def.speed, chaseSpeed: e.def.chaseSpeed, scale: e.group.scale.x, name: e.def.name };
  e.box ??= measure(e);
  const t = TIERS[tier], s = scales(e, hero), base = e.base;
  e.tier = tier;
  e.def.name = t.name ? `${t.name} ${base.name}` : base.name;
  e.def.damage = s.damage * t.damage;
  e.def.speed = base.speed * t.pace;
  e.def.chaseSpeed = base.chaseSpeed * t.pace;
  e.radius = base.radius * t.size;
  e.hp = e.maxHp = s.hp * t.hp;
  e.group.scale.setScalar(base.scale * t.size);
  dress(e, tier);
}

export function startEvolving(e) {
  e.evolving = 0;
}

// The change itself: it stops dead, shudders, swells and pulses, then bursts into the new form.
// `blast(e, tier)` runs at the moment it finishes.
export function updateEvolving(e, dt, time, blast) {
  e.evolving += dt;
  const k = e.evolving / EVOLVE_TIME, next = TIERS[Math.min(TIERS.length - 1, e.tier + 1)];
  e.vel.set(0, 0);
  e.knockUntil = time + 0.1;
  const size = e.base.scale * TIERS[e.tier].size;
  e.group.scale.setScalar(size * (1 + k * 0.3 + Math.sin(e.evolving * (12 + k * 30)) * 0.05 * (0.3 + k)));
  e.model.root.position.x = Math.sin(e.evolving * 50) * 0.04 * k;
  e.baseGlow.set(next.accent).multiplyScalar((0.35 + 0.65 * Math.abs(Math.sin(e.evolving * (5 + k * 14)))) * k);
  if (k >= 1) {
    e.evolving = undefined;
    e.model.root.position.x = 0;
    blast(e, e.tier + 1);
  }
}

// Things that keep moving on a finished form.
export function animateParts(e, dt, time) {
  if (e.shards) e.shards.rotateOnAxis(up, dt * 2);
  if (e.aura) e.aura.scale.setScalar(1.5 + Math.sin(time * 4) * 0.12);
}
