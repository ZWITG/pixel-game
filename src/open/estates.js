import * as THREE from 'three';
import { height, roadDistance } from './terrain.js';
import { toon, paint, ball, limb, block, spike, skin, shine } from './kit.js';
import { STONEWORK } from './fortress.js';
import { NATIONS } from './nations.js';
import { ESTATE_TIER, REBUILD } from './economy.js';
import { TIERS, tierOf } from './settlements.js';
import { strike, settleWorks, ground, voxelWorld } from './raze.js';

// The buildings that make a place a kingdom's town, each doing a job: a granary holds food
// against hunger, barracks raise soldiers, an armory keeps arms and lets armourers work, a market
// hall and warehouse carry trade, a guild hall drives the crafts, a treasury holds the nation's
// gold. Each stands in its own quarter, can be torn down, and costs the nation what it did.
// A nation rebuilds what it loses, under scaffolding, with gold, timber and stone.
//   hits: blows of a hero's might.  size: reach in tiles.  timber: fire eats it.
const CIV = 26, TRADE = 38, WAR = 44, STORE = 34; // rings, in tiles from a place's middle, for each quarter
const SHOW = 620, DROP = 900;
const BUY_IN = 1.5;                 // what a nation pays over market price for timber and stone it must bring in
const RISE = 13;                    // tiles a rebuilt building climbs out of its footings
const BLOW = 1.3, GROWTH_KEPT = 0.85;
const ALARM = 45;                   // seconds before a place calls its guards again
const DEFENDERS = 3;
const LOOT_SHARE = 0.45;            // of a treasury's share of its nation's gold that a hero carries off
const GARRISON_LOST = 0.12;         // of a nation's troops, killed when one of its barracks falls

const WOOD = '#7a5230', DARK = '#4e3220', PLASTER = '#e8dcc8', IRON = '#3a3a44', GOLD = '#ffcd5a';
const cyl = (r1, r2, h, sides = 14) => new THREE.CylinderGeometry(r1, r2, h, sides);
const cone = (r, h, sides = 14) => new THREE.ConeGeometry(r, h, sides);
function gable(w, d, rise, y) {
  const g = new THREE.BufferGeometry(), x = w / 2, z = d / 2;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-x, y, z, x, y, z, x, y + rise, 0, -x, y, z, x, y + rise, 0, -x, y + rise, 0, x, y, -z, -x, y, -z, -x, y + rise, 0, x, y, -z, -x, y + rise, 0, x, y + rise, 0, x, y, z, x, y, -z, x, y + rise, 0, -x, y, -z, -x, y, z, -x, y + rise, 0], 3));
  g.computeVertexNormals();
  return g;
}

