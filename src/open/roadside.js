import * as THREE from 'three';
import { height } from './terrain.js';
import { WORKS, roadsidePlaces } from './roadsidePlan.js';
import { placeHouse } from './landmarks.js';
import { VoxelBuilder } from '../render/voxel.js';
import { masonry } from './materials.js';
import { makeFigure } from './figures.js';
import { LOOKS } from '../art/looks.js';
import { walkPose } from '../render/models.js';
import { GOODS } from './economy.js';
import { itemOf } from './caravans.js';
import { nationAt } from './nations.js';
import { showPlace } from './compass.js';

// The country between the towns (phase 7, docs/world-upgrade-plan.md): places that are about
// living, not fighting. Inns stand along the roads like coaching inns did, a day's stage apart,
// with food, a bed and talk; waystations with a well sit between them; toll houses bar the
// bridges; and out in the country mills, quarries, lumber camps and mines make the goods the
// towns live on. Every place is worked out from the roads and the land, so it's the same each
// time, and each has someone to talk to.
const NEAR = 200, TALK = 7;                // tiles: keepers shown, and close enough to talk
const SCALE = 2.3;                         // people, as in towns
const ROOM = 10, MEAL = 3, WELL_WAIT = 90;  // gold for a bed and a meal; seconds before a well refreshes again
const TOLL_OPEN = 120, TOLL_BROKEN = 300;  // seconds a paid barrier stays up, and a broken one stays down
const WORK_STOCK = 20, WORK_REFILL = 18, WORK_PRICE = 0.6; // goods held, seconds per new one, share of town prices

// ---- how each place looks ----
const WOOD = '#7a5232', DARK = '#4a3020', STONE = '#9a8e88', THATCH = '#c9a654';

function tables(b, x, y, z) {
  b.box(x, y + 1, z, 3, 0.25, 1.4, WOOD, 0.05);
  for (const s of [-1, 1]) b.box(x, y + 0.5, z + s * 1.4, 3, 0.2, 0.5, DARK, 0.05);
  b.box(x, y + 0.5, z, 0.3, 1, 0.3, DARK);
}

function lantern(b, x, y, z) {
  b.box(x, y + 2.2, z, 0.3, 4.4, 0.3, DARK).box(x, y + 4.7, z, 0.8, 0.8, 0.8, '#ffd98a', 0);
}

