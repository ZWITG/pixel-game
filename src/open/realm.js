import { height, PLACES, TOWNS, roadDistance, riverDistance } from './terrain.js';
import { NATIONS, nationAt } from './nations.js';
import { DOCTRINES, FIELD } from './doctrines.js';
import { TIERS, tierOf, namePlace, nameCaptain } from './settlements.js';

// The living country. Time passes whether the hero is near or not: nations earn and spend,
// choose what to do, send armies, raise forts and fight each other, while people settle the
// land and their homes grow from a few houses into a kingdom.
// A nation chooses by scoring every plan against what it needs now, its own character
// (`weights` in doctrines.js), and a little chance, then doing the best one worth doing.
const SAVE_KEY = 'lumen.realm';
const DAY = 960;             // seconds, as the sky
const THINK = 40;            // seconds between one nation's decisions; they take turns
const WORTH_DOING = 0.32;    // a plan must score this to be done
const CHANCE = 0.3;          // how much a nation's mood sways a choice
const INCOME = 0.022;        // gold a day from each person
const STIPEND = 30;          // gold a day a nation has from its lands whatever its towns
const UPKEEP = 0.28;         // gold a day to keep one soldier
const WAR_GAP = 420;         // seconds between a nation's wars
const ARMY_PER_POP = 0.07, MIN_ARMY = 45, MOST_ARMY = 220;
const COST = { raise: 18, fortify: 40, build: 55, raid: 14, settle: 26, hunt: 20, field: 12, war: 30 };
const RAISED = 12, CAPTAINS = 2, MOST_OUTPOSTS = 3, MOST_SETTLEMENTS = 4, MOST_FREE = 3;
const GROWTH = 0.3;          // of the way up its curve per day
const NEAR_NATION = 900;     // tiles a raid or a field power reaches from a hero's position in a nation
const FIELD_GAP = 70, HUNT_GAP = 240, RAID_GAP = 120; // seconds between each, for one nation
const SPACING = 240;         // tiles between settlements
const CHRONICLE = 40;
const SAY_NEAR = 700;        // tiles at which news reaches the hero as a message
const FRONT_REACH = [260, 620]; // how far from a nation's seat toward a threat it builds
const SWAY_FROM = 0.72, SWAY_BY = 0.56;

const clamp = (v) => Math.max(0, Math.min(1, v));

// Every place has its own natural size: most stay small, a few have the room to become great.
function limitOf(s) {
  if (s.fixed) return s.pop < 200 ? 300 : 1000;
  const roll = (s.name.charCodeAt(0) * 37 + s.name.charCodeAt(1) * 11 + s.name.length * 53) % 100;
  return roll < 45 ? 60 : roll < 72 ? 180 : roll < 92 ? 500 : 1000;
}

export default class Realm {
  constructor(world) {
    this.world = world;
    this.day = 1;
    this.time = 0;
    this.turn = 0;
    this.lastThink = 0;
    this.blizzard = 0;
    this.news = [];
    this.settlements = [];
    this.outposts = [];
    this.nations = Object.fromEntries(NATIONS.map((n) => [n.id, { id: n.id, gold: 110, troops: 40, peak: 40, stance: 'Growing', plan: '', waits: {}, captains: [] }]));
    const saved = this.load();
    this.seed(saved);
    for (const s of Object.values(this.nations)) {
      while (s.captains.length < CAPTAINS) s.captains.push({ name: nameCaptain(s.id), rank: 1, kills: 0, alive: true });
    }
    world.nations.refreshAll();
    this.shiftBorders();
    addEventListener('pagehide', () => this.save());
  }

