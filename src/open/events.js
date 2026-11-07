import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROADS, TOWNS, height, riverDistance } from './terrain.js';
import { along } from './roads.js';
import { tent } from './fortress.js';
import { VoxelBuilder } from '../render/voxel.js';
import { masonry } from './materials.js';
import { makeFigure } from './figures.js';
import { LOOKS } from '../art/looks.js';
import { walkPose } from '../render/models.js';
import { GOODS } from './economy.js';
import { itemOf } from './caravans.js';
import { NATIONS } from './nations.js';
import { DOCTRINES } from './doctrines.js';
import { showPlace, hidePlace } from './compass.js';

// Things happening out in the world (phase 7), each with more than one way to end, the way
// Guild Wars 2 builds its events: what the hero does (or doesn't) decides how it goes, and the
// world carries the result on. Kept few and easy to read, after Oblivion's lesson that free-running
// schedules turn to chaos: a bandit ambush on a merchant's wagon, a bridge being rebuilt, a rival
// nation's siege camp before a town, and refugees leaving a town the hero has been burning.
const GAP = 150;             // seconds between events the world starts on its own
const FROM = 260, TO = 620;  // tiles from a hero an event starts
const NOTICE = 700;          // tiles: close enough to be told about it
const SEE = 160;             // tiles: things shown
const SCALE = 2.3, TALK = 7;
const AMBUSH_WAIT = 75;      // seconds the merchants hold out once a hero is near
const BRIDGE_TIME = 240, BRIDGE_WOOD = 10;
const SIEGE_TIME = 150, SIEGE_NEAR = 1500, SIEGE_BROKEN = 0.7; // seconds; tiles a hero must be for a camp; share killed to lift it
const REFUGEE_PACE = 2.4, REFUGEES = 9, REFUGEE_GAP = 300;

const figure = (scene, look, x, z) => {
  const model = makeFigure(look);
  model.group.position.set(x, height(x, z), z);
  model.group.scale.setScalar(SCALE);
  scene.add(model.group);
  return model;
};

function wagon(x, y, z, turn, burnt) {
  const b = new VoxelBuilder(), wood = burnt ? '#2a2220' : '#7a5232';
  b.box(0, 1.4, 0, 2.6, 0.5, 5, wood, 0.05);
  for (const [dx, dz] of [[-1.5, -1.6], [1.5, -1.6], [-1.5, 1.6], [1.5, 1.6]]) b.box(dx, 0.8, dz, 0.3, 1.6, 1.6, burnt ? '#1a1412' : '#4a3020', 0.05);
  if (!burnt) for (let i = -2; i <= 2; i++) b.box(0, 2.4 + Math.cos(i * 0.6) * 0.6, i, 2.7, 0.3, 1, '#efe6d6', 0.03);
  for (let i = 0; i < 4; i++) b.box(-0.6 + (i % 2) * 1.2, 2, -1 + Math.floor(i / 2) * 1.6, 1, 0.9, 1, burnt ? '#3a2c22' : '#c9a654', 0.08);
  const m = new THREE.Mesh(b.build(), masonry());
  m.position.set(x, y, z);
  m.rotation.y = turn;
  m.castShadow = true;
  return m;
}

