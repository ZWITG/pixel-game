// Helpers the second five Conquerors' kits share (v0.56.0): kits/gravity.js, blade.js, blood.js, blast.js, dragon.js.
// Same shape as the first five: each power `kind` is called as kit[kind](set, job, aim); lasting effects
// go on set.kit as { update(dt) → false when done, busy }.
export const near = (set, x, z, r) => set.player.melee.monsters.within(x, z, r);
export const ground = (set, x, z) => set.player.melee.height(x, z);
export const time = (set) => set.player.melee.monsters.time;
export const world = (set) => set.player.world;

// A blow from a power at (x, z): everything in `reach` (foes, trees, houses, works), thrown as `react`.
export function blow(set, job, x, z, force, reach, react = null, crater = 0, target = null) {
  const p = set.player;
  p.world.work.actor = p;
  return p.melee.blast(x, z, force, reach, crater, job.color, target, react, true, 2);
}

// One foe, through the shared path (so practice, kit hooks and Watcher wards all apply).
export function hit(set, pid, e, force, react = null) {
  if (!e || e.dying) return;
  const p = set.player;
  p.world.work.actor = p;
  p.melee.monsters.hit(e, force, p.state.x, p.state.z, react);
  if (set.def?.powers[pid]) p.skills.add(set.skillOf(pid), 0.4);
  set.kitDef?.afflicted?.(set, e);
}

// Only what's built and grown, not foes: houses, trees, works, caravans, estates, voxel walls.
export function raze(set, x, z, reach, force) {
  const p = set.player, w = p.world, m = p.melee;
  if (p.rooms.house) return;
  w.work.actor = p;
  const queue = [];
  for (const o of w.work.chunks.near(x, z, reach)) queue.push({ o, at: Math.hypot(o.x - x, o.z - z) / 40, force });
  for (const h of w.work.housesAt(x, z, reach)) queue.push({ h, at: Math.hypot(h.x - x, h.z - z) / 40, force });
  m.waves.push({ queue, x, z, reach, t: 0, drops: {}, broke: false });
  w.sites.struck(x, z, reach, 0, p, force);
  w.caravans?.struck(x, z, reach, force, p);
  w.estates?.struck(x, z, reach, force, p);
  w.roadside?.struck(x, z, reach, force, p);
  w.armies?.struck(x, z, reach, force);
  w.voxels?.blast(x, ground(set, x, z) + 0.8, z, w.work.cut(force, p, reach), p);
}

// Slows a foe's steps (monsters.update reads e.slow); the strongest slow wins.
export function slow(e, k, secs, t) {
  if (!e.slow || e.slow.until < t || e.slow.k > k) e.slow = { k, until: t + secs };
  else e.slow.until = Math.max(e.slow.until, t + secs);
}

// Stretches whatever a foe is in the middle of (a tell, a strike, a rest): its own time runs slow.
export function dilate(e, dt, k) {
  if (e.mode === 'tell' || e.mode === 'strike' || e.mode === 'recover' || e.mode === 'rest' || e.mode === 'cast' || e.mode === 'reeling') e.until += dt * k;
}

// Folk near here run (omega.scary reads world.terror).
export function terror(set, x, z, r, secs) {
  const w = world(set), t = time(set);
  w.terror = (w.terror ?? []).filter((k) => k.until > t);
  w.terror.push({ x, z, r, until: t + secs });
}

// The nearest settlement of the realm within `reach` of (x, z).
export function nearestPlace(set, x, z, reach = Infinity) {
  let best = null, d = reach;
  for (const s of world(set).realm?.settlements ?? []) {
    const k = Math.hypot(s.x - x, s.z - z);
    if (k < d) { d = k; best = s; }
  }
  return best;
}

// Foes inside a cone ahead of (x, z) along (dx, dz).
export function cone(set, x, z, dx, dz, reach, dot) {
  return near(set, x, z, reach).filter((e) => {
    const ex = e.x - x, ez = e.z - z, d = Math.hypot(ex, ez) || 1;
    return (ex * dx + ez * dz) / d > dot;
  });
}

// Foes within `half` of the line from (x, z) along (dx, dz) for `len`.
export function line(set, x, z, dx, dz, len, half) {
  return near(set, x + dx * len * 0.5, z + dz * len * 0.5, len * 0.5 + half).filter((e) => {
    const ex = e.x - x, ez = e.z - z, along = ex * dx + ez * dz, off = Math.abs(ex * dz - ez * dx);
    return along > -1 && along < len && off < half + e.radius;
  });
}

export function shake(set, amount) {
  const w = world(set);
  w.work.shake = Math.max(w.work.shake ?? 0, amount);
  w.work.shakeAt = set.player.state;
}

export function burst(set, x, z, colors, n = 14, speed = 8, up = 1) {
  world(set).vfx.burst(x, ground(set, x, z) + up, z, colors, n, speed);
}

// Is it dark where the hero stands: night, an Eclipse, or a power's darkness.
export function isNight(set) {
  const w = world(set), c = w.clock ?? 0.3;
  return c > 0.82 || c < 0.24 || (w.darkUntil ?? 0) > time(set);
}