  // ---- saving ----
  load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch {
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        day: this.day, time: this.time, news: this.news, nations: this.nations,
        settlements: this.settlements.map(({ id, name, x, z, owner, pop, fixed }) => ({ id, name, x, z, owner, pop, fixed })),
        outposts: this.outposts.map(({ nation, x, z, name, done }) => ({ nation, x, z, name, done })),
      }));
    } catch { /* it lasts for this visit */ }
  }

  seed(saved) {
    if (saved) {
      Object.assign(this, { day: saved.day, time: saved.time, lastThink: saved.time, news: saved.news });
      for (const [id, s] of Object.entries(saved.nations)) Object.assign(this.nations[id], s, { waits: {} });
      for (const s of saved.settlements) this.world.towns.add(this.settlements, s);
      for (const o of saved.outposts) this.raiseOutpost(o.nation, o.x, o.z, o.name, o.done);
      return;
    }
    // The towns already standing, and a first few families out on the land.
    for (const T of TOWNS) {
      if (T.kind !== 'city' && T.kind !== 'village') continue;
      const n = nationAt(T.x, T.z);
      this.world.towns.add(this.settlements, { id: T.name, name: T.name, x: T.x, z: T.z, owner: n?.id ?? 'free', pop: T.kind === 'city' ? 420 : 70, fixed: true });
    }
    for (const n of NATIONS) this.found(n.id, true);
    for (let i = 0; i < 3; i++) this.found('free', true);
  }

  // ---- what happens ----
  say(text, color, x, z) {
    this.news.unshift({ day: this.day, text, color });
    this.news.length = Math.min(this.news.length, CHRONICLE);
    for (const p of this.world.players) {
      if (x === undefined || Math.hypot(p.state.x - x, p.state.z - z) < SAY_NEAR) p.hud.message(text);
    }
  }

  of(id) {
    return this.nations[id];
  }

  placesOf(id) {
    return this.settlements.filter((s) => s.owner === id);
  }

  people(id) {
    return this.placesOf(id).reduce((sum, s) => sum + s.pop, 0);
  }

  // How much of a nation is left: its people and its army, against the strongest it's been.
  strength(id) {
    const s = this.of(id);
    return clamp((this.people(id) / 1800) * 0.5 + (s.troops / Math.max(s.peak, 120)) * 0.5);
  }

  hero() {
    return this.world.players[0];
  }

  // How much a nation feels the hero's hand: strongholds lost, and the hero in its land.
  threat(id) {
    const st = this.world.nations.get(id), hurt = st.holds.length ? this.world.nations.broken(st) / st.holds.length : 0;
    const here = this.world.players.some((p) => nationAt(p.state.x, p.state.z)?.id === id && !p.rooms.house);
    return clamp(hurt * 0.75 + (here ? 0.4 : 0));
  }

  // Armies grow with the hero, on a curve that levels off rather than running away.
  bandSize(id) {
    const level = this.hero().body.level, by = 2 + Math.min(5, Math.sqrt(level) * 0.8);
    return Math.max(2, Math.round(by * (0.6 + this.strength(id) * 0.8)));
  }

  // ---- how a nation decides ----
  plans(id) {
    const s = this.of(id), weights = DOCTRINES[id].weights, threat = this.threat(id), st = this.world.nations.get(id);
    const army = s.troops / Math.min(MOST_ARMY, Math.max(MIN_ARMY, this.people(id) * ARMY_PER_POP));
    const broken = st.holds.filter((h) => h.done).length, here = this.heroOn(id);
    const afford = (plan) => (s.gold >= COST[plan] ? 1 : 0), ready = (plan) => ((s.waits[plan] ?? 0) <= this.time ? 1 : 0);
    const rival = this.weakestNeighbor(id);
    const score = {
      raise: (army < 1 ? (1 - army) * (0.7 + threat * 0.6) + 0.15 : 0) * afford('raise'),
      fortify: (broken ? 0.55 + threat * 0.4 : 0) * afford('fortify'),
      build: (this.outposts.filter((o) => o.nation === id && !o.done).length < MOST_OUTPOSTS ? 0.3 + threat * 0.5 : 0) * afford('build'),
      settle: (this.placesOf(id).length < MOST_SETTLEMENTS ? 0.45 * (1 - threat) : 0) * afford('settle'),
      raid: (here ? 0.55 + threat * 0.3 : 0) * clamp(s.troops / 20) * afford('raid') * ready('raid'),
      hunt: (here && s.captains.some((c) => c.alive) ? 0.45 + threat * 0.4 : 0) * afford('hunt') * ready('hunt'),
      field: (here ? 0.75 : 0) * afford('field') * ready('field'),
      war: rival ? clamp(this.strength(id) - this.strength(rival.owner) + 0.4) * (1 - threat) * afford('war') * ready('war') : 0,
    };
    return Object.entries(score).map(([plan, v]) => [plan, v * weights[plan] + Math.random() * CHANCE * (v > 0 ? 1 : 0)]).sort((a, b) => b[1] - a[1]);
  }

  heroOn(id) {
    return this.world.players.find((p) => !p.rooms.house && nationAt(p.state.x, p.state.z)?.id === id) ?? null;
  }

  think(id) {
    const s = this.of(id), [[plan, value]] = this.plans(id);
    const threat = this.threat(id);
    s.stance = threat > 0.65 ? 'Desperate' : threat > 0.3 ? 'At war' : s.troops < 30 ? 'Rebuilding' : 'Growing';
    if (value < WORTH_DOING) return;
    s.gold -= COST[plan];
    if (plan === 'war') s.waits.war = this.time + WAR_GAP;
    s.plan = plan;
    this[plan](id);
  }

  raise(id) {
    const s = this.of(id);
    s.troops += RAISED * (id === 'bone' ? 1.6 : 1);
    s.peak = Math.max(s.peak, s.troops);
  }

  fortify(id) {
    const st = this.world.nations.get(id), h = st.holds.find((x) => x.done);
    if (!h) return;
    this.world.sites.restore(h);
    this.world.nations.refresh(st);
    this.say(`${st.n.name} has retaken ${h.cat.name.toLowerCase()} on its land.`, st.n.color, h.x, h.z);
  }

  // A new fort, pushed out toward whatever threatens the nation most.
  build(id) {
    const n = NATIONS.find((a) => a.id === id), toward = this.heroOn(id)?.state ?? this.rivalPlace(id) ?? PLACES.lake;
    const way = Math.atan2(toward.z - n.z, toward.x - n.x);
    for (let t = 0; t < 40; t++) {
      const a = way + (Math.random() - 0.5) * 1.5, d = FRONT_REACH[0] + Math.random() * (FRONT_REACH[1] - FRONT_REACH[0]), x = n.x + Math.cos(a) * d, z = n.z + Math.sin(a) * d;
      if (!this.goodGround(x, z, 180) || nationAt(x, z)?.id !== id) continue;
      this.raiseOutpost(id, x, z, namePlace(`${id}${this.day}${t}`, 'Fort'));
      return;
    }
  }

  raiseOutpost(id, x, z, name, done = false) {
    const n = NATIONS.find((a) => a.id === id), site = this.world.sites.addFort(n, DOCTRINES[id], x, z, name, done);
    if (!site) return;
    const o = { nation: id, x, z, name, site, get done() { return site.done; } };
    this.outposts.push(o);
    this.world.nations.claim(id, site);
    if (!done) this.say(`${n.name} has raised ${name}.`, n.color, x, z);
  }

  goodGround(x, z, gap) {
    const y = height(x, z);
    if (y < 6 || y > 220) return false;
    if (Math.max(Math.abs(height(x + 14, z) - y), Math.abs(height(x, z + 14) - y), Math.abs(height(x - 14, z) - y), Math.abs(height(x, z - 14) - y)) > 7) return false;
    if (riverDistance(x, z) < 30 || roadDistance(x, z) < 14) return false;
    if (TOWNS.some((T) => Math.hypot(x - T.x, z - T.z) < T.r + 90)) return false;
    if (Object.values(PLACES).some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 50)) return false;
    return ![...this.settlements, ...this.outposts].some((s) => Math.hypot(x - s.x, z - s.z) < gap);
  }

  // People strike out and put up a first few houses.
  settle(id) {
    this.found(id);
  }

  found(owner, quiet = false) {
    const n = NATIONS.find((a) => a.id === owner), from = n ?? { x: PLACES.lake.x, z: PLACES.lake.z };
    for (let t = 0; t < 90; t++) {
      const a = Math.random() * 6.283, d = n ? 300 + Math.random() * 800 : 880 + Math.random() * 1500, x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d;
      if (!this.goodGround(x, z, SPACING)) continue;
      if (owner !== 'free' ? nationAt(x, z)?.id !== owner : nationAt(x, z) && t < 60) continue;
      const name = namePlace(`${x | 0}${z | 0}`);
      this.world.towns.add(this.settlements, { id: `s${Date.now().toString(36)}${t}`, name, x, z, owner, pop: 5, fixed: false });
      if (!quiet) this.say(`Settlers have founded ${name}.`, n?.color ?? '#e8ddc8', x, z);
      return;
    }
  }

  // One nation takes a settlement from a weaker neighbor, or from the hero's conquests.
  weakestNeighbor(id) {
    const n = NATIONS.find((a) => a.id === id);
    return this.settlements.filter((s) => s.owner !== id && s.owner !== 'free' && !s.fixed && Math.hypot(s.x - n.x, s.z - n.z) < 1900).sort((a, b) => this.strength(a.owner) - this.strength(b.owner))[0] ?? null;
  }

  rivalPlace(id) {
    return this.weakestNeighbor(id);
  }

  war(id) {
    const place = this.weakestNeighbor(id);
    if (!place) return;
    const s = this.of(id), n = NATIONS.find((a) => a.id === id), attack = s.troops * (0.7 + Math.random() * 0.6), hold = place.owner === 'hero' ? 30 : this.of(place.owner).troops * 0.5 + place.pop * 0.03;
    s.troops = Math.max(0, s.troops - hold * 0.3);
    const was = place.owner, name = was === 'hero' ? 'you' : NATIONS.find((a) => a.id === was).name;
    if (attack > hold) {
      place.owner = id;
      place.pop *= 0.8;
      if (was !== 'hero') this.of(was).troops = Math.max(0, this.of(was).troops - hold * 0.4);
      this.world.towns.colors(place);
      this.say(`${n.name} has taken ${place.name} from ${name}.`, n.color, place.x, place.z);
    } else {
      place.pop *= 0.92;
    }
  }

  // Sends soldiers against a hero, out of the hero's sight, and marks them as the nation's.
  warband(hero, n, count, reach, type) {
    const { monsters } = this.world, d = DOCTRINES[n.id];
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.283, x = hero.state.x + Math.cos(a) * reach, z = hero.state.z + Math.sin(a) * reach;
      const e = monsters.add(type ?? d.troops[i % d.troops.length], x, z, monsters.danger(x, z), false);
      e.nation = n.id;
      out.push(e);
    }
    return out;
  }

  raid(id) {
    const hero = this.heroOn(id), n = NATIONS.find((a) => a.id === id), s = this.of(id);
    if (!hero) return;
    s.waits.raid = this.time + RAID_GAP;
    const size = Math.min(this.bandSize(id), Math.ceil(s.troops / 4));
    if (size < 1) return;
    this.warband(hero, n, size, 42);
    s.troops -= size;
    this.say(`A ${n.name} warband is hunting you.`, n.color);
  }

  // A named captain comes for the hero, and remembers how it ends.
  hunt(id) {
    const hero = this.heroOn(id), n = NATIONS.find((a) => a.id === id), s = this.of(id), cap = s.captains.find((c) => c.alive);
    if (!hero || !cap) return;
    s.waits.hunt = this.time + HUNT_GAP;
    const [e] = this.warband(hero, n, 1, 34, DOCTRINES[id].troops[0]);
    e.captain = cap;
    e.def = { ...e.def, name: `${cap.title ?? 'Captain'} ${cap.name}` };
    e.hp *= 3 + cap.rank * 1.5;
    e.group.scale.multiplyScalar(1.35 + cap.rank * 0.08);
    this.warband(hero, n, Math.min(3, cap.rank + 1), 38);
    this.say(`${cap.title ?? 'Captain'} ${cap.name} of ${n.name} has come for you!`, n.color);
    hero.hud.message(`${cap.title ?? 'Captain'} ${cap.name} has come for you!`, true, 2500);
  }

  field(id) {
    const hero = this.heroOn(id), n = NATIONS.find((a) => a.id === id), s = this.of(id), d = DOCTRINES[id];
    if (!hero) return;
    s.waits.field = this.time + FIELD_GAP;
    hero.hud.message(d.fieldWord, true, 2000);
    FIELD[d.field](this, hero, n);
  }

  // A stone from far off: its shadow lands first.
  bombard(hero, x, z, size, delay) {
    this.world.monsters.mark(x, z, size, delay, { def: { damage: Math.max(2, hero.body.maxHealth * 0.14) }, foe: hero }, '#ff6a4a');
  }

  // ---- what war costs ----
  slain(e) {
    if (e.captain) {
      const nation = NATIONS.find((n) => n.id === e.nation), cap = e.captain;
      cap.alive = false;
      this.say(`You have slain ${cap.title ?? 'Captain'} ${cap.name} of ${nation.name}.`, nation.color);
      const s = this.of(e.nation);
      s.troops = Math.max(0, s.troops - 8);
      s.captains = s.captains.filter((c) => c !== cap).concat({ name: nameCaptain(s.id), rank: 1, kills: 0, alive: true }); // the next one steps up
    } else if (e.nation) this.of(e.nation).troops = Math.max(0, this.of(e.nation).troops - 1);
  }

  // Whoever beats a hero moves up in the world, and says so.
  heroFell(hero) {
    const e = this.world.monsters.list.find((m) => m.captain && Math.hypot(m.x - hero.state.x, m.z - hero.state.z) < 90);
    if (!e) return;
    const cap = e.captain, n = NATIONS.find((a) => a.id === e.nation);
    cap.rank++;
    cap.kills++;
    cap.title = ['Captain', 'Champion', 'Warlord', 'Conqueror-Slayer'][Math.min(3, cap.rank - 1)];
    this.say(`${cap.name} of ${n.name} beat you, and is now ${cap.title}.`, n.color);
  }

  // A hero's fire and fists cost a town its people.
  houseLost(id) {
    const s = this.settlements.find((p) => p.id === id);
    if (!s) return;
    s.pop = Math.max(2, s.pop * 0.9);
  }

  // A conquered nation's people are the hero's now.
  fall(id) {
    for (const s of this.placesOf(id)) {
      s.owner = 'hero';
      this.world.towns.colors(s);
    }
    this.of(id).troops = 0;
    for (const o of this.outposts) if (o.nation === id && !o.site.done) this.world.sites.dismantle(o.site);
  }

  // ---- time passing ----
  grow(days) {
    for (const s of this.settlements) {
      const owner = s.owner === 'free' || s.owner === 'hero' ? null : this.of(s.owner);
      const before = tierOf(s.pop);
      // A slow start, a boom, and a leveling off; war at home holds it back.
      const held = owner ? 1 - this.threat(s.owner) * 0.7 : 1;
      s.pop += GROWTH * s.pop * Math.max(0, 1 - s.pop / limitOf(s)) * days * held;
      if (owner) owner.gold += s.pop * INCOME * days;
      const after = tierOf(s.pop);
      if (after > before) {
        this.say(`${s.name} has grown into a ${TIERS[after].name.toLowerCase()}.`, NATIONS.find((n) => n.id === s.owner)?.color ?? '#e8ddc8', s.x, s.z);
        if (after === TIERS.length - 1 && owner) this.say(`${s.name} rises as the seat of a kingdom.`, '#ffd98a');
      }
    }
    if (Math.random() < days * 0.5 && this.placesOf('free').length < MOST_FREE) this.found('free');
    for (const n of NATIONS) {
      if (this.world.nations.isFallen(n)) continue;
      const force = this.of(n.id);
      force.gold = Math.max(0, force.gold + (STIPEND - force.troops * UPKEEP) * days);
    }
    // Free towns that grow large throw in with the strongest neighbor.
    for (const s of this.placesOf('free')) {
      if (tierOf(s.pop) >= 3 && Math.random() < days * 0.2) {
        const n = nationAt(s.x, s.z);
        if (n && !this.world.nations.isFallen(n)) {
          s.owner = n.id;
          this.world.towns.colors(s);
          this.say(`${s.name} has sworn itself to ${n.name}.`, n.color, s.x, s.z);
        }
      }
    }
  }

  // Strong nations push their borders out; failing ones lose ground.
  shiftBorders() {
    for (const n of NATIONS) {
      if (this.world.nations.isFallen(n)) continue;
      n.sway = n.base * (SWAY_FROM + this.strength(n.id) * SWAY_BY);
    }
    this.bordersOf = (this.bordersOf ?? 0) + 1;
  }

  update(dt) {
    this.time += dt;
    this.blizzard = Math.max(0, this.blizzard - dt);
    this.world.towns.update(dt, this.settlements);
    if (this.time - this.lastThink < THINK / NATIONS.length) return;
    const days = (this.time - this.lastThink) / DAY;
    this.lastThink = this.time;
    this.grow(days);
    const alive = NATIONS.filter((n) => !this.world.nations.isFallen(n));
    if (alive.length) this.think(alive[this.turn++ % alive.length].id);
    const today = 1 + Math.floor(this.time / DAY) + (this.dayFrom ?? 0);
    if (today !== this.day) {
      this.day = today;
      this.shiftBorders();
      this.save();
    }
  }
}