export const ESTATES = {
  granary: {
    name: 'Granary', quarter: STORE, hits: 8, size: 4.5, timber: true,
    text: 'Holds food against lean days.',
    draw(p, lit, c) {
      p.push(paint(cyl(4, 4.3, 1.4).translate(0, 0.7, 0), c.stone), paint(cyl(3.6, 3.8, 6.5).translate(0, 4.6, 0), WOOD));
      for (let i = 0; i < 6; i++) p.push(paint(block(0.3, 6.6, 0.3).translate(Math.cos(i) * 3.75, 4.6, Math.sin(i) * 3.75), DARK));
      p.push(paint(cyl(3.9, 3.9, 0.4).translate(0, 7.9, 0), DARK), paint(cone(4.8, 4.2).translate(0, 10.2, 0), '#d8b060'), paint(cone(1.2, 1.4).translate(0, 12.6, 0), '#b08a40'));
      p.push(paint(block(1.6, 2.4, 0.3).translate(0, 2.6, 3.7), DARK));
      for (const [x, z] of [[2.6, 4.2], [3.6, 3.4], [-3.2, 4]]) p.push(paint(ball(0.6, 1, 0.8, 1).translate(x, 0.5, z), '#e8c060'));
      lit.push(paint(block(0.7, 0.7, 0.1).translate(0, 6.8, 3.62), '#ffb45a'));
    },
  },
  barracks: {
    name: 'Barracks', quarter: WAR, hits: 14, size: 7.5,
    text: 'Where the nation raises its soldiers.',
    draw(p, lit, c) {
      p.push(paint(block(15, 2.2, 7.5).translate(0, 1.1, 0), c.stone), paint(block(15, 2.6, 7.5).translate(0, 3.5, 0), WOOD), paint(block(15.6, 0.4, 8.2).translate(0, 2.25, 0), DARK));
      p.push(paint(gable(16, 8.6, 3.4, 4.8), c.roof), paint(block(2.4, 3.2, 0.3).translate(0, 1.6, 3.8), DARK));
      for (const x of [-5.5, -2.8, 2.8, 5.5]) lit.push(paint(block(1, 1, 0.1).translate(x, 3.6, 3.77), '#ffb45a'));
      for (const x of [-6, -4.5]) p.push(paint(limb(0.08, 0.08, 3.2).translate(x, 3.2, 5.4), DARK), paint(spike(0.15, 0.6).translate(x, 3.2, 5.4), '#c8ccd4'));
      p.push(paint(block(2.4, 0.2, 0.2).translate(-5.25, 2, 5.4), DARK), paint(limb(0.12, 0.12, 2.4).translate(5.5, 2.4, 6), WOOD), paint(ball(0.55, 1, 1.3, 0.7).translate(5.5, 2.6, 6), '#d8b060'), paint(block(1.4, 0.2, 0.2).translate(5.5, 2.1, 6), WOOD));
      p.push(paint(block(0.3, 5.4, 0.3).translate(7.8, 5.6, 3.9), DARK), paint(block(0.1, 2.2, 1.6).translate(7.8, 7.2, 4.8), c.trim));
    },
  },
  armory: {
    name: 'Armory', quarter: WAR, hits: 16, size: 6.5,
    text: 'Keeps the arms; without it armourers can’t work and soldiers go short.',
    draw(p, lit, c) {
      p.push(paint(block(12, 6, 8.5).translate(0, 3, 0), c.stone), paint(block(12.6, 0.6, 9.1).translate(0, 6.3, 0), c.dark));
      for (let i = -5; i <= 5; i += 2) for (const z of [-4.2, 4.2]) p.push(paint(block(1, 1.2, 0.7).translate(i, 7.2, z), c.stone));
      for (const z of [-3.2, -1, 1, 3.2]) for (const x of [-5.8, 5.8]) p.push(paint(block(0.7, 1.2, 1).translate(x, 7.2, z), c.stone));
      p.push(paint(block(2.6, 3.6, 0.4).translate(0, 1.8, 4.3), IRON), paint(cyl(1.5, 1.5, 0.3, 6).rotateX(Math.PI / 2).translate(0, 4.6, 4.4), c.roof), paint(cyl(0.7, 0.7, 0.35, 6).rotateX(Math.PI / 2).translate(0, 4.6, 4.5), c.trim));
      for (const x of [-4.5, -3.8, -3.1]) p.push(paint(limb(0.06, 0.06, 3.4).translate(x, 3.6, 5.1), DARK), paint(spike(0.14, 0.6).translate(x, 3.6, 5.1), '#c8ccd4'));
      p.push(paint(block(2, 0.3, 0.6).translate(-3.8, 0.9, 5.1), WOOD), paint(block(1.4, 0.9, 0.7).translate(4.2, 0.45, 5.4), IRON), paint(block(1.8, 0.4, 0.8).translate(4.2, 1.05, 5.4), IRON));
      lit.push(paint(block(0.4, 1.4, 0.1).translate(-2.6, 3.8, 4.27), '#ff9a4a'), paint(block(0.4, 1.4, 0.1).translate(2.6, 3.8, 4.27), '#ff9a4a'));
    },
  },
  market: {
    name: 'Market Hall', quarter: TRADE, hits: 9, size: 7, timber: true,
    text: 'Draws trade and the taxes on it.',
    draw(p, lit, c) {
      p.push(paint(block(13, 0.6, 9).translate(0, 0.3, 0), c.stone));
      for (const x of [-6, -2, 2, 6]) for (const z of [-4, 4]) p.push(paint(block(0.6, 4.6, 0.6).translate(x, 2.9, z), WOOD));
      p.push(paint(block(13.4, 0.5, 9.4).translate(0, 5.3, 0), DARK), paint(gable(14, 10, 3.2, 5.5), c.roof));
      const awn = ['#c84a3a', '#e8c050', '#3b8a5a', '#3b5dc9'];
      for (let i = 0; i < 4; i++) {
        const x = -4.5 + i * 3;
        p.push(paint(block(2.2, 0.9, 1.4).translate(x, 1.05, -1.4), WOOD), paint(block(2.4, 0.15, 1.8).translate(x, 2.5, -1.4), awn[i]));
        p.push(paint(ball(0.35).translate(x - 0.5, 1.7, -1.4), ['#e8c060', '#d86a5a', '#8fd0e8', '#b03a5a'][i]), paint(ball(0.3).translate(x + 0.4, 1.65, -1.2), ['#e8a040', '#c8a888', '#d8b0e8', '#e8c060'][i]));
      }
      lit.push(paint(ball(0.3).translate(-6, 4.6, 4.4), '#ffcd75'), paint(ball(0.3).translate(6, 4.6, 4.4), '#ffcd75'));
    },
  },
  warehouse: {
    name: 'Warehouse', quarter: TRADE, hits: 11, size: 6.5, timber: true,
    text: 'Stores goods past what a market keeps.',
    draw(p, lit, c) {
      p.push(paint(block(12, 7, 9).translate(0, 3.5, 0), WOOD), paint(block(12.4, 0.8, 9.4).translate(0, 0.4, 0), c.stone), paint(gable(13, 10, 3.6, 7), c.roof));
      for (const x of [-5.9, -2, 2, 5.9]) p.push(paint(block(0.35, 7, 0.35).translate(x, 3.5, 4.55), DARK));
      p.push(paint(block(4.2, 5, 0.3).translate(0, 2.5, 4.6), DARK), paint(block(0.3, 0.3, 3).translate(0, 8.6, 6), DARK), paint(limb(0.03, 0.03, 3).translate(0, 8.4, 7.3), '#c8b090'));
      for (const [x, z, s] of [[-4.5, 6, 1.4], [-3, 6.3, 1.2], [-3.8, 6.2, 1], [4.4, 6, 1.5], [4.4, 6, 1.1]]) p.push(paint(block(s, s, s).translate(x, s / 2 + (s === 1.1 ? 1.5 : 0), z), '#9a7a4a'));
      lit.push(paint(block(1.2, 1, 0.1).translate(-3.8, 5.5, 4.57), '#ffb45a'));
    },
  },
  guild: {
    name: 'Guild Hall', quarter: CIV, hits: 13, size: 5.5,
    text: 'The crafts’ hall; its masters make the town’s smiths and weavers better.',
    draw(p, lit, c) {
      p.push(paint(block(9, 4, 8).translate(0, 2, 0), c.stone), paint(block(9.8, 3.6, 8.8).translate(0, 5.8, 0), PLASTER), paint(block(10.4, 3.4, 9.4).translate(0, 9.3, 0), PLASTER));
      for (const y of [4.1, 7.6, 11]) p.push(paint(block(10.6, 0.35, 9.6).translate(0, y, 0), DARK));
      for (const x of [-4.8, -1.6, 1.6, 4.8]) p.push(paint(block(0.3, 7, 0.3).translate(x, 7.6, 4.7), DARK));
      p.push(paint(block(0.3, 3.6, 0.3).translate(0, 9.3, 4.72), DARK), paint(gable(11, 10, 5.5, 11.1), c.roof), paint(block(2, 3, 0.3).translate(0, 1.5, 4), DARK));
      p.push(paint(block(0.2, 0.2, 2.4).translate(3.6, 3.4, 5.2), DARK), paint(block(1.6, 1.1, 0.1).translate(3.6, 2.6, 6.4), c.trim), paint(block(0.3, 5, 0.3).translate(-5.4, 13, 0), DARK), paint(block(0.1, 2, 1.6).translate(-5.4, 14.4, 0.9), c.trim));
      for (const x of [-3.2, 3.2]) for (const y of [5.8, 9.3]) lit.push(paint(block(1.2, 1.4, 0.1).translate(x, y, 4.42 + (y > 8 ? 0.3 : 0)), '#ffcd75'));
    },
  },
  treasury: {
    name: 'Treasury', quarter: CIV, hits: 20, size: 5.5,
    text: 'Holds the nation’s gold. Lose it, and soldiers go unpaid.',
    draw(p, lit, c) {
      p.push(paint(block(10, 1, 10).translate(0, 0.5, 0), c.dark), paint(block(8.6, 6, 8.6).translate(0, 4, 0), c.stone), paint(block(9.2, 0.6, 9.2).translate(0, 7.3, 0), c.dark), paint(block(9.4, 0.3, 9.4).translate(0, 6.6, 0), GOLD));
      p.push(paint(cone(6.4, 4.4, 4).rotateY(Math.PI / 4).translate(0, 9.8, 0), c.roof), paint(ball(0.8).translate(0, 12.4, 0), GOLD));
      for (const x of [-2.6, 2.6]) p.push(paint(cyl(0.6, 0.7, 5.6).translate(x, 3.8, 4.8), c.stone), paint(block(1.6, 0.6, 1.6).translate(x, 6.9, 4.8), c.dark));
      p.push(paint(block(3.6, 0.5, 2.4).translate(0, 7, 5), c.dark), paint(block(2.4, 3.6, 0.4).translate(0, 2.8, 4.4), IRON));
      for (const y of [1.6, 2.8, 4]) p.push(paint(block(2.6, 0.12, 0.1).translate(0, y, 4.62), '#6a6a74'));
      lit.push(paint(ball(0.25).translate(0, 2.8, 4.7), GOLD));
      for (const x of [-3.4, 3.4]) lit.push(paint(block(0.3, 1.6, 0.1).translate(x, 4.4, 4.32), '#ffd98a'));
    },
  },
};

