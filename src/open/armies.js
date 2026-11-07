import * as THREE from 'three';
import { NATIONS } from './nations.js';
import { DOCTRINES } from './doctrines.js';
import { nameCaptain } from './settlements.js';
import { VoxelBuilder, vmat } from '../render/voxel.js';

// Nation armies (v0.39.0), the answer to an Omega Level of Calamity (one nation) or Omega (a coalition).
// An army musters at its nation's seat, is announced, and marches on the hero where it can be seen on
// the map and on the horizon; meet it, ambush it, or burn its supply wagon (no more troops come up).
//   Squads: levies, veterans, captains, war machines and a Commander. Far off, a squad is only numbers
//   drawn as one instanced crowd; within NEAR of a hero it becomes real fighters (at most FULL at once),
//   and goes back to numbers when left behind.
//   Morale: losses, fallen captains, broken machines, the supply wagon and above all the Commander wear
//   it down; under ROUT the army breaks and runs. A beaten army leaves its nation weak, raises the
//   Omega Level, and buys a truce before the next one.
// `world.armies`.
const NEAR = 70, FAR = 110, FULL = 40;
const MARCH = 5, CHARGE = 6, ENGAGE = 120;
const ARMY_EVERY = 600, FIRST = 60, TRUCE = 600;
const ROUT = 0.35, BREAK = 0.15;
const LOSS = { unit: 0.6, captain: 0.12, machine: 0.08, commander: 0.35, supply: 0.15, watcher: 0.25 };  // `unit` is spread over the army's size
const MOST_UNITS = 400;
const LEVY = 0.6, VETERAN = 0.3, PER_SQUAD = 10, PER_TROOP = 4;

function soldierGeometry() {
  const b = new VoxelBuilder();
  b.box(-0.18, 0.45, 0, 0.22, 0.9, 0.24, '#3a3028', 0.04).box(0.18, 0.45, 0, 0.22, 0.9, 0.24, '#3a3028', 0.04);
  b.box(0, 1.35, 0, 0.7, 0.95, 0.42, '#ffffff', 0.04);        // the tunic takes the nation's colour
  b.box(0, 2.05, 0, 0.42, 0.42, 0.42, '#c9a07a', 0.03).box(0, 2.3, 0, 0.5, 0.18, 0.5, '#8a8a90', 0.02);
  b.box(0.5, 1.6, 0.1, 0.08, 2.6, 0.08, '#6a4a2a', 0).box(0.5, 2.95, 0.1, 0.14, 0.3, 0.14, '#c8c8d0', 0);
  return b.build();
}

function wagonMesh(color) {
  const b = new VoxelBuilder();
  b.box(0, 1.1, 0, 2.4, 0.4, 4.2, '#6a4a2a', 0.06).box(0, 1.9, 0, 2.2, 1.2, 3.6, color, 0.05);
  for (const [x, z] of [[-1.2, -1.4], [1.2, -1.4], [-1.2, 1.4], [1.2, 1.4]]) b.box(x, 0.55, z, 0.25, 1.1, 1.1, '#3a2a1a', 0.04);
  b.box(0, 2.8, 1.6, 0.1, 1.6, 0.1, '#3a2a1a', 0).box(0.45, 3.4, 1.6, 0.8, 0.5, 0.06, color, 0);
  const m = new THREE.Mesh(b.build(), vmat());
  m.castShadow = true;
  return m;
}

