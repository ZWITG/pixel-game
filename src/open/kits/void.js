import * as THREE from 'three';
import { stagger } from '../foes.js';
import { height } from '../terrain.js';
import { animateParts } from '../evolve.js';

// The Gravecaller's kit (v0.37.0): the fallen rise and fight for you. Same shape as kits/titan.js.
//   Husks: a foe the Gravecaller kills leaves a Husk for a few seconds (`world.husks`).
//   Rise turns Husks near you into Thralls: void-black copies with the foe's body and moves.
//   Thralls live outside `monsters.list`, so nothing that hunts enemies ever hits or targets them.
//   They follow a Command (Attack your target, Guard you, Hold, Swarm), and take blows meant for you
//   when they stand in the way; one that falls goes back into the Hollow to rest.
//   The Hollow (`set.hollow`, saved): every Thrall you own. Raising a ruler, a captain or an elder
//   makes a Marshal, twice as strong.
//   How many can walk beside you grows with Mastery (FIELD); their total harm is capped by a Command
//   budget, so a crowd never deletes a ruler (BUDGET).
// Hooks: killed (Husks, Reaping Marks), afflicted (Soul Lance marks), struckNear (foes' blows land on
// Thralls), tick (Thralls, Husks), finisher (Hollow Grasp), openHollow (the ultimate).
const HUSK_SECS = 8, RISE_REACH = 18, FOLLOW = 5, LEASH = 60;
const FIELD = [[0, 3], [5, 6], [10, 12], [16, 24], [22, 40]];   // [Mastery, Thralls in the field]
const BUDGET = (mastery) => 3 + mastery * 0.4;                   // full-strength Thralls' worth of harm
const SHARE = 0.4;                                               // one Thrall's blow, of the hero's might
const FRAGILE = 0.5;                                             // a foe's blow takes this of a Thrall's health per share of the hero's
const BLOW_EVERY = 1.1, REST_SECS = 60;
const COMMANDS = ['attack', 'guard', 'hold', 'swarm'];
const COMMAND_NAMES = { attack: 'Attack my target', guard: 'Guard me', hold: 'Hold here', swarm: 'Swarm everything' };
const DARK = '#1a1026', VIOLET = '#b06aff';
const HOLLOW = ['#b06aff', '#3a1a5a', '#ffffff'];

const time = (set) => set.player.melee.monsters.time;
const monsters = (set) => set.player.melee.monsters;
const ground = (set, x, z) => set.player.melee.height(x, z);

export const fieldCap = (mastery) => FIELD.reduce((n, [at, cap]) => (mastery >= at ? cap : n), 3);

function legion(set) {
  if (!set.hollow) {
    let roster = [];
    try {
      roster = JSON.parse(localStorage.getItem(set.saveKey.replace('conqueror', 'hollow'))) ?? [];
    } catch { /* an empty Hollow */ }
    // Nothing is out in the field after a reload, nothing is resting, and the ultimate's guests are gone.
    roster = roster.filter((r) => !r.tempOnly).map((r) => ({ ...r, out: false, temp: false, restUntil: 0 }));
    set.hollow = { roster, field: [], husks: [] };
    set.command = 'attack';
  }
  return set.hollow;
}

function save(set) {
  try {
    localStorage.setItem(set.saveKey.replace('conqueror', 'hollow'), JSON.stringify(set.hollow.roster));
  } catch { /* it lasts for this visit */ }
}

// A Thrall's body: the foe's own model, darkened, with violet eyes; outside the monsters' list.
function raise(set, kind, x, z, entry) {
  const m = monsters(set), e = m.add(kind, x, z, m.danger(x, z), false);
  m.list.splice(m.list.indexOf(e), 1);
  e.thrall = entry;
  e.think = () => {};
  e.model.mat.color.set(entry.marshal ? '#3a2050' : '#2a1838');
  e.baseGlow.set(VIOLET).multiplyScalar(entry.marshal ? 0.45 : 0.25);
  if (entry.marshal) e.group.scale.multiplyScalar(1.15);
  e.hp = e.maxHp;
  e.nextBlow = 0;
  set.fx.hole(x, ground(set, x, z) + 1, z, 1.2, 0.5);
  set.player.world.vfx.burst(x, ground(set, x, z) + 1, z, HOLLOW, 14, 6, { up: 1.5, fall: -0.2 });
  legion(set).field.push(e);
  entry.out = true;
  return e;
}