// What's left of a building: a heap of its stone, charred beams and a few blocks thrown wide.
function heap(size, c) {
  const parts = [paint(ball(size * 0.7, 1, 0.38, 0.85).translate(0, 0.2, 0), c.dark)], r = size * 0.75;
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39, d = r * (0.1 + ((i * 7) % 10) / 11), w = 0.8 + (i % 4) * 0.35, up = 0.6 + (1 - d / r) * 1.4 + (i % 3) * 0.3;
    parts.push(paint(block(w * 1.5, w * 0.9, w * 1.1).rotateY(a).rotateX((i % 3) * 0.35).rotateZ((i % 2) * 0.3).translate(Math.cos(a) * d, up, Math.sin(a) * d), i % 3 ? c.stone : c.dark));
  }
  // Stubs of the walls, still standing, broken off at uneven heights.
  for (const [x, z, h, turn] of [[-r, -r * 0.4, 3.4, 0], [r * 0.9, r * 0.5, 2.2, 0], [r * 0.2, -r, 2.8, Math.PI / 2]]) {
    parts.push(paint(block(r * 0.9, h, 0.7).rotateY(turn).translate(x, h / 2, z), c.stone), paint(block(r * 0.4, 0.6, 0.72).rotateY(turn).rotateZ(0.4).translate(x + 0.4, h + 0.1, z), c.stone));
  }
  for (let i = 0; i < 5; i++) parts.push(paint(block(0.35, 0.35, r * 1.2).rotateX(0.35 * (i % 2 ? 1 : -1)).rotateY(i * 1.25).translate(Math.cos(i * 1.6) * r * 0.3, 1.4, Math.sin(i * 1.6) * r * 0.3), '#2a1e16'));
  const g = new THREE.Group();
  skin(g, parts, toon(), 0.04);
  return g;
}

