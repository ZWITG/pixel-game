import * as THREE from 'three';
import { height, TOWNS } from './terrain.js';
import { toon, paint, ball, limb, block, skin } from './kit.js';
import { makeFigure } from './figures.js';
import { walkPose } from '../render/models.js';
import { LOOKS } from '../art/looks.js';
import { NATIONS } from './nations.js';
import { DOCTRINES } from './doctrines.js';
import { GOODS, LOADS } from './economy.js';
import { FERRY_DEPTH } from './roads.js';
import { ITEMS } from './items.js';
import { tierOf } from './settlements.js';

// The traders on the roads, made real near a hero: wagons, beasts, drivers and guards moving at
// the pace the economy says. A hero can trade with them, squeeze them for a toll (the old
// Danegeld: paid so you don't burn them), guard them for pay, or take everything. Bandit camps
// near a road prey on them, so breaking a camp makes the road safe. Far from every hero they
// stay numbers in economy.js.
const VIEW = 420, FORGET = 520;  // tiles: wagons appear and go
const MOST_SHOWN = 8;
const SCALE = 2.1;               // people and beasts, to match the townsfolk
const TALK = 9;                  // tiles from a wagon to speak to its people
const HITS = 5, BLOW = 1.3, GROWTH_KEPT = 0.85; // a wagon takes this many blows of a hero's might
const PURSE = 0.35;              // of a load's worth in coin a merchant carries, and loses if robbed
const TOLL = 0.2;                // of a load's worth paid to make a hero go away
const ESCORT_PAY = 0.12, ESCORT_PER_TILE = 0.01, ESCORT_LEASH = 230;
const ESCORT_TROUBLE = 280;      // tiles of road, at most, before trouble finds an escorted wagon
const THANKS = 0.08;             // of a load's worth given to whoever drives off its attackers
const BANDIT_REACH = 280;        // tiles from a bandit camp that a road is dangerous
const AMBUSH = [0.5, 0.3, 0.14]; // chance a passing peddler, cart or caravan is set on
const AMBUSH_HOLD = 60;          // seconds a halted wagon waits for rescue before it's taken
const GUARDS = { Peddler: 0, Cart: 1, Caravan: 3, 'Supply train': 4 };
const GRUDGE = 1;                // how much a robbed nation holds it against you (realm threat)
const BEASTS = { Peddler: ['mule', 1], Cart: ['ox', 1], Caravan: ['horse', 2], 'Supply train': ['horse', 2] };
const COATS = { horse: ['#7a5232', '#4a3020'], ox: ['#8a6a50', '#e8dcc8'], mule: ['#6a5e58', '#3a3230'] };

const ownerColor = (id) => NATIONS.find((n) => n.id === id)?.color ?? '#e8ddc8';
export const itemOf = (g) => (g === 'ore' ? 'iron' : g);

// A beast in harness: body, neck, head, and four legs that swing as it walks.
function beast(kind) {
  const [coat, dark] = COATS[kind], mat = toon(), group = new THREE.Group(), big = kind === 'ox' ? 1.15 : kind === 'mule' ? 0.85 : 1;
  const parts = [paint(ball(0.62, 1, 0.9, 1.6).translate(0, 1.55, 0), coat), paint(limb(0.28, 0.36, 1.1).rotateX(-0.7).translate(0, 2.3, 0.95), coat), paint(ball(0.3, 0.9, 0.9, 1.5).translate(0, 2.65, 1.45), coat)];
  if (kind === 'ox') parts.push(paint(limb(0.06, 0.1, 0.9).rotateZ(1.2).translate(0.45, 2.8, 1.3), '#e8dcc8'), paint(limb(0.06, 0.1, 0.9).rotateZ(-1.2).translate(-0.45, 2.8, 1.3), '#e8dcc8'));
  else parts.push(paint(block(0.12, 0.5, 0.9).translate(0, 2.55, 0.6), dark), paint(limb(0.05, 0.14, 0.9).rotateX(0.5).translate(0, 1.7, -1.05), dark));
  if (kind === 'mule') parts.push(paint(limb(0.05, 0.08, 0.5).rotateZ(0.3).translate(0.12, 3.05, 1.3), coat), paint(limb(0.05, 0.08, 0.5).rotateZ(-0.3).translate(-0.12, 3.05, 1.3), coat));
  skin(group, parts, mat, 0.04);
  const legs = [[0.32, 0.65], [-0.32, 0.65], [0.32, -0.65], [-0.32, -0.65]].map(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, 1.3, z);
    skin(leg, [paint(limb(0.13, 0.1, 1.3), coat), paint(block(0.22, 0.18, 0.26).translate(0, -1.32, 0.03), dark)], mat, 0.03);
    group.add(leg);
    return leg;
  });
  group.scale.setScalar(big * SCALE * 0.62);
  return { group, legs };
}