export default class Armies {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.next = FIRST;
    this.truce = 0;
    this.crowd = new THREE.InstancedMesh(soldierGeometry(), vmat(), MOST_UNITS);
    this.crowd.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MOST_UNITS * 3), 3);
    this.crowd.count = 0;
    this.crowd.castShadow = true;
    this.crowd.frustumCulled = false;
    world.scene.add(this.crowd);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.c = new THREE.Color();
    this.v = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  get monsters() {
    return this.world.monsters;
  }

  get time() {
    return this.monsters.time;
  }

  // Calamity sends one nation's army; Omega a coalition of up to three. Each draws on real troops.
  muster(hero) {
    const om = this.world.omega, nations = this.world.nations, realm = this.world.realm;
    const standing = NATIONS.filter((n) => !nations.isFallen(n) && (realm.of(n.id)?.troops ?? 0) >= 20);
    if (!standing.length) return;
    const pick = standing.sort((a, b) => Math.hypot(a.x - hero.state.x, a.z - hero.state.z) - Math.hypot(b.x - hero.state.x, b.z - hero.state.z)).slice(0, om.phase >= 5 ? 3 : 1);
    for (const n of pick) this.raise(n, hero);
    const names = pick.map((n) => n.name).join(', ');
    for (const p of this.world.players) {
      p.hud.message(pick.length > 1 ? `A coalition marches on you: ${names}.` : `War horns: ${names} has called its army against you.`, true, 6000);
      p.hud.flash(0.2);
    }
    realm.say(pick.length > 1 ? `${names} march together against you.` : `${names} marches against you from ${pick[0].seat}.`, pick[0].color, pick[0].x, pick[0].z);
  }

  raise(n, hero) {
    const realm = this.world.realm, force = realm.of(n.id), d = DOCTRINES[n.id], om = this.world.omega;
    // The realm counts troops in companies (PER_TROOP soldiers each): a lone army calls up more of them
    // than each army of a coalition does, so a march is about 140 soldiers and a coalition about 300.
    const spend = Math.min(force.troops, om.phase >= 5 ? 25 : 35);
    const size = Math.round(Math.max(40, spend * PER_TROOP + hero.body.level / 2) * (this.world.players.length > 1 ? 1.4 : 1));
    force.troops = Math.max(0, force.troops - spend);
    const squads = [];
    const add = (role, kind, count) => squads.push({ role, kind, count, live: [], x: 0, z: 0, ox: 0, oz: 0 });
    for (let left = Math.round(size * LEVY); left > 0; left -= PER_SQUAD) add('levy', d.troops[d.troops.length - 1], Math.min(PER_SQUAD, left));
    for (let left = Math.round(size * VETERAN); left > 0; left -= PER_SQUAD) add('veteran', d.troops[0], Math.min(PER_SQUAD, left));
    add('captain', d.troops[0], 1);
    add('captain', d.troops[0], 1);
    add('machine', d.machine, 1);
    add('machine', n.id === 'aurel' ? 'trebuchet' : d.machine, 1);
    add('commander', d.troops[0], 1);
    // A Watcher marches with it (watchers.js).
    if (this.world.watchers) add('watcher', this.world.watchers.pick(), 1);
    // In ranks: machines and the Commander at the back, levies in front.
    const order = { levy: 0, veteran: 1, captain: 2, machine: 3, commander: 3, watcher: 3 };
    squads.sort((a, b) => order[a.role] - order[b.role]).forEach((s, i) => {
      s.ox = ((i % 4) - 1.5) * 9;
      s.oz = -Math.floor(i / 4) * 9;
    });
    // A Watcher leads it, out in front, and takes the field first (embody goes in order).
    const lead = squads.findIndex((s) => s.role === 'watcher');
    if (lead > 0) {
      Object.assign(squads[lead], { ox: 0, oz: 12 });
      squads.unshift(...squads.splice(lead, 1));
    }
    const army = {
      n, nation: n.id, squads, size: squads.reduce((t, s) => t + s.count, 0), morale: 1, state: 'march',
      x: n.x, z: n.z, dx: 0, dz: 1, commander: nameCaptain(n.id), wagon: wagonMesh(n.color), supply: 1, dust: 0,
    };
    army.wagon.position.set(n.x, this.world.players[0].melee.height(n.x, n.z), n.z);
    this.world.scene.add(army.wagon);
    this.list.push(army);
  }

  // A unit of an army died.
  killed(e) {
    const a = e.army;
    if (!a || a.state === 'done') return;
    const s = e.squad;
    if (s) {
      s.count = Math.max(0, s.count - 1);
      s.live = s.live.filter((x) => x !== e);
    }
    let loss = LOSS.unit / Math.max(10, a.size);
    if (s?.role === 'captain') loss += LOSS.captain;
    if (s?.role === 'machine') loss += LOSS.machine;
    if (s?.role === 'watcher') loss += LOSS.watcher;
    if (s?.role === 'commander') {
      loss += LOSS.commander;
      for (const p of this.world.players) p.hud.message(`Commander ${a.commander} has fallen! The army of ${a.n.name} wavers.`, true, 4000);
    }
    this.shake(a, loss);
  }

  shake(a, loss) {
    a.morale = Math.max(0, a.morale - loss);
    if (a.state !== 'rout' && a.morale < ROUT) this.rout(a);
  }

  rout(a) {
    a.state = 'rout';
    const t = this.time;
    for (const s of a.squads) for (const e of s.live) if (s.role !== 'machine' && (s.role === 'levy' || a.morale < BREAK || Math.random() < 0.6)) e.fleeUntil = t + 30;
    for (const p of this.world.players) p.hud.message(`The army of ${a.n.name} breaks and runs!`, true, 4000);
    this.world.realm.say(`You broke the army of ${a.n.name}.`, a.n.color, a.x, a.z);
    this.world.omega?.deed('army');
    this.end(a);
  }

  end(a) {
    a.state = 'done';
    a.endAt = this.time;
    this.truce = TRUCE;
    this.next = Math.max(this.next, TRUCE);
  }

  // A hero's blast near the supply wagon wrecks it: no more troops come up, and the army frets.
  struck(x, z, reach, force) {
    for (const a of this.list) {
      if (a.supply <= 0 || a.state === 'done') continue;
      if (Math.hypot(a.wagon.position.x - x, a.wagon.position.z - z) > reach + 3) continue;
      a.supply -= 0.35;
      this.world.fx.impact('fire', a.wagon.position.x, a.wagon.position.y, a.wagon.position.z, 3);
      if (a.supply <= 0) {
        a.wagon.rotation.z = 1.2;
        this.world.scars.mark('fire', a.wagon.position.x, a.wagon.position.z, 3, null, 1, 0.5);
        for (const p of this.world.players) p.hud.message(`You burnt the supply of ${a.n.name}'s army.`, true);
        this.shake(a, LOSS.supply);
      }
    }
  }

  // Squads near a hero become real fighters; left behind, they go back to numbers.
  embody(a, hero) {
    const m = this.monsters;
    let full = this.list.reduce((t, x) => t + x.squads.reduce((u, s) => u + s.live.length, 0), 0);
    for (const s of a.squads) {
      s.live = s.live.filter((e) => !e.dying && m.list.includes(e));
      const d = Math.hypot(s.x - hero.state.x, s.z - hero.state.z);
      if (!s.live.length && s.count > 0 && d < NEAR && full < FULL && a.state !== 'done') {
        for (let i = 0; i < s.count && full < FULL; i++, full++) {
          const big = s.role === 'captain' || s.role === 'commander';
          const e = m.add(s.kind, s.x + (i % 5) * 2.2, s.z + Math.floor(i / 5) * 2.2, m.danger(s.x, s.z) + (s.role === 'levy' ? 0 : 1), big);
          Object.assign(e, { nation: a.nation, army: a, squad: s });
          if (s.role === 'commander') e.captain = { name: a.commander, title: 'Commander', rank: 3, kills: 0, alive: true };
          s.live.push(e);
        }
      } else if (s.live.length && d > FAR && a.state !== 'battle') {
        for (const e of s.live) {
          for (const c of e.crew ?? []) if (m.list.includes(c)) m.removeEnemy(c);
          m.removeEnemy(e);
        }
        s.live = [];
      }
    }
  }

  update(dt) {
    const players = this.world.players, hero = players[0], om = this.world.omega;
    if (!om) return;
    this.truce = Math.max(0, this.truce - dt);
    if (om.phase >= 4 && !this.list.some((a) => a.state !== 'done') && !this.truce && (this.next -= dt) <= 0) {
      this.next = ARMY_EVERY;
      this.muster(hero);
    }
    let n = 0;
    for (const a of this.list) {
      const ground = (x, z) => hero.melee.height(x, z);
      const dist = Math.hypot(hero.state.x - a.x, hero.state.z - a.z);
      if (a.state === 'march' || a.state === 'battle') {
        // March on the hero (re-aiming as they move); close in at a run once in sight.
        if (dist > 1) {
          a.dx = (hero.state.x - a.x) / dist;
          a.dz = (hero.state.z - a.z) / dist;
        }
        if (dist < ENGAGE) a.state = 'battle';
        const pace = a.state === 'battle' ? (dist > 25 ? CHARGE : 0) : MARCH;
        a.x += a.dx * pace * dt;
        a.z += a.dz * pace * dt;
        // The army is beaten when there's nothing left of it to fight.
        if (!a.squads.some((s) => s.count > 0)) this.rout(a);
      }
      // Ranks turned to face the way it's going.
      const sx = -a.dz, sz = a.dx;
      for (const s of a.squads) {
        s.x = a.x + sx * s.ox + a.dx * s.oz;
        s.z = a.z + sz * s.ox + a.dz * s.oz;
      }
      if (a.state !== 'done') this.embody(a, hero);
      // The supply wagon trails behind.
      const wx = a.x - a.dx * 40, wz = a.z - a.dz * 40;
      a.wagon.position.set(wx, ground(wx, wz), wz);
      a.wagon.rotation.y = Math.atan2(a.dx, a.dz);
      // A column of dust over a marching army, seen from far off.
      if (a.state === 'march' && (a.dust -= dt) <= 0) {
        a.dust = 2;
        this.world.smoke?.column(a.x, ground(a.x, a.z), a.z, 1.5, 6);
      }
      // Everyone still only numbers is drawn as one crowd.
      if (a.state === 'done') continue;
      this.c.set(a.n.color);
      this.q.setFromAxisAngle(this.up, Math.atan2(a.dx, a.dz));
      for (const s of a.squads) {
        if (s.live.length || !s.count) continue;
        const scale = s.role === 'machine' ? 1.7 : s.role === 'commander' ? 1.4 : 1.15;
        for (let i = 0; i < s.count && n < MOST_UNITS; i++) {
          const x = s.x + ((i % 5) - 2) * 1.8 * scale, z = s.z + Math.floor(i / 5) * 1.8 * scale, bob = Math.abs(Math.sin(this.time * 7 + i)) * 0.15;
          this.m.compose(this.v.set(x, ground(x, z) + bob, z), this.q, this.v.clone().set(scale, scale, scale));
          this.crowd.setMatrixAt(n, this.m);
          this.crowd.setColorAt(n, this.c);
          n++;
        }
      }
    }
    // Armies long done are cleared away.
    this.list = this.list.filter((a) => {
      if (a.state !== 'done' || this.time - a.endAt < 90) return true;
      this.world.scene.remove(a.wagon);
      return false;
    });
    if (n || this.crowdLive) {
      this.crowd.count = n;
      this.crowd.instanceMatrix.clearUpdateRanges();
      this.crowd.instanceMatrix.addUpdateRange(0, n * 16);
      this.crowd.instanceMatrix.needsUpdate = true;
      this.crowd.instanceColor.clearUpdateRanges();
      this.crowd.instanceColor.addUpdateRange(0, n * 3);
      this.crowd.instanceColor.needsUpdate = true;
    }
    this.crowdLive = n > 0;
    // The nearest army in the field, for the HUD banner.
    for (const p of players) {
      const a = this.list.filter((x) => x.state !== 'done').sort((x, y) => Math.hypot(x.x - p.state.x, x.z - p.state.z) - Math.hypot(y.x - p.state.x, y.z - p.state.z))[0];
      const alive = a ? a.squads.reduce((t, s) => t + s.count, 0) : 0;
      p.hud.setArmy(a ? { name: `Army of ${a.n.name}`, color: a.n.color, morale: a.morale, strength: alive, far: Math.round(Math.hypot(a.x - p.state.x, a.z - p.state.z) / 10) * 10 } : null);
    }
  }

  // For the map: where each army is, and how strong.
  marks() {
    return this.list.filter((a) => a.state !== 'done').map((a) => ({ x: a.x, z: a.z, name: `Army of ${a.n.name}`, icon: 'army', color: a.n.color, size: 1.3, info: `Army of ${a.n.name}: ${a.squads.reduce((t, s) => t + s.count, 0)} strong, morale ${Math.round(a.morale * 100)}%, ${a.state === 'march' ? 'marching on you' : 'in battle'}` }));
  }
}