// Scaffolding: poles and planks around what's being rebuilt.
function scaffold(size) {
  const parts = [], s = size * 0.95;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s], [0, s], [0, -s], [s, 0], [-s, 0]]) parts.push(paint(limb(0.12, 0.12, 9).translate(x, 9, z), '#a07850'));
  for (const y of [2.5, 5.5, 8.5]) {
    parts.push(paint(block(s * 2, 0.15, 0.9).translate(0, y, s), '#b08858'), paint(block(s * 2, 0.15, 0.9).translate(0, y, -s), '#b08858'), paint(block(0.9, 0.15, s * 2).translate(s, y, 0), '#b08858'), paint(block(0.9, 0.15, s * 2).translate(-s, y, 0), '#b08858'));
  }
  const g = new THREE.Group();
  skin(g, parts, toon(), 0.03);
  return g;
}

export const wantsEstate = (s, kind) => tierOf(s.pop) >= ESTATE_TIER[kind];
export const hasEstate = (s, kind) => wantsEstate(s, kind) && s.ruined?.[kind] === undefined;

export default class Estates {
  constructor(scene, world) {
    Object.assign(this, { scene, world });
    this.alarmAt = new Map();
  }

  get realm() {
    return this.world.realm;
  }

  // Where each building goes: civic ones near the middle, trade toward the road, the army's away from it.
  raise(s, kind) {
    const def = ESTATES[kind], c = STONEWORK[s.owner] ?? STONEWORK.free, toRoad = this.roadward(s);
    const turn = { market: 0, warehouse: 0.55, barracks: Math.PI, armory: Math.PI + 0.6, granary: Math.PI / 2, guild: -0.9, treasury: -Math.PI / 2 }[kind];
    const ring = def.quarter + (s.fixed ? Math.min(80, tierOf(s.pop) * 12) : 0);
    const civic = s.plan?.civic.find((c) => c.kind === kind);
    const [x, z] = civic ? [s.x + civic.x, s.z + civic.z] : ground(toRoad + turn, ring, def.size, this.world.marks.solids, s), y = height(x, z);
    const group = new THREE.Group(), parts = [], lit = [];
    def.draw(parts, lit, c);
    const body = new THREE.Group();
    skin(body, parts, toon(), 0.05);
    shine(body, lit);
    group.add(body);
    const scaf = scaffold(def.size), rubble = heap(def.size, c);
    scaf.visible = rubble.visible = false;
    group.add(scaf, rubble);
    group.position.set(x, y, z);
    group.rotation.y = Math.atan2(s.x - x, s.z - z);
    this.scene.add(group);
    const solid = { x, z, r: def.size * 0.7 };
    this.world.marks.solids.push(solid);
    const e = { kind, def, group: body, root: group, scaf, rubble, solid, x, y, z, hp: null, age: null, place: s };
    voxelWorld()?.adopt(e, body, parts, lit);
    return e;
  }