// A wagon: bed, wheels, a cover in its owner's colour, and its load showing under it.
function wagon(kind, good, owner) {
  const mat = toon(), group = new THREE.Group(), long = kind === 'Peddler' ? 0 : 1, wood = '#7a5230', dark = '#4e3220';
  if (!long) return { group, wheels: [] }; // a peddler walks; the mule carries the load
  const parts = [paint(block(2.6, 0.35, 4.8).translate(0, 1.5, 0), wood), paint(block(0.15, 0.7, 4.8).translate(1.25, 1.95, 0), dark), paint(block(0.15, 0.7, 4.8).translate(-1.25, 1.95, 0), dark), paint(block(2.6, 0.7, 0.15).translate(0, 1.95, -2.35), dark), paint(block(0.12, 0.12, 2.6).translate(0.5, 1.4, 3.6), dark), paint(block(0.12, 0.12, 2.6).translate(-0.5, 1.4, 3.6), dark), paint(block(1.4, 0.25, 0.6).translate(0, 2.2, 2.2), wood)];
  const color = GOODS[good]?.color ?? '#c8b090';
  for (let i = 0; i < 6; i++) parts.push(paint(ball(0.5, 1, 0.8, 1).translate((i % 2 ? 0.55 : -0.55), 2.1, -1.6 + Math.floor(i / 2) * 1.05), color));
  if (kind !== 'Cart') {
    const cover = new THREE.CylinderGeometry(1.45, 1.45, 4.2, 14, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 2.3, -0.2);
    parts.push(paint(cover, ownerColor(owner)));
  }
  skin(group, parts, mat, 0.05);
  const wheels = [[1.45, 1.4], [-1.45, 1.4], [1.45, -1.5], [-1.45, -1.5]].map(([x, z]) => {
    const w = new THREE.Group();
    w.position.set(x, 1.05, z);
    skin(w, [paint(new THREE.CylinderGeometry(1, 1, 0.22, 14).rotateZ(Math.PI / 2), dark), paint(block(0.24, 1.8, 0.16), wood), paint(block(0.24, 0.16, 1.8), wood)], mat, 0.04);
    group.add(w);
    return w;
  });
  group.scale.setScalar(SCALE * 0.62);
  return { group, wheels };
}

export default class Caravans {
  constructor(scene, world) {
    Object.assign(this, { scene, world });
    this.views = new Map();
    const econ = world.realm.economy;
    econ.arrived = (r) => this.arrived(r);
    econ.lost = (r) => this.drop(r);
  }

  get economy() {
    return this.world.realm.economy;
  }

  // ---- what you see ----
  show(r) {
    const team = BEASTS[r.kind] ?? BEASTS.Cart, root = new THREE.Group(), cart = wagon(r.kind, r.good, r.owner);
    root.add(cart.group);
    const beasts = [];
    for (let i = 0; i < team[1]; i++) {
      const b = beast(team[0]);
      b.group.position.set(team[1] > 1 ? (i ? -0.9 : 0.9) : 0, 0, cart.wheels.length ? 4.9 : 0);
      if (!cart.wheels.length) {
        // A peddler's mule carries the load in two packs.
        const pack = new THREE.Group();
        skin(pack, [paint(ball(0.42, 1, 1, 1.2).translate(0.55, 1.75, -0.2), GOODS[r.good]?.color ?? '#c8b090'), paint(ball(0.42, 1, 1, 1.2).translate(-0.55, 1.75, -0.2), GOODS[r.good]?.color ?? '#c8b090')], toon(), 0.04);
        b.group.add(pack);
      }
      root.add(b.group);
      beasts.push(b);
    }
    const driver = makeFigure(r.supply ? LOOKS.guard : LOOKS.merchant);
    driver.group.scale.setScalar(SCALE);
    driver.group.position.set(0, cart.wheels.length ? 1.25 : 0, cart.wheels.length ? 1.6 : 2.4);
    root.add(driver.group);
    const guards = [];
    for (let i = 0; i < (GUARDS[r.kind] ?? 0); i++) {
      const g = makeFigure(r.supply ? LOOKS.guard : LOOKS.guard, { sword: true });
      g.group.scale.setScalar(SCALE);
      g.group.position.set(i % 2 ? -3.6 : 3.6, 0, 2 - Math.floor(i / 2) * 4.5);
      root.add(g.group);
      guards.push(g);
    }
    this.scene.add(root);
    // Where the road runs into a lake or a pool, the whole train goes over on a ferry raft.
    const raft = new THREE.Group();
    skin(raft, [paint(block(9, 0.5, 13).translate(0, 0.1, 1.8), '#6a4a2a'), ...[-4.2, 4.2].map((x) => paint(block(0.4, 0.9, 13).translate(x, 0.5, 1.8), '#4e3220'))], toon(), 0.04);
    raft.visible = false;
    root.add(raft);
    const view = { r, root, cart, beasts, driver, guards, raft, phase: Math.random() * 6, last: r.gone };
    this.views.set(r, view);
    return view;
  }