// The fixed parts of a place go into one builder; its moving parts (wheel, sails) are returned.
function dress(b, p, out) {
  const { x, z, y } = p, fx = Math.sin(p.face), fz = Math.cos(p.face), sx = fz, sz = -fx;
  const at = (f, s) => [x + fx * f + sx * s, z + fz * f + sz * s];
  if (p.kind === 'inn') {
    for (const [f, s] of [[10, -6], [12, 5]]) tables(b, ...[at(f, s)[0], y, at(f, s)[1]]);
    const [lx, lz] = at(9, 10), [hx, hz] = at(5, -14);
    lantern(b, lx, y, lz);
    // The sign on its post, and a hitching rail by the stable.
    b.box(lx, y + 3.4, lz + 1, 0.15, 1.4, 2, '#b13e53', 0.03);
    b.box(hx, y + 1.1, hz, 0.25, 0.25, 6, WOOD).box(hx, y + 0.55, hz - 3, 0.3, 1.1, 0.3, DARK).box(hx, y + 0.55, hz + 3, 0.3, 1.1, 0.3, DARK);
    for (let i = 0; i < 4; i++) b.box(hx + 1.5, y + 0.4 + (i % 2) * 0.5, hz - 2 + i, 0.9, 0.5, 0.9, THATCH, 0.08);
  } else if (p.kind === 'stop') {
    b.box(x, y + 0.6, z, 4, 1.2, 4, STONE, 0.06).box(x, y + 1.25, z, 2.8, 0.1, 2.8, '#3f8fb0', 0);
    for (const [dx, dz] of [[-1.8, 0], [1.8, 0]]) b.box(x + dx, y + 2.6, z + dz, 0.35, 3.6, 0.35, WOOD);
    b.box(x, y + 4.6, z, 5, 0.4, 3, THATCH, 0.05).box(x, y + 3.6, z, 3.4, 0.15, 0.15, DARK);
    const [mx, mz] = at(-3, 5);
    b.box(mx, y + 0.9, mz, 0.9, 1.8, 0.5, '#c9bcc4', 0.05);
    const [bx, bz] = at(3, -4);
    b.box(bx, y + 0.5, bz, 3.2, 0.25, 0.8, WOOD).box(bx - 1.3, y + 0.25, bz, 0.3, 0.5, 0.6, DARK).box(bx + 1.3, y + 0.25, bz, 0.3, 0.5, 0.6, DARK);
    lantern(b, ...[at(-4, -3)[0], y, at(-4, -3)[1]]);
  } else if (p.kind === 'toll') {
    // Striped barrier across the road on two posts.
    const [rx, rz] = p.road, ax = Math.cos(p.along), az = -Math.sin(p.along);
    for (const s of [-6, 6]) b.box(rx + ax * s, height(rx, rz) + 1, rz + az * s, 0.6, 2, 0.6, DARK);
    const bar = new VoxelBuilder();
    for (let i = -5; i <= 5; i++) bar.box(i * 1.1, 0, 0, 1.1, 0.35, 0.35, i % 2 ? '#e8e0d0' : '#c0392b', 0);
    const pole = new THREE.Mesh(bar.build(), masonry());
    pole.position.set(rx, height(rx, rz) + 1.9, rz);
    pole.rotation.y = Math.atan2(ax, az) - Math.PI / 2;
    out.push({ mesh: pole, kind: 'bar' });
  } else if (p.kind === 'watermill' || p.kind === 'lumber' || p.kind === 'mine' || p.kind === 'quarry') {
    const [px, pz] = at(-9, 0);
    if (p.kind === 'watermill') {
      const wheel = new VoxelBuilder();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283;
        wheel.box(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0, 1.4, 1.4, 1.2, WOOD, 0.05);
      }
      wheel.box(0, 0, 0, 0.8, 0.8, 1.6, DARK);
      const m = new THREE.Mesh(wheel.build(), masonry());
      const [wx, wz] = at(0, -5.5);
      m.position.set(wx, y + 2.8, wz);
      m.rotation.y = p.face + Math.PI / 2;
      out.push({ mesh: m, kind: 'wheel' });
    } else if (p.kind === 'lumber') {
      for (let i = 0; i < 6; i++) b.box(px + (i % 3) * 1.2, y + 0.6 + Math.floor(i / 3) * 1.1, pz, 1.1, 1.1, 6, '#8a6040', 0.06);
      b.box(px + 5, y + 0.6, pz + 3, 2.4, 1.2, 0.4, DARK).box(px + 5, y + 1.2, pz + 3, 3, 0.2, 0.2, '#c9c0b0');
    } else if (p.kind === 'mine') {
      b.box(px, y + 2.2, pz, 6, 4.4, 2, '#4a4048', 0.1).box(px, y + 1.7, pz + 1.05, 2.6, 3.4, 0.1, '#0c0a12', 0);
      for (const s of [-1.5, 1.5]) b.box(px + s, y + 1.8, pz + 1.2, 0.4, 3.6, 0.4, WOOD);
      b.box(px, y + 3.7, pz + 1.2, 3.8, 0.4, 0.5, WOOD).box(px + 3.5, y + 0.6, pz + 3, 1.6, 1, 1.1, DARK).box(px + 3.5, y + 1.2, pz + 3, 1.4, 0.4, 0.9, '#b07a50', 0.1);
    } else {
      for (let i = 0; i < 7; i++) b.box(px + (i % 4) * 1.8 - 3, y + 0.7 + Math.floor(i / 4) * 1.3, pz + (i % 2), 1.6, 1.3, 1.6, '#c9bcc4', 0.06);
      b.box(px + 4, y + 3, pz - 2, 0.4, 6, 0.4, WOOD).box(px + 2.5, y + 5.8, pz - 2, 3.4, 0.3, 0.3, WOOD);
    }
  } else if (p.kind === 'windmill') {
    // A round-ish tower and four sails turning in the wind.
    for (let i = 0; i < 6; i++) b.box(x, y + 1.5 + i * 2.6, z, 6 - i * 0.55, 2.6, 6 - i * 0.55, i % 2 ? '#e8ddc8' : '#d8ccb6', 0.04);
    b.box(x, y + 17.2, z, 3.6, 2, 3.6, THATCH, 0.05).box(x + Math.sin(p.face) * 3, y + 2, z + Math.cos(p.face) * 3, 1.6, 3, 0.2, DARK);
    const sails = new VoxelBuilder();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.283;
      for (let k = 1; k <= 6; k++) sails.box(Math.cos(a) * k * 1.4, Math.sin(a) * k * 1.4, 0, k > 2 ? 1.6 : 0.4, k > 2 ? 1.6 : 0.4, 0.15, k > 2 ? '#efe6d6' : WOOD, 0);
    }
    const m = new THREE.Mesh(sails.build(), masonry());
    m.position.set(x + Math.sin(p.face) * 2.2, y + 15, z + Math.cos(p.face) * 2.2);
    m.rotation.y = p.face;
    out.push({ mesh: m, kind: 'sails' });
  }
}