  roadward(s) {
    let best = 0, bestD = 1e9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283, d = roadDistance(s.x + Math.cos(a) * 60, s.z + Math.sin(a) * 60);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  build(s) {
    s.estates ??= [];
    for (const kind of Object.keys(ESTATES)) {
      if (wantsEstate(s, kind) && !s.estates.some((e) => e.kind === kind)) s.estates.push(this.raise(s, kind));
    }
  }

  forget(s) {
    for (const e of s.estates ?? []) {
      voxelWorld()?.forget(e);
      this.scene.remove(e.root);
      const i = this.world.marks.solids.indexOf(e.solid);
      if (i >= 0) this.world.marks.solids.splice(i, 1);
    }
    s.estates = null;
  }

  // Ruins stay down; what's being rebuilt rises inside its scaffolding.
  show(e) {
    const ruin = e.place.ruined?.[e.kind];
    if (ruin === undefined) {
      if (e.age !== null) Object.assign(e, { age: null, hp: null, fallen: false });
      if (e.vox?.left === 0) voxelWorld().mend(e);
      e.group.visible = true;
      e.group.scale.y = 1;
      e.group.position.y = 0;
      e.group.rotation.x = e.group.rotation.z = 0;
      e.scaf.visible = e.rubble.visible = false;
      e.solid.off = false;
      return;
    }
    e.scaf.visible = ruin > 0;
    e.rubble.visible = ruin < 0.6;
    e.solid.off = ruin < 0.5;
    if (e.age === null || e.age > 2) {
      e.age ??= 9;
      if (ruin > 0 && e.vox?.left === 0) voxelWorld().mend(e); // what rises in the scaffolding is whole
      e.group.visible = ruin > 0;
      e.group.position.y = -(1 - Math.max(0, ruin)) * RISE; // it goes up from its footings, inside the scaffolding
      e.group.rotation.x = 0;
      e.group.scale.y = 1;
    }
  }

  update(dt) {
    const { players } = this.world;
    for (const s of this.realm.settlements) {
      const near = players.reduce((m, p) => Math.min(m, Math.hypot(p.state.x - s.x, p.state.z - s.z)), 1e9);
      if (near < SHOW && s.stock) this.build(s);
      else if (near > DROP && s.estates) this.forget(s);
      if (!s.estates) continue;
      settleWorks({ works: s.estates.filter((e) => e.age !== null && e.age < 2) }, dt);
      for (const e of s.estates) if (e.age === null || e.age >= 2) this.show(e);
    }
  }

  // ---- harm ----
  struck(x, z, reach, force, p) {
    for (const s of this.realm.settlements) {
      if (!s.estates || Math.hypot(s.x - x, s.z - z) > reach + 140) continue;
      for (const e of s.estates) {
        if (e.age !== null || s.ruined?.[e.kind] !== undefined || Math.hypot(e.x - x, e.z - z) > reach + e.def.size) continue;
        this.alarm(s, p);
        e.hp ??= e.def.hits * BLOW * p.body.might ** GROWTH_KEPT;
        if (strike(e, force * p.nature.demolition, p, this.world.fx, this.world.work.burst.bind(this.world.work), { x, z, reach })) this.fall(s, e, p);
        else e.maxHp ??= e.hp;
      }
    }
  }

  // Fire on the ground eats the timber ones.
  scorch(x, z, force, p) {
    for (const s of this.realm.settlements) {
      if (!s.estates || Math.hypot(s.x - x, s.z - z) > 150) continue;
      for (const e of s.estates) {
        if (!e.def.timber || e.age !== null || s.ruined?.[e.kind] !== undefined || Math.hypot(e.x - x, e.z - z) > e.def.size + 2) continue;
        e.hp ??= e.def.hits * BLOW * p.body.might ** GROWTH_KEPT;
        if (strike(e, force, p, this.world.fx, () => {}, { x, z, reach: 1, fire: true })) this.fall(s, e, p);
      }
    }
  }

  // A nation's town calls its guards when its buildings are attacked.
  alarm(s, p) {
    const n = NATIONS.find((a) => a.id === s.owner);
    if (!n || this.world.nations.isFallen(n) || (this.alarmAt.get(s) ?? -1e9) > this.realm.time - ALARM) return;
    this.alarmAt.set(s, this.realm.time);
    this.realm.warband(p, n, DEFENDERS + Math.min(3, tierOf(s.pop) - 2), 30);
    p.hud.message(`${s.name} calls its guards!`, true);
  }

  // What each building's fall costs the place and the nation that holds it.
  fall(s, e, p) {
    s.ruined ??= {};
    s.ruined[e.kind] = -REBUILD.wait / REBUILD.days; // the nation mourns a day before it builds
    const n = this.realm.nations[s.owner], nation = NATIONS.find((a) => a.id === s.owner), econ = this.realm.economy;
    let what = '';
    if (e.kind === 'treasury' && n) {
      const share = n.gold * (s.pop / Math.max(1, this.realm.people(s.owner))), coin = Math.round(share * LOOT_SHARE);
      n.gold = Math.max(0, n.gold - share);
      p.bag.gold += coin;
      what = `${coin} gold is yours; ${nation.name}'s soldiers may go unpaid.`;
    } else if (e.kind === 'armory') {
      const took = p.bag.add('arms', Math.floor(s.stock.arms * 0.5));
      s.stock.arms = 0;
      what = `Its arms are scattered${took ? `; you carry off ${took}` : ''}.`;
    } else if (e.kind === 'barracks' && n) {
      const lost = Math.round(n.troops * GARRISON_LOST * Math.min(1, s.pop / 300));
      n.troops = Math.max(0, n.troops - lost);
      what = `${lost} soldiers die in the ruins.`;
    } else if (e.kind === 'granary') {
      for (const g of ['grain', 'fish', 'meat']) s.stock[g] *= 0.15;
      s.reserve = 0;
      what = 'Its food burns. Hunger will follow.';
    } else if (e.kind === 'market') {
      s.prosperity = Math.max(0, s.prosperity - 0.15);
      what = 'Trade there falters.';
    } else if (e.kind === 'warehouse') {
      for (const g of Object.keys(s.stock)) if (!['grain', 'fish', 'meat'].includes(g)) s.stock[g] *= 0.5;
      what = 'Half its goods are lost.';
    } else if (e.kind === 'guild') what = 'Its crafts lose their masters.';
    for (const g of Object.keys(s.stock)) s.price[g] = econ.priceOf(s, g);
    p.bag.save();
    if (n) n.grudge = (n.grudge ?? 0) + 1.5;
    this.realm.say(`You destroyed the ${e.def.name.toLowerCase()} of ${s.name}. ${what}`, nation?.color ?? '#e8ddc8');
    p.hud.message(`${e.def.name} of ${s.name} destroyed. ${what}`, true, 3000);
  }

  // ---- rebuilding: a nation pays gold a day, and the place's own timber and stone ----
  rebuild(days) {
    for (const s of this.realm.settlements) {
      if (!s.ruined || !s.stock) continue;
      const n = this.realm.nations[s.owner];
      for (const kind of Object.keys(s.ruined)) {
        if (s.ruined[kind] < 0) {
          s.ruined[kind] += days / REBUILD.days;
          break;
        }
        // Timber and stone from the place's own market; a nation with gold buys in what's short.
        const short = ['wood', 'stone'].reduce((sum, g) => sum + Math.max(0, REBUILD[g] * days - s.stock[g]) * s.price[g] * BUY_IN, 0);
        if (n ? n.gold < REBUILD.gold * days + short : short > 0) continue;
        if (n) n.gold -= REBUILD.gold * days + short;
        for (const g of ['wood', 'stone']) s.stock[g] = Math.max(0, s.stock[g] - REBUILD[g] * days);
        s.ruined[kind] += days / REBUILD.days;
        if (s.ruined[kind] >= 1) {
          delete s.ruined[kind];
          this.realm.say(`${s.name} has rebuilt its ${ESTATES[kind].name.toLowerCase()}.`, NATIONS.find((a) => a.id === s.owner)?.color ?? '#e8ddc8', s.x, s.z);
        }
        break; // one at a time
      }
      if (!Object.keys(s.ruined).length) delete s.ruined;
    }
  }

  // For signs: what stands, and what's down.
  report(s) {
    const kinds = Object.keys(ESTATES).filter((k) => wantsEstate(s, k));
    return { up: kinds.filter((k) => hasEstate(s, k)).map((k) => ESTATES[k].name), down: kinds.filter((k) => !hasEstate(s, k)).map((k) => `${ESTATES[k].name} ${s.ruined[k] > 0.01 ? `rebuilding ${Math.round(s.ruined[k] * 100)}%` : 'in ruins'}`), tier: TIERS[tierOf(s.pop)].name };
  }
}