function lay(set, e, resting) {
  const h = legion(set);
  h.field.splice(h.field.indexOf(e), 1);
  if (e.thrall.temp) {
    const i = h.roster.indexOf(e.thrall);
    if (i >= 0 && e.thrall.tempOnly) h.roster.splice(i, 1);
  }
  e.thrall.out = false;
  e.thrall.temp = false;
  if (resting) e.thrall.restUntil = time(set) + REST_SECS;
  set.fx.flame(e.x, ground(set, e.x, e.z), e.z, 3, 0.6, 1);
  e.remove();
  save(set);
}

// One Thrall's blow: a share of the hero's might, thinned out when the crowd outgrows the budget.
function blowOf(set, e) {
  const h = legion(set), n = Math.max(1, h.field.length);
  return set.player.body.might * SHARE * Math.min(1, BUDGET(set.mastery) / n) * (e.thrall.marshal ? 2 : 1) * (1 + (e.tier ?? 0) * 0.1);
}

function nearestFoe(set, x, z, r) {
  let best = null, d = r;
  for (const f of monsters(set).within(x, z, r)) {
    const k = Math.hypot(f.x - x, f.z - z);
    if (k < d) { d = k; best = f; }
  }
  return best;
}

// What one Thrall does this frame, by the Command it follows.
function think(set, e, i, dt) {
  const p = set.player, s = p.state, t = time(set), mode = e.tide ? 'tide' : set.command;
  // Too far behind: it steps out of the dark beside you.
  if (Math.hypot(e.x - s.x, e.z - s.z) > LEASH) {
    e.group.position.set(s.x + (Math.random() - 0.5) * 6, ground(set, s.x, s.z), s.z + (Math.random() - 0.5) * 6);
    set.fx.flame(e.x, ground(set, e.x, e.z), e.z, 3, 0.5, 1);
  }
  if (e.tide) {
    // Grave Tide: a rush along the line, trampling all it passes.
    e.vel.set(e.tide.dx, e.tide.dz).multiplyScalar(26);
    for (const f of monsters(set).within(e.x, e.z, 3)) {
      if (e.tide.hit.has(f)) continue;
      e.tide.hit.add(f);
      p.world.work.actor = p;
      monsters(set).hit(f, blowOf(set, e) * 1.5, e.x, e.z, 'knockdown', 1);
    }
    if (t > e.tide.until) e.tide = null;
    return;
  }
  if (!e.target || e.target.dying || !monsters(set).list.includes(e.target) || t > (e.retarget ?? 0)) {
    e.retarget = t + 0.5;
    const lock = p.melee.lock && !p.melee.lock.dying ? p.melee.lock : null;
    e.target = mode === 'attack' ? lock ?? nearestFoe(set, s.x, s.z, 30)
      : mode === 'swarm' ? nearestFoe(set, e.x, e.z, 40)
        : mode === 'guard' ? nearestFoe(set, s.x, s.z, 10)
          : nearestFoe(set, e.x, e.z, 6);
  }
  const f = e.target;
  if (!f) {
    // Nothing to fight: keep a place in the ring around you (or stand where told).
    if (mode === 'hold') return e.vel.set(0, 0);
    const a = (i / Math.max(1, legion(set).field.length)) * 6.283 + t * 0.2, gx = s.x + Math.cos(a) * FOLLOW, gz = s.z + Math.sin(a) * FOLLOW;
    const d = Math.hypot(gx - e.x, gz - e.z);
    return d < 1 ? e.vel.set(0, 0) : e.vel.set((gx - e.x) / d, (gz - e.z) / d).multiplyScalar(Math.min(d * 3, (e.def.chaseSpeed || 8) * 1.3));
  }
  const d = Math.hypot(f.x - e.x, f.z - e.z), reach = f.radius + e.radius + 1;
  if (d > reach) return e.vel.set((f.x - e.x) / d, (f.z - e.z) / d).multiplyScalar((e.def.chaseSpeed || 8) * 1.2);
  e.vel.set(0, 0);
  e.group.rotation.y = Math.atan2(f.x - e.x, f.z - e.z);
  if (t < e.nextBlow) return;
  e.nextBlow = t + BLOW_EVERY * (0.85 + Math.random() * 0.3);
  e.recoil = 1;
  p.world.work.actor = p;
  monsters(set).hit(f, blowOf(set, e), e.x, e.z, 'flinch', 0.6);
  p.world.vfx.burst(f.x, f.group.position.y + 1.5, f.z, [VIOLET, '#ffffff'], 4, 5);
}