export default class Events {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.active = [];
    this.wait = GAP * 0.6;
    this.fled = new Map();
  }

  get hero() {
    return this.world.players[0];
  }

  start(ev) {
    ev.t = 0;
    ev.told = false;
    ev.r = 30;
    this.active.push(ev);
    showPlace(ev);
    return ev;
  }

  end(ev, text, color = '#e8c050') {
    this.active.splice(this.active.indexOf(ev), 1);
    hidePlace(ev);
    for (const m of ev.meshes ?? []) this.scene.remove(m);
    for (const m of ev.people ?? []) this.scene.remove(m.model?.group ?? m.group);
    if (text) this.world.realm?.say(text, color, ev.x, ev.z);
  }

  // A spot on a road some way from the hero, clear of towns.
  roadSpot() {
    const h = this.hero.state;
    for (let t = 0; t < 60; t++) {
      const path = ROADS[Math.floor(Math.random() * ROADS.length)];
      let len = 0;
      for (let k = 1; k < path.length; k++) len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
      const [x, z, a] = along(path, Math.random() * len), d = Math.hypot(x - h.x, z - h.z);
      if (d < FROM || d > TO || height(x, z) < 2 || TOWNS.some((T) => Math.hypot(x - T.x, z - T.z) < T.r + 60)) continue;
      return { x, z, a, path, at: len };
    }
    return null;
  }

  // ---- the events ----
  ambush() {
    const at = this.roadSpot();
    if (!at) return;
    const good = ['cloth', 'wine', 'tools', 'ale', 'furs'][Math.floor(Math.random() * 5)];
    this.start({ kind: 'ambush', name: 'Wagon under attack', rumour: 'bandits falling on a merchant\'s wagon', x: at.x, z: at.z, a: at.a, good, phase: 'wait' });
  }

  bridge() {
    const h = this.hero.state;
    for (const path of [...ROADS].sort(() => Math.random() - 0.5)) {
      let len = 0;
      for (let k = 1; k < path.length; k++) len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
      for (let d = 20; d < len; d += 8) {
        const [x, z, a] = along(path, d), dist = Math.hypot(x - h.x, z - h.z);
        if (riverDistance(x, z) < 0 && dist > FROM * 0.6 && dist < TO * 1.3) {
          this.start({ kind: 'bridge', name: 'Bridge works', rumour: 'a bridge being mended, with the road closed', x, z, a, wood: 0 });
          return;
        }
      }
    }
  }

  // Called by the realm when a nation marches on a place: with a hero near, the siege is laid out
  // where it can be seen and broken; otherwise the realm settles it at once. Returns true if laid.
  siege(id, place, settle) {
    const h = this.hero.state;
    if (Math.hypot(place.x - h.x, place.z - h.z) > SIEGE_NEAR || this.active.some((e) => e.kind === 'siege')) return false;
    const n = NATIONS.find((a) => a.id === id), T = TOWNS.find((t) => t.name === place.name), back = (T?.r ?? 80) + 90;
    const a = Math.atan2(n.x - place.x, n.z - place.z), x = place.x + Math.sin(a) * back, z = place.z + Math.cos(a) * back;
    this.start({ kind: 'siege', name: `Siege of ${place.name}`, rumour: `${n.name} laying siege to ${place.name}`, x, z, id, n, place, settle, foes: [] });
    this.world.realm?.say(`${n.name} has laid siege to ${place.name}!`, n.color, x, z);
    return true;
  }

  // Called when a hero's fire and fists cost a town its homes: its people take to the road.
  flee(place) {
    const now = performance.now() / 1000;
    if (now - (this.fled.get(place.name) ?? -1e9) < REFUGEE_GAP) return;
    const places = this.world.realm?.settlements ?? [], to = places.filter((s) => s !== place).sort((a, b) => Math.hypot(a.x - place.x, a.z - place.z) - Math.hypot(b.x - place.x, b.z - place.z))[0];
    if (!to) return;
    this.fled.set(place.name, now);
    const count = Math.min(REFUGEES, Math.max(3, Math.round(place.pop / 60)));
    place.pop = Math.max(2, place.pop - count * 8);
    this.start({ kind: 'refugees', name: `Refugees from ${place.name}`, rumour: `refugees from ${place.name} on the road to ${to.name}`, x: place.x, z: place.z, from: place, to, count, gone: 0, robbed: 0 });
  }

  // ---- running them ----
  update(dt) {
    const h = this.hero;
    if (!h) return;
    if ((this.wait -= dt) <= 0 && !this.active.some((e) => e.kind === 'ambush' || e.kind === 'bridge')) {
      this.wait = GAP * (0.8 + Math.random() * 0.5);
      if (Math.random() < 0.6) this.ambush();
      else this.bridge();
    }
    for (const ev of [...this.active]) {
      ev.t += dt;
      const d = Math.hypot(h.state.x - ev.x, h.state.z - ev.z);
      if (!ev.told && d < NOTICE) {
        ev.told = true;
        h.hud.message(`${ev.name}: ${ev.rumour}, ${Math.round(d / 10) * 10} m away.`, true);
      }
      this[ev.kind === 'refugees' ? 'walk' : `run${ev.kind[0].toUpperCase()}${ev.kind.slice(1)}`](ev, dt, d);
    }
  }

  runAmbush(ev, dt, d) {
    const { monsters } = this.world, y = height(ev.x, ev.z);
    if (!ev.meshes && d < SEE) {
      ev.meshes = [wagon(ev.x, y, ev.z, ev.a, false)];
      this.scene.add(ev.meshes[0]);
      ev.people = [0, 1].map((i) => ({ model: figure(this.scene, LOOKS.merchant, ev.x + (i ? 2.5 : -2.5), ev.z + 3) }));
      ev.foes = ['chief', 'bandit', 'bandit', 'bandit', 'bandit'].map((type, i) => monsters.add(type, ev.x + Math.cos(i * 1.3) * 9, ev.z + Math.sin(i * 1.3) * 9, monsters.danger(ev.x, ev.z), false)).filter(Boolean);
      ev.phase = 'fight';
      ev.held = 0;
    }
    if (ev.phase !== 'fight') {
      if (ev.t > GAP * 1.5) this.end(ev);
      return;
    }
    for (const p of ev.people ?? []) walkPose(p.model, ev.t * 9, 0);
    const left = ev.foes.filter((e) => monsters.list.includes(e));
    if (!left.length) {
      // Saved: the merchants pay, and the road's lord is grateful.
      const gold = 25 + Math.round(Math.random() * 20);
      this.hero.bag.gold += gold;
      this.hero.bag.add(itemOf(ev.good), 3);
      this.hero.bag.save();
      this.calm(ev.x, ev.z, 1);
      return this.end(ev, `You drove the bandits off the merchants' wagon. They pay you ${gold} gold and three of their ${GOODS[ev.good].name.toLowerCase()}.`);
    }
    if (d < SEE) ev.held += dt;
    if (ev.held > AMBUSH_WAIT) {
      // Too late: the wagon burns.
      this.scene.remove(ev.meshes[0]);
      ev.meshes = [wagon(ev.x, height(ev.x, ev.z), ev.z, ev.a, true)];
      this.scene.add(ev.meshes[0]);
      this.world.smoke?.column(ev.x, height(ev.x, ev.z) + 1, ev.z, 1.2, 40);
      for (let i = 0; i < 6; i++) this.world.fx?.flame(ev.x + (Math.random() - 0.5) * 3, height(ev.x, ev.z) + 1.5, ev.z + (Math.random() - 0.5) * 4, 2.5, 3, 0);
      for (const p of ev.people) this.scene.remove(p.model.group);
      ev.people = [];
      ev.phase = 'done';
      this.end(ev, 'The bandits took the wagon and fired it. The merchants are gone.', '#c0392b');
    }
  }

  runBridge(ev, dt, d) {
    const y = height(ev.x, ev.z);
    if (!ev.meshes && d < SEE) {
      const b = new VoxelBuilder(), sx = Math.cos(ev.a), sz = -Math.sin(ev.a);
      for (let i = -3; i <= 3; i++) for (const s of [-5, 5]) b.box(ev.x + Math.sin(ev.a) * i * 3 + sx * s, y + 3, ev.z + Math.cos(ev.a) * i * 3 + sz * s, 0.4, 6, 0.4, '#8a6040');
      for (let i = -3; i <= 3; i++) b.box(ev.x + Math.sin(ev.a) * i * 3, y + 5.8, ev.z + Math.cos(ev.a) * i * 3, 10.5, 0.3, 0.5, '#6a4a30');
      for (let i = 0; i < 6; i++) b.box(ev.x + sx * 9 + (i % 3) * 1.2, y + 0.6 + Math.floor(i / 3), ev.z + sz * 9, 1, 1, 5, '#a07850', 0.06);
      ev.meshes = [new THREE.Mesh(b.build(), masonry())];
      ev.meshes[0].castShadow = true;
      this.scene.add(ev.meshes[0]);
      ev.people = [0, 1, 2].map((i) => ({ model: figure(this.scene, i ? LOOKS.smith : LOOKS.elder, ev.x + sx * (7 + i * 2), ev.z + sz * (7 + i * 2)) }));
    }
    for (const [i, p] of (ev.people ?? []).entries()) {
      walkPose(p.model, ev.t * 6 + i, 0);
      p.model.arms[1].rotation.x = i ? -1.6 + Math.sin(ev.t * 7 + i) * 0.9 : 0;
    }
    const time = BRIDGE_TIME * (ev.wood >= BRIDGE_WOOD ? 0.25 : 1);
    if (ev.t > time) this.end(ev, ev.wood >= BRIDGE_WOOD ? 'With your timber, the bridge is mended early and the road opens again.' : 'The bridge is mended and the road is open again.');
  }

  runSiege(ev, dt, d) {
    const { monsters } = this.world;
    if (!ev.meshes) {
      const parts = [];
      let seed = 11;
      const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 6; i++) tent(parts, Math.cos(i) * 14, Math.sin(i) * 14, 6, 7, i % 2 ? ev.n.color : '#efe6d6', rand);
      const m = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), masonry());
      m.position.set(ev.x, height(ev.x, ev.z), ev.z);
      ev.meshes = [m];
      this.scene.add(m);
      const troops = DOCTRINES[ev.id]?.troops ?? ['soldier'], machine = DOCTRINES[ev.id]?.machine;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 6.283, e = monsters.add(i === 0 && machine ? machine : troops[i % troops.length], ev.x + Math.cos(a) * 20, ev.z + Math.sin(a) * 20, monsters.danger(ev.x, ev.z), false);
        if (e) {
          e.nation = ev.id;
          ev.foes.push(e);
        }
      }
      ev.total = ev.foes.length;
    }
    const left = ev.foes.filter((e) => monsters.list.includes(e)).length;
    if (ev.total && (ev.total - left) / ev.total >= SIEGE_BROKEN) {
      // Broken: the attack fails, and the attacker loses men.
      const s = this.world.realm?.of(ev.id);
      if (s) s.troops = Math.max(0, s.troops * 0.8);
      return this.end(ev, `You broke the siege of ${ev.place.name}. ${ev.n.name} pulls back.`, ev.n.color);
    }
    if (ev.t > SIEGE_TIME) {
      // Left alone, the siege runs its course; what's left of it weighs on the result.
      for (const e of ev.foes) if (monsters.list.includes(e)) monsters.removeEnemy(e);
      ev.settle(ev.total ? left / ev.total : 1);
      this.end(ev);
    }
  }

  walk(ev, dt, d) {
    const { to } = ev, dx = to.x - ev.x, dz = to.z - ev.z, len = Math.hypot(dx, dz);
    if (len < (TOWNS.find((T) => T.name === to.name)?.r ?? 60) * 0.6) {
      to.pop += (ev.count - ev.robbed) * 8;
      return this.end(ev, `Refugees from ${ev.from.name} have reached ${to.name}.`, '#9a8e88');
    }
    ev.x += (dx / len) * REFUGEE_PACE * dt;
    ev.z += (dz / len) * REFUGEE_PACE * dt;
    if (d < SEE && !ev.people) {
      ev.people = Array.from({ length: ev.count }, (_, i) => ({ model: figure(this.scene, [LOOKS.elder, LOOKS.kid, LOOKS.merchant, LOOKS.smith][i % 4], ev.x, ev.z), off: [(i % 3 - 1) * 2.2, -Math.floor(i / 3) * 3], phase: i, robbed: false }));
    } else if (d > SEE * 1.3 && ev.people) {
      for (const p of ev.people) this.scene.remove(p.model.group);
      ev.people = null;
    }
    const face = Math.atan2(dx, dz), sx = Math.cos(face), sz = -Math.sin(face);
    for (const p of ev.people ?? []) {
      if (p.robbed) continue;
      const x = ev.x + sx * p.off[0] + (dx / len) * p.off[1], z = ev.z + sz * p.off[0] + (dz / len) * p.off[1];
      p.model.group.position.set(x, height(x, z), z);
      p.model.group.rotation.y = face;
      walkPose(p.model, (p.phase += dt * 7), 0.7);
    }
  }

  // A blow on the road: bandits' victims, refugees and bridge workers feel it.
  struck(x, z, reach, force, hero) {
    for (const ev of this.active) {
      if (ev.kind === 'refugees' && ev.people) {
        for (const p of ev.people) {
          if (p.robbed || Math.hypot(p.model.group.position.x - x, p.model.group.position.z - z) > reach + 1.5) continue;
          p.robbed = true;
          ev.robbed++;
          this.scene.remove(p.model.group);
          hero.bag.gold += 4;
          hero.bag.save();
          hero.hud.message('You take what little they carried: 4 gold. The others hurry on.');
        }
      } else if (ev.kind === 'ambush' && ev.phase === 'fight' && Math.hypot(ev.x - x, ev.z - z) < reach + 4) {
        // Joining in: the wagon's goods are yours, the merchants flee, the road's lord remembers.
        hero.bag.add(itemOf(ev.good), 6);
        hero.bag.save();
        this.calm(ev.x, ev.z, -1);
        for (const e of ev.foes) if (this.world.monsters.list.includes(e)) this.world.monsters.removeEnemy(e);
        this.end(ev, `You join the bandits and strip the wagon: six ${GOODS[ev.good].name.toLowerCase()}.`, '#c0392b');
        return;
      }
    }
    void force;
  }

  // The lord of the land warms to the hero (+1) or holds a grudge (-1).
  calm(x, z, way) {
    const { realm } = this.world;
    if (!realm) return;
    let best = null, bd = 1e9;
    for (const a of NATIONS) {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bd) {
        best = a;
        bd = d;
      }
    }
    const s = best && realm.of(best.id);
    if (s) s.grudge = Math.max(0, (s.grudge ?? 0) - way);
  }

  // At the bridge: hand the foreman timber.
  spot(h) {
    for (const ev of this.active) {
      if (ev.kind !== 'bridge' || !ev.people || ev.wood >= BRIDGE_WOOD) continue;
      const f = ev.people[0].model.group.position;
      if (Math.hypot(h.state.x - f.x, h.state.z - f.z) > TALK) continue;
      return { label: `Give the foreman ${BRIDGE_WOOD} wood`, act: () => {
        if ((h.bag.items.wood ?? 0) < BRIDGE_WOOD) return h.hud.message(`"Bring us ${BRIDGE_WOOD} wood and we'll have it done in no time."`);
        h.bag.remove('wood', BRIDGE_WOOD);
        h.bag.gold += 20;
        h.bag.save();
        ev.wood = BRIDGE_WOOD;
        this.calm(ev.x, ev.z, 1);
        h.hud.message('"That\'s just what we needed!" The foreman pays you 20 gold for the timber.');
        return undefined;
      } };
    }
    return null;
  }
}