// The house each place has, if any: its type in cityPlan.js and where it stands.
const HOUSES = { inn: 'inn', stop: null, toll: 'cottage', watermill: 'workshop', windmill: null, quarry: 'cottage', lumber: 'cottage', mine: 'cottage' };

export default class Roadside {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = roadsidePlaces();
    this.moving = [];
    const b = new VoxelBuilder();
    for (const p of this.list) {
      const type = HOUSES[p.kind];
      if (type) {
        placeHouse(scene, world.marks, `road-${p.name}`, p.x, p.z, p.face, null, type, 'roadside');
        p.house = world.marks.houses.at(-1);
        if (p.kind === 'inn') {
          // The stable beside it.
          const sx = p.x + Math.cos(p.face) * 15, sz = p.z - Math.sin(p.face) * 15;
          placeHouse(scene, world.marks, `stable-${p.name}`, sx, sz, p.face, null, 'barn', 'roadside');
        }
      }
      const parts = [];
      dress(b, p, parts);
      for (const m of parts) {
        m.mesh.castShadow = true;
        scene.add(m.mesh);
        this.moving.push({ ...m, p });
      }
      if (p.kind === 'toll') {
        // The barrier stops the hero until the toll is paid (or the bar is broken).
        const [rx, rz] = p.road, ax = Math.cos(p.along), az = -Math.sin(p.along);
        p.bar = [-4, 0, 4].map((s) => ({ x: rx + ax * s, z: rz + az * s, r: 2.2, fence: true }));
        world.marks.solids.push(...p.bar);
        p.open = 0;
      }
      if (WORKS[p.kind]) p.stock = WORK_STOCK / 2;
      if (p.kind === 'inn' || p.kind === 'toll' || WORKS[p.kind]) showPlace(p);
    }
    const mesh = new THREE.Mesh(b.build(), masonry());
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    this.t = 0;
  }

  // The keeper of a place stands by its door while a hero is near.
  keeper(p) {
    const look = p.kind === 'inn' ? LOOKS.merchant : p.kind === 'toll' ? LOOKS.guard : p.kind === 'stop' ? LOOKS.elder : LOOKS[WORKS[p.kind]?.look] ?? LOOKS.smith;
    const model = makeFigure(look), door = p.house?.door ?? { x: p.x + Math.sin(p.face) * 4, z: p.z + Math.cos(p.face) * 4 };
    const x = door.x + Math.sin(p.face) * 2, z = door.z + Math.cos(p.face) * 2;
    model.group.position.set(x, height(x, z), z);
    model.group.rotation.y = p.face;
    model.group.scale.setScalar(SCALE);
    this.scene.add(model.group);
    p.model = model;
  }

  update(dt) {
    this.t += dt;
    const { players } = this.world;
    for (const m of this.moving) {
      if (m.kind === 'wheel') m.mesh.rotation.z -= dt * 0.8;
      else if (m.kind === 'sails') m.mesh.rotation.z += dt * 0.5;
      else if (m.kind === 'bar') {
        const up = m.p.open > 0 || m.p.broken > 0;
        m.mesh.rotation.x += ((up ? -1.3 : 0) - m.mesh.rotation.x) * Math.min(1, dt * 3);
        m.mesh.visible = !(m.p.broken > 0);
      }
    }
    for (const p of this.list) {
      const near = players.some((h) => Math.hypot(h.state.x - p.x, h.state.z - p.z) < NEAR);
      if (near && !p.model && !this.ruined(p)) this.keeper(p);
      else if ((!near || this.ruined(p)) && p.model) {
        this.scene.remove(p.model.group);
        p.model = null;
      }
      if (p.model) {
        const friend = players.find((h) => Math.hypot(h.state.x - p.model.group.position.x, h.state.z - p.model.group.position.z) < TALK * 2);
        if (friend) p.model.group.rotation.y = Math.atan2(friend.state.x - p.model.group.position.x, friend.state.z - p.model.group.position.z);
        walkPose(p.model, this.t * 2, 0);
      }
      if (p.kind === 'toll') {
        p.open = Math.max(0, p.open - dt);
        p.broken = Math.max(0, (p.broken ?? 0) - dt);
        for (const s of p.bar) s.off = p.open > 0 || p.broken > 0;
      }
      if (WORKS[p.kind] && !this.ruined(p)) p.stock = Math.min(WORK_STOCK, p.stock + dt / WORK_REFILL);
      p.well = Math.max(0, (p.well ?? 0) - dt);
    }
  }

  // A place whose house has been wrecked does no business.
  ruined(p) {
    return !!p.house?.solid.off;
  }

  // The nearest town's market: prices, and where goods go.
  market(p) {
    const places = this.world.realm?.settlements ?? [];
    return places.reduce((best, s) => (!best || Math.hypot(s.x - p.x, s.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z) ? s : best), null);
  }

  nearest(h, reach = TALK + 6) {
    let best = null, bd = reach;
    for (const p of this.list) {
      const at = p.model?.group.position ?? (p.kind === 'stop' ? p : null);
      if (!at) continue;
      const d = Math.hypot(h.state.x - at.x, h.state.z - at.z);
      if (d < bd) {
        best = p;
        bd = d;
      }
    }
    return best;
  }

  // What the Cross button does here.
  spot(h) {
    if (h.state.air > 2) return null;
    const p = this.nearest(h);
    if (!p) return null;
    if (p.kind === 'inn') return { label: `Talk to the keeper of ${p.name}`, menu: () => this.inn(h, p) };
    if (p.kind === 'stop') return p.well > 0 ? null : { label: 'Drink from the well', act: () => this.drink(h, p) };
    if (p.kind === 'toll') {
      const fee = this.fee(p);
      return p.open > 0 || p.broken > 0 ? null : { label: `Pay the toll (${fee} gold)`, act: () => this.pay(h, p, fee) };
    }
    return { label: `Talk to the ${WORKS[p.kind].name.toLowerCase()}'s keeper`, menu: () => this.work(h, p) };
  }

  inn(h, p) {
    const { hud, bag } = h, rows = [];
    rows.push({ label: `Take a room for the night: ${ROOM} gold, wake healed`, done: true, act: () => {
      if (bag.gold < ROOM) return hud.message('You can\'t afford a room.');
      bag.gold -= ROOM;
      bag.save();
      h.use({ action: 'rest' });
      return undefined;
    } });
    rows.push({ label: `A hot meal: ${MEAL} gold, heals you halfway`, act: () => {
      if (bag.gold < MEAL) return hud.message('Not enough for a meal.');
      bag.gold -= MEAL;
      bag.save();
      h.hp = Math.min(h.body.maxHealth, h.hp + h.body.maxHealth * 0.5);
      hud.setHealth(h.hp / h.body.maxHealth);
      hud.message('Stew, bread and a jug of ale. You feel better.');
      return undefined;
    } });
    rows.push({ label: 'Ask what travellers have been saying', act: () => hud.message(this.rumour(h, p)) });
    const animals = this.world.animals;
    if (animals) rows.push({ label: `Buy a saddled horse from the stable: ${animals.price} gold${animals.steed ? ' (your own goes back to the wild)' : ''}`, done: true, act: () => animals.buy(h) });
    const town = this.market(p);
    if (town) rows.push({ label: `Trade (prices as in ${town.name})`, act: () => h.market.open({ place: town }) });
    rows.push({ label: 'Leave', done: true, act: () => {} });
    return { title: p.name, sub: `A coaching inn on the road · ${nationAt(p.x, p.z)?.name ?? 'Free land'}`, rows };
  }

  // Talk at an inn: a fair, something happening on the roads, a place worth finding, or the news.
  rumour(h, p) {
    const say = [], w = this.world, dir = (x, z) => {
      const a = Math.atan2(x - p.x, -(z - p.z)), names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
      return names[(Math.round(a / (Math.PI / 4)) + 8) % 8];
    };
    const fair = w.fairs?.coming();
    if (fair) say.push(fair);
    const ev = w.events?.active[0];
    if (ev) say.push(`Folk on the road talk of ${ev.rumour}, ${Math.round(Math.hypot(ev.x - p.x, ev.z - p.z) / 100) * 100} m ${dir(ev.x, ev.z)} of here.`);
    const site = w.sites.list.filter((s) => !s.done && !s.cat.built).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[Math.floor(Math.random() * 3)];
    if (site) say.push(`A traveller swears there's a ${site.cat.name} ${Math.round(Math.hypot(site.x - p.x, site.z - p.z) / 100) * 100} m ${dir(site.x, site.z)} of here.`);
    const news = w.realm?.news?.[0];
    if (news) say.push(`The talk at the bar: ${news.text}`);
    return say.length ? say[Math.floor(Math.random() * say.length)] : 'Quiet times. Nothing worth repeating.';
  }

  drink(h, p) {
    p.well = WELL_WAIT;
    h.hp = Math.min(h.body.maxHealth, h.hp + h.body.maxHealth * 0.35);
    h.hud.setHealth(h.hp / h.body.maxHealth);
    h.hud.message(`Cold water from the well at ${p.name}. You feel rested.`);
  }

  fee(p) {
    const n = nationAt(p.x, p.z);
    return 3 + Math.round((n?.level ?? 1) * 0.2);
  }

  pay(h, p, fee) {
    const { bag, hud } = h;
    if (bag.gold < fee) return hud.message(`The keeper won't lift the bar for less than ${fee} gold.`);
    bag.gold -= fee;
    bag.save();
    p.open = TOLL_OPEN;
    hud.message(`You pay ${fee} gold and the keeper lifts the bar.`);
    return undefined;
  }

  // A working place sells what it makes cheaper than the towns.
  work(h, p) {
    const w = WORKS[p.kind], good = w.good, town = this.market(p), item = itemOf(good);
    const price = Math.max(1, Math.round((town?.price?.[good] ?? GOODS[good].base) * WORK_PRICE));
    const buy = (n) => () => {
      const { bag, hud } = h;
      let got = 0;
      while (got < n && p.stock >= 1 && bag.gold >= price && bag.add(item, 1)) {
        bag.gold -= price;
        p.stock -= 1;
        got++;
      }
      bag.save();
      hud.message(got ? `${got} ${GOODS[good].name.toLowerCase()} for ${got * price} gold.` : p.stock < 1 ? 'Nothing ready yet. Come back later.' : bag.gold < price ? "You can't afford it." :'You can carry no more.');
    };
    return {
      title: p.name,
      sub: `${GOODS[good].name}, ${Math.floor(p.stock)} ready · ${price} gold each${town ? ` (${town.name} pays ${Math.round(town.price[good])})` : ''}`,
      rows: [
        { label: `Buy 1 ${GOODS[good].name.toLowerCase()}`, act: buy(1) },
        { label: `Buy 5 ${GOODS[good].name.toLowerCase()}`, act: buy(5) },
        { label: 'Leave', done: true, act: () => {} },
      ],
    };
  }

  // A blow near a toll bar breaks it; the keeper's lord remembers.
  struck(x, z, reach, force, hero) {
    for (const p of this.list) {
      if (p.kind !== 'toll' || p.broken > 0) continue;
      if (p.bar.some((s) => Math.hypot(s.x - x, s.z - z) < reach + s.r)) {
        p.broken = TOLL_BROKEN;
        const n = nationAt(p.x, p.z);
        if (n && this.world.realm?.of?.(n.id)) this.world.realm.of(n.id).grudge = (this.world.realm.of(n.id).grudge ?? 0) + 1;
        hero?.hud.message(`You smash the bar at ${p.name}.${n ? ` ${n.name} won't forget it.` : ''}`);
        this.world.work.burst(p.road[0], height(...p.road) + 2, p.road[1], ['#c0392b', '#e8e0d0', '#4a3020'], 12, 6);
      }
    }
    void force;
  }
}