  hide(r) {
    const v = this.views.get(r);
    if (!v) return;
    this.scene.remove(v.root);
    this.views.delete(r);
  }

  place(v, dt) {
    const { r } = v, [x, z, face] = this.economy.where(r), moved = r.gone - v.last;
    v.last = r.gone;
    const ground = height(x, z), afloat = ground < FERRY_DEPTH;
    v.raft.visible = afloat;
    v.root.position.set(x, afloat ? 0.35 : ground, z);
    v.root.rotation.y += (Math.atan2(Math.sin(face - v.root.rotation.y), Math.cos(face - v.root.rotation.y))) * Math.min(1, dt * 3);
    v.phase += moved * 0.9;
    const going = moved > 0 && !afloat ? 1 : 0;
    for (const w of v.cart.wheels) w.rotation.x += moved / (SCALE * 0.62);
    for (const b of v.beasts) b.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(v.phase * 1.4 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 * going; });
    for (const g of v.guards) walkPose(g, v.phase * 2, going);
    if (!v.cart.wheels.length) walkPose(v.driver, v.phase * 2, going);
  }

  near(r, range) {
    const [x, z] = this.economy.where(r);
    return this.world.players.find((p) => !p.rooms.house && Math.hypot(p.state.x - x, p.state.z - z) < range) ?? null;
  }

  // ---- every frame ----
  update(dt) {
    const econ = this.economy;
    for (const r of econ.runs) {
      const shown = this.views.has(r), hero = this.near(r, shown ? FORGET : VIEW);
      if (hero && !shown && this.views.size < MOST_SHOWN) this.show(r);
      else if (!hero && shown && !r.hostile) this.hide(r);
      this.dangers(r, dt);
    }
    for (const v of this.views.values()) this.place(v, dt);
  }

  // Bandits by the road, escorts that wander off, and fights over a wagon.
  dangers(r, dt) {
    const econ = this.economy, [x, z] = econ.where(r);
    if (r.escort) {
      const d = Math.hypot(r.escort.state.x - x, r.escort.state.z - z);
      if (d > ESCORT_LEASH) {
        r.escort.hud.message(`You left the ${r.kind.toLowerCase()} to ${r.to.name}. They'll not pay you now.`);
        r.escort = null;
      } else if (!r.ambushed && r.gone >= r.ambushAt) this.ambush(r, null);
    }
    if (!r.ambushed && !r.supply) {
      const camp = this.world.sites.list.find((s) => s.key === 'bandit' && !s.done && Math.hypot(s.x - x, s.z - z) < BANDIT_REACH);
      if (camp) {
        r.ambushed = true;
        const kind = LOADS.findIndex(([, k]) => k === r.kind);
        if (Math.random() < AMBUSH[Math.max(0, kind)] * (r.escort ? 2 : 1)) {
          if (this.near(r, VIEW)) this.ambush(r, camp);
          else {
            econ.lose(r);
            this.world.realm.say(`Bandits of ${camp.cat.name === 'Bandit Camp' ? TOWNS.find((t) => Math.hypot(t.x - camp.x, t.z - camp.z) < 10)?.name ?? 'the hills' : camp.cat.name} took a ${r.kind.toLowerCase()} of ${GOODS[r.good].name.toLowerCase()} bound for ${r.to.name}.`, '#ff6f6f', x, z);
          }
        }
      }
    }
    if (r.raid) {
      const alive = r.raid.filter((e) => this.world.monsters.list.includes(e) && !e.dying);
      if (!alive.length) {
        r.raid = null;
        r.halted = r.hostile;
        const hero = this.near(r, 120);
        if (hero && !r.hostile) {
          const coin = Math.round(econ.worthOf(r) * (r.escort ? 0 : THANKS));
          hero.bag.gold += coin;
          hero.bag.save();
          hero.hud.message(coin ? `The ${r.kind.toLowerCase()} is saved. They press ${coin} gold on you.` : `The ${r.kind.toLowerCase()} is saved. On to ${r.to.name}.`, true);
        }
      } else if ((r.raidLeft -= dt) <= 0) {
        econ.lose(r);
        this.world.realm.say(`Bandits made off with a ${r.kind.toLowerCase()} on the road to ${r.to.name}.`, '#ff6f6f', x, z);
      }
    }
  }

  // Bandits rush the wagon; it stops and waits for help.
  ambush(r, camp) {
    r.ambushed = true;
    const [x, z] = this.economy.where(r), { monsters } = this.world, count = 3 + (GUARDS[r.kind] ?? 0);
    r.raid = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * 6.283, d = 26 + Math.random() * 8;
      r.raid.push(monsters.add(i === 0 && count > 4 ? 'chief' : 'bandit', x + Math.cos(a) * d, z + Math.sin(a) * d, monsters.danger(x, z), false));
    }
    r.halted = true;
    r.raidLeft = AMBUSH_HOLD;
    this.world.realm.say(`Bandits${camp ? '' : ' from the hills'} have fallen on a ${r.kind.toLowerCase()} on the road to ${r.to.name}!`, '#ff6f6f', x, z);
  }

  // ---- what a hero can do ----
  spot(p) {
    let best = null, bestD = TALK;
    for (const v of this.views.values()) {
      if (v.r.hostile || v.r.raid) continue;
      const d = Math.hypot(v.root.position.x - p.state.x, v.root.position.z - p.state.z);
      if (d < bestD) {
        best = v.r;
        bestD = d;
      }
    }
    if (!best) return null;
    return best.supply ? { label: `${NATIONS.find((n) => n.id === best.owner)?.name ?? 'A'} supply train: strike it to seize it`, caravan: best, idle: true } : { label: `Speak with the ${best.kind.toLowerCase()}`, caravan: best };
  }

  // Anywhere in a town's streets, its market; townsfolk come first, so they can still be spoken to.
  market(p) {
    if (p.rooms.house) return null;
    const place = this.world.realm.settlements.find((s) => s.stock && Math.hypot(s.x - p.state.x, s.z - p.state.z) < MARKET_REACH + tierOf(s.pop) * MARKET_PER_TIER);
    return place ? { label: `${place.name} market`, market: place } : null;
  }

  // A blow near a wagon: its guards fight, and enough of them breaks it open.
  struck(x, z, reach, force, p) {
    for (const v of this.views.values()) {
      const { r } = v;
      if (Math.hypot(v.root.position.x - x, v.root.position.z - z) > reach + 4.5) continue;
      if (!r.hostile) this.turn(r, p);
      r.hp ??= HITS * BLOW * p.body.might ** GROWTH_KEPT;
      r.hp -= force;
      v.cart.group.rotation.z = Math.max(-0.12, Math.min(0.12, (Math.random() - 0.5) * 0.24));
      this.world.work.burst(x, v.root.position.y + 2.5, z, ['#7a5230', '#c8b090', GOODS[r.good]?.color ?? '#fff'], 6, 4);
      if (r.hp <= 0) this.plunder(r, p);
    }
  }

  // The guards draw steel and the wagon stops.
  turn(r, p) {
    r.hostile = true;
    r.halted = true;
    const v = this.views.get(r), { monsters } = this.world, type = DOCTRINES[r.owner]?.troops[0] ?? 'soldier';
    r.guards = [];
    for (const g of v?.guards ?? []) {
      const at = new THREE.Vector3();
      g.group.getWorldPosition(at);
      const e = monsters.add(type, at.x, at.z, monsters.danger(at.x, at.z), false);
      if (DOCTRINES[r.owner]) e.nation = r.owner;
      r.guards.push(e);
      g.group.visible = false;
    }
    this.grudge(r.owner, GRUDGE * 0.5);
    p.hud.message(r.guards.length ? `The ${r.kind.toLowerCase()}'s guards draw steel!` : `The ${r.kind.toLowerCase()} has no one to defend it.`, true);
  }

  plunder(r, p) {
    const econ = this.economy, worth = econ.worthOf(r), item = itemOf(r.good);
    const coin = Math.round(worth * PURSE * (r.supply ? 0.3 : 1)), took = ITEMS[item] ? p.bag.add(item, Math.floor(r.qty)) : 0;
    p.bag.gold += coin;
    p.bag.save();
    const v = this.views.get(r);
    if (v) this.world.fx?.impact?.('earth', v.root.position.x, v.root.position.y, v.root.position.z, 3);
    econ.lose(r);
    this.grudge(r.owner, GRUDGE);
    const name = NATIONS.find((n) => n.id === r.owner)?.name;
    p.hud.message(`Plundered: ${coin} gold${took ? `, ${took} ${ITEMS[item].name.toLowerCase()}` : ''}${took < Math.floor(r.qty) ? ' (the rest is too heavy to carry)' : ''}.`, true, 2500);
    this.world.realm.say(r.supply ? `You seized a ${name} supply train. Its fort goes short.` : `You plundered a ${r.kind.toLowerCase()} bound for ${r.to.name}${name ? `, under ${name}'s protection` : ''}.`, ownerColor(r.owner));
  }

  // Pay up, or else: they pay if they can't hope to win.
  extort(r, p) {
    if (r.squeezed) return p.hud.message('They have paid you once already.');
    const n = NATIONS.find((a) => a.id === r.owner), guards = GUARDS[r.kind] ?? 0, level = n?.level ?? 5;
    if (guards === 0 || p.body.level >= level * 0.5 + guards * 2) {
      const coin = Math.round(this.economy.worthOf(r) * TOLL);
      r.squeezed = true;
      p.bag.gold += coin;
      p.bag.save();
      r.from.prosperity = Math.max(0, r.from.prosperity - 0.03);
      this.grudge(r.owner, GRUDGE * 0.4);
      return p.hud.message(`They pay ${coin} gold to be let alone.`, true);
    }
    p.hud.message('"You\'ll get nothing from us." They draw steel.', true);
    return this.turn(r, p);
  }

  escort(r, p) {
    if (r.escort) return p.hud.message(r.escort === p ? `You're already guarding them to ${r.to.name}.` : 'They already have a guard.');
    r.escort = p;
    r.ambushAt = r.gone + Math.min((r.dist - r.gone) * 0.4, ESCORT_TROUBLE);
    r.pay = Math.round(this.economy.worthOf(r) * ESCORT_PAY + (r.dist - r.gone) * ESCORT_PER_TILE);
    return p.hud.message(`Hired: see them to ${r.to.name} and they'll pay ${r.pay} gold. Stay close.`, true, 2500);
  }

  // Buys the load off the wagon, as much as the hero can carry and afford.
  buyLoad(r, p) {
    const item = itemOf(r.good), each = r.buy * LOAD_MARKUP, afford = Math.floor(p.bag.gold / each);
    const want = Math.min(Math.floor(r.qty), afford), got = p.bag.add(item, want);
    if (!got) return p.hud.message(afford ? 'You can carry no more.' : 'You can\'t afford any of it.');
    p.bag.gold -= Math.round(got * each);
    p.bag.save();
    r.qty -= got;
    r.from.prosperity = Math.min(1, r.from.prosperity + 0.02);
    if (r.qty < 1) {
      this.economy.runs.splice(this.economy.runs.indexOf(r), 1);
      this.hide(r);
    }
    return p.hud.message(`Bought ${got} ${ITEMS[item].name.toLowerCase()} for ${Math.round(got * each)} gold.`);
  }

  arrived(r) {
    if (r.escort) {
      r.escort.bag.gold += r.pay;
      r.escort.bag.save();
      r.escort.hud.message(`Safe in ${r.to.name}. You're paid ${r.pay} gold.`, true, 2500);
    }
    this.hide(r);
  }

  drop(r) {
    this.hide(r);
  }

  // A nation remembers who robs its roads; it adds to how much it feels the hero's hand.
  grudge(id, amount) {
    const n = this.world.realm.nations[id];
    if (n) n.grudge = (n.grudge ?? 0) + amount;
  }
}

const MARKET_REACH = 30, MARKET_PER_TIER = 22; // tiles from a place's middle its market reaches, more as it grows
const LOAD_MARKUP = 1.25;    // over what they paid, for buying a load off the road