export const VOID = {
  // A foe the Gravecaller kills leaves a Husk; one under a Reaping Mark (or killed while the Hollow is
  // open) rises at once.
  killed(set, e) {
    const h = legion(set), t = time(set), entry = { kind: e.kind, tier: e.tier ?? 0, marshal: !!(e.boss || e.elder || e.captain) };
    if (e.def.machine) return;
    if ((e.reapUntil > t || set.openUntil > t) && h.field.length < fieldCap(set.mastery) + (set.openUntil > t ? 30 : 0)) {
      const kept = { ...entry, temp: set.openUntil > t, tempOnly: set.openUntil > t };
      if (!kept.temp) h.roster.push(kept);
      raise(set, e.kind, e.x, e.z, kept);
      if (!kept.temp) save(set);
      return;
    }
    h.husks.push({ ...entry, x: e.x, z: e.z, until: t + HUSK_SECS });
  },

  // Soul Lance marks what it pierces: if it dies, it rises at once.
  afflicted(set, e, def) {
    if (def?.status === 'reap') e.reapUntil = time(set) + 10;
  },

  // A foe's blow that lands where Thralls stand hurts them too.
  struckNear(set, e, move) {
    const h = set.hollow;
    if (!h?.field.length) return;
    const r = (move.area ?? move.reach) + e.radius;
    for (const th of [...h.field]) {
      if (Math.hypot(th.x - e.x, th.z - e.z) > r + th.radius) continue;
      th.hp -= th.maxHp * (e.def.damage * move.power / set.player.body.maxHealth) * FRAGILE / (th.thrall.marshal ? 2 : 1);
      th.flashUntil = time(set) + 0.08;
      if (th.hp <= 0) lay(set, th, true);
    }
  },

  // Raise every Husk near you, as many as your Mastery lets walk beside you.
  rise(set) {
    const h = legion(set), s = set.player.state, t = time(set), cap = fieldCap(set.mastery);
    const near = h.husks.filter((k) => k.until > t && Math.hypot(k.x - s.x, k.z - s.z) < RISE_REACH);
    if (!near.length) return set.player.hud.message('No fallen near enough to raise.');
    let raised = 0;
    for (const k of near) {
      if (h.field.length >= cap) {
        set.player.hud.message(`Your Command holds ${cap}. More will come with Mastery.`);
        break;
      }
      h.husks.splice(h.husks.indexOf(k), 1);
      const entry = { kind: k.kind, tier: k.tier, marshal: k.marshal };
      h.roster.push(entry);
      raise(set, k.kind, k.x, k.z, entry);
      raised++;
    }
    if (raised) set.player.hud.message(`${raised} rise${raised > 1 ? '' : 's'} from the Hollow. ${h.field.length} of ${cap} beside you; ${h.roster.length} in the Hollow.`);
    save(set);
  },

  // Change what the Thralls do.
  command(set, job) {
    legion(set);
    set.command = COMMANDS[(COMMANDS.indexOf(set.command) + 1) % COMMANDS.length];
    set.player.hud.message(`Command: ${COMMAND_NAMES[set.command]}`);
    set.keepReady = job.pid;
  },

  // Swap places with the Thrall nearest where you aim.
  swap(set, job, aim) {
    const h = legion(set), p = set.player, s = p.state;
    const th = h.field.slice().sort((a, b) => Math.hypot(a.x - aim.x, a.z - aim.z) - Math.hypot(b.x - aim.x, b.z - aim.z))[0];
    if (!th) {
      set.keepReady = job.pid;
      return p.hud.message('No Thrall to swap with.');
    }
    const x = s.x, z = s.z;
    p.melee.blink(s, th.x, th.z, aim);
    th.group.position.set(x, ground(set, x, z), z);
    set.fx.hole(x, ground(set, x, z) + 1, z, 1, 0.4);
  },

  // A spear of nothing through every foe in line; what it pierces is marked to rise.
  lance(set, job, aim) {
    set.bolt({ ...job, def: { ...job.def, status: 'reap' } }, aim);
  },

  // Every Thrall rushes forward along your aim as one wave of shadow.
  tide(set, job, aim) {
    const h = legion(set), t = time(set);
    if (!h.field.length) return set.player.hud.message('No Thralls to send.');
    for (const e of h.field) e.tide = { dx: aim.dx, dz: aim.dz, until: t + job.def.secs, hit: new Set() };
    set.player.world.vfx.shock(set.player.state.x, ground(set, set.player.state.x, set.player.state.z), set.player.state.z, 10, VIOLET, 0.4);
  },

  // The Thralls nearest your aim burst into void, and go back into the Hollow to rest.
  burst(set, job, aim) {
    const h = legion(set), p = set.player, { def, rank } = job;
    const chosen = h.field.slice().sort((a, b) => Math.hypot(a.x - aim.x, a.z - aim.z) - Math.hypot(b.x - aim.x, b.z - aim.z)).slice(0, def.count + Math.floor(rank / 2));
    if (!chosen.length) return p.hud.message('No Thralls to burst.');
    for (const e of chosen) {
      const x = e.x, z = e.z;
      p.world.work.actor = p;
      p.melee.blast(x, z, job.force, def.blast, 0, VIOLET, null, 'knockdown', true, 2);
      set.fx.impact('void', x, ground(set, x, z), z, def.blast * 0.6);
      lay(set, e, true);
    }
  },

  // Call Thralls straight out of the Hollow, as many as can walk beside you.
  gate(set, job, aim) {
    const h = legion(set), p = set.player, s = p.state, t = time(set), cap = fieldCap(set.mastery);
    const ready = h.roster.filter((r) => !r.out && !(r.restUntil > t));
    if (!ready.length) return p.hud.message(h.roster.length ? 'Everyone in the Hollow is resting or already out.' : 'The Hollow is empty. Raise the fallen first.');
    const gx = s.x - aim.dx * 4, gz = s.z - aim.dz * 4;
    set.fx.hole(gx, ground(set, gx, gz) + 3, gz, 3, 2);
    let n = 0;
    for (const r of ready) {
      if (h.field.length >= cap) break;
      set.fx.after(n * 0.12, () => raise(set, r.kind, gx + (Math.random() - 0.5) * 4, gz + (Math.random() - 0.5) * 4, r));
      n++;
    }
    p.hud.message(`${n} step out of the Hollow.`);
  },

  // Fuse five or more Thralls into one great beast for a while; then they part again.
  amalgam(set, job) {
    const h = legion(set), p = set.player, { def, rank } = job;
    if (h.field.length < def.least) return p.hud.message(`Amalgam needs ${def.least} Thralls beside you.`);
    const parts = h.field.slice(0, def.least + rank);
    const lead = parts.slice().sort((a, b) => (b.maxHp ?? 0) - (a.maxHp ?? 0))[0];
    const x = lead.x, z = lead.z, kinds = parts.map((e) => e.thrall);
    for (const e of parts) {
      set.fx.flame(e.x, ground(set, e.x, e.z), e.z, 3, 0.6, 1);
      h.field.splice(h.field.indexOf(e), 1);
      e.remove();
    }
    const giant = raise(set, lead.kind, x, z, { kind: lead.kind, tier: lead.tier, marshal: true, giant: kinds });
    giant.group.scale.multiplyScalar(1.6 + parts.length * 0.08);
    giant.maxHp = giant.hp = giant.maxHp * parts.length;
    giant.amalgamUntil = time(set) + def.secs;
    p.world.vfx.shock(x, ground(set, x, z), z, 10, VIOLET, 0.5);
    p.hud.message(`${parts.length} Thralls become one.`);
  },

  // Every foe in sight is marked; whatever dies under the mark rises at once.
  reap(set, job) {
    const p = set.player, s = p.state, t = time(set);
    for (const e of monsters(set).within(s.x, s.z, job.def.reach)) {
      e.reapUntil = t + job.def.secs;
      set.fx.lightning({ x: s.x, y: s.y + 2, z: s.z }, { x: e.x, y: e.group.position.y + 1.5, z: e.z }, VIOLET, 0.1, 0.3);
      set.harm(job.pid, e, job.force);
    }
  },

  // The ultimate: everyone in the Hollow pours out for a while, and everything killed then rises too.
  openHollow(set, x, z, secs) {
    const h = legion(set), t = time(set);
    set.openUntil = t + secs;
    let n = 0;
    for (const r of h.roster) {
      if (r.out || n >= 30) continue;
      set.fx.after(n * 0.06, () => raise(set, r.kind, x + (Math.random() - 0.5) * 8, z + (Math.random() - 0.5) * 8, Object.assign(r, { temp: true })));
      n++;
    }
    set.openRaised = t;
    return n;
  },

  tick(set, dt) {
    const h = set.hollow;
    if (!h) return legion(set);
    const t = time(set);
    h.husks = h.husks.filter((k) => k.until > t);
    // The fallen lie dark on the ground until they're raised or fade.
    if ((set.huskBeat = (set.huskBeat ?? 0) - dt) <= 0) {
      set.huskBeat = 0.3;
      for (const k of h.husks) set.fx.flame(k.x, height(k.x, k.z), k.z, 1.6 + (k.marshal ? 1 : 0), 0.5, 1);
    }
    h.field.forEach((e, i) => {
      if (e.dying) return;
      // Temporary ones go back when the Hollow closes; an Amalgam parts.
      if (e.thrall.temp && !(set.openUntil > t)) return lay(set, e, false);
      if (e.amalgamUntil && t > e.amalgamUntil) {
        const x = e.x, z = e.z, parts = e.thrall.giant ?? [];
        lay(set, e, false);
        for (const r of parts) raise(set, r.kind, x + (Math.random() - 0.5) * 6, z + (Math.random() - 0.5) * 6, r);
        return;
      }
      think(set, e, i, dt);
      e.update(dt);
      animateParts(e, dt, t);
      e.group.position.y = monsters(set).groundY(e.x, e.z, e.group.position.y);
      if (e.recoil > 0) e.recoil = Math.max(0, e.recoil - dt * 5);
    });
  },

  // Hollow Grasp: hands of shadow drag the foe down, and it leaves a Husk even if it lives.
  finisher(melee, e) {
    const set = melee.player.powers, h = legion(set);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283;
      set.fx.flame(e.x + Math.cos(a) * 1.5, ground(set, e.x, e.z), e.z + Math.sin(a) * 1.5, 3, 0.7, 1);
    }
    if (!e.def.machine) h.husks.push({ kind: e.kind, tier: e.tier ?? 0, marshal: !!(e.boss || e.elder), x: e.x, z: e.z, until: time(set) + HUSK_SECS });
    if (!e.boss) stagger(e, 1, time(set), true);
    return 'knockdown';
  },
};
