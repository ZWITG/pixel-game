import { height, biome, forest, riverDistance } from './terrain.js';
import { NATIONS, nationAt } from './nations.js';
import { tierOf } from './settlements.js';

// The trade of the country. Every settlement works the land around it, makes goods, eats and uses
// them, and sells what it has too much of to whoever pays most. Prices come from stock against
// need, as in X4's station economy: a glut makes a good cheap, a shortage dear, and that gap is
// what sends merchants on the road. Prosperity is how well a place's needs are met; it drives
// growth and the taxes its nation lives on. Kept to a dozen goods on purpose: bazaarBot's author
// found simple economies more fun than clever ones (docs/world-upgrade-plan.md, section 5).
//   base: price in gold when stock matches need.  food: eaten in place of grain.
export const GOODS = {
  grain: { name: 'Grain', base: 4, food: true, color: '#e8c060' },
  fish: { name: 'Fish', base: 5, food: true, color: '#8fd0e8' },
  meat: { name: 'Meat', base: 8, food: true, color: '#d86a5a' },
  wood: { name: 'Timber', base: 3, color: '#b07a4a' },
  stone: { name: 'Stone', base: 3, color: '#b7a9b4' },
  ore: { name: 'Iron ore', base: 9, color: '#a8806a' },
  tools: { name: 'Tools', base: 16, color: '#c9d4e2' },
  arms: { name: 'Arms', base: 34, color: '#e8e0f0' },
  cloth: { name: 'Cloth', base: 11, color: '#d8b0e8' },
  ale: { name: 'Ale', base: 6, color: '#e8a040' },
  furs: { name: 'Furs', base: 18, color: '#c8a888' },
  wine: { name: 'Wine', base: 30, color: '#b03a5a' },
};
// What a person uses in a day. Food can be any food good; luxuries only once a place is a town.
const NEEDS = { food: 0.05, wood: 0.012, cloth: 0.004, ale: 0.008, tools: 0.002 };
const LUXURY = { wine: 0.001, furs: 0.001 }, LUXURY_TIER = 3;
const WEIGHT = { food: 0.55, wood: 0.12, cloth: 0.1, ale: 0.1, tools: 0.08, luxury: 0.05 };
// Who works at what, and how much one worker makes in a day on good land. `uses`: what one unit
// takes. Crafts open as a place grows (`tier`) and work the same anywhere.
const TRADES = {
  farm: { makes: 'grain', rate: 0.3 },
  fishery: { makes: 'fish', rate: 0.26 },
  herd: { makes: 'meat', rate: 0.14, also: { cloth: 0.02 } },
  lumber: { makes: 'wood', rate: 0.16 },
  trapper: { makes: 'furs', rate: 0.03 },
  quarry: { makes: 'stone', rate: 0.12, seam: 3 },
  mine: { makes: 'ore', rate: 0.2, seam: 4 },
  vineyard: { makes: 'wine', rate: 0.03 },
  smith: { makes: 'tools', rate: 0.05, uses: { ore: 1, wood: 0.5 }, tier: 2 },
  brewer: { makes: 'ale', rate: 0.12, uses: { grain: 0.7 }, tier: 2 },
  weaver: { makes: 'cloth', rate: 0.06, tier: 2 },
  armourer: { makes: 'arms', rate: 0.05, uses: { ore: 1.5, tools: 0.2 }, tier: 3 },
};
const WORKING = 0.6;          // of the people, the share at work
const POOR_LAND = 0.2;        // what a worker makes on land with nothing to offer, of a good day's work
// People drift into whatever trade pays best, as bazaarBot's agents switch to the most profitable
// job. Sharper favours the best trade more; DRIFT is how fast they move, a share a day.
const SHARPER = 2.5, DRIFT = 0.8;
const EXPORT_SHARE = 0.7;     // of the going rate elsewhere, what a good is worth to its makers
const COVER = 6;              // days of need a market likes to hold
const PRICE_SWING = 0.55, CHEAPEST = 0.3, DEAREST = 4.5;
const KEEP = 40;              // days of need past which a market lets stock spoil
const SETTLE = 0.6;           // of the way to its new level prosperity moves in a day
const TAX = 0.024;            // gold a day from each person, at full prosperity
const TAX_FLOOR = 0.3;        // share of the tax a ruined place still pays
const STARVE = 0.04;          // of the people lost a day at no food at all
// Trade runs between markets. Phase 5 puts them on the roads as real carts and caravans.
const CART_SPEED = 3.2;       // tiles a second
const LOADS = [[30, 'Peddler'], [80, 'Cart'], [180, 'Caravan']];
const MOST_RUNS = 28, PLANS = 4, REACH = 2600, HAUL_COST = 0.0006; // gold per unit per tile
const SPARE_DAYS = 2;         // days of its own need a market keeps back from merchants
const GATE_TOLL = 0.06, BRIDGE_TOLL = 0.04;   // of a load's worth
const LOOK = [[50, 8], [110, 12], [170, 14]]; // rings of samples when a place surveys its land
const SCORCH_REACH = 170;
const PANIC = 1.5;            // prosperity lost a day with every field on fire
const ARMY_ARMS = 0.006;      // arms a day a nation's markets want for each soldier

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// What a place's land is good for, from the ground around it.
function survey(s) {
  const land = { farm: 0, fishery: 0, herd: 0, lumber: 0, trapper: 0, quarry: 0, mine: 0, vineyard: 0 };
  const climate = nationAt(s.x, s.z)?.id;
  let n = 0;
  for (const [r, count] of LOOK) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * 6.283 + r, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, y = height(x, z);
      n++;
      if (y < 0 || riverDistance(x, z) < 6) {
        land.fishery += 1.4;
        continue;
      }
      const [meadow, autumn, pine] = biome(x, z), trees = forest(x, z), steep = Math.abs(height(x + 6, z) - y) + Math.abs(height(x, z + 6) - y);
      if (steep < 3 && y < 160) land.farm += meadow * (1 - trees) * 1.6 + autumn * 0.3;
      land.herd += (meadow + autumn) * (1 - trees) * 0.6;
      land.lumber += trees * (pine + autumn);
      land.trapper += trees * pine * (climate === 'frost' ? 1.5 : 0.3);
      if (y > 110 || steep > 9) {
        land.quarry += 0.8;
        land.mine += y > 170 ? 0.9 : 0.35;
      }
      if (meadow > 0.5 && steep < 4 && (climate === 'cinder' || climate === 'aurel')) land.vineyard += 0.5;
    }
  }
  for (const k of Object.keys(land)) land[k] /= n;
  return land;
}

export default class Economy {
  constructor(realm) {
    this.realm = realm;
    this.runs = [];
    this.flash = 0;   // seconds left on the last price news, so the chronicle isn't flooded
  }

  // Every settlement starts with a few days of what it needs, so the first day isn't a famine.
  open(s, saved) {
    s.land ??= survey(s);
    s.stock ??= saved?.stock ?? Object.fromEntries(Object.keys(GOODS).map((g) => [g, this.need(s, g) * COVER * 0.8]));
    s.prosperity ??= saved?.prosperity ?? 0.6;
    s.price ??= {};
    s.met ??= {};
    s.jobs ??= saved?.jobs;
    for (const g of Object.keys(GOODS)) s.price[g] = this.priceOf(s, g);
    if (!s.jobs) this.allot(s, 1);
  }

  // How much of a good a place wants to hold a day's worth of: its people's needs and its crafts'.
  need(s, g) {
    const def = GOODS[g], people = s.pop;
    let n = def.food ? (people * NEEDS.food) / 2 : (NEEDS[g] ?? 0) * people;
    if (LUXURY[g] && tierOf(s.pop) >= LUXURY_TIER) n += LUXURY[g] * people;
    // A nation's army wants arms from its markets, shared out by size.
    const army = g === 'arms' && this.realm.nations[s.owner];
    if (army) n += (army.troops * ARMY_ARMS * s.pop) / Math.max(1, this.realm.people(s.owner));
    for (const [id, t] of Object.entries(TRADES)) {
      if (t.uses?.[g] && this.workers(s, id)) n += this.workers(s, id) * t.rate * t.uses[g];
    }
    return Math.max(0.2, n);
  }

  priceOf(s, g) {
    const want = this.need(s, g) * COVER;
    return GOODS[g].base * clamp(((want + 1) / ((s.stock?.[g] ?? 0) + 1)) ** PRICE_SWING, CHEAPEST, DEAREST);
  }

  // People at work in one trade.
  workers(s, id) {
    return (s.jobs?.[id] ?? 0) * s.pop * WORKING;
  }

  // How good this place is at a trade: its land for the land trades, the same everywhere for crafts.
  knack(s, id) {
    const t = TRADES[id];
    if (t.tier !== undefined) return tierOf(s.pop) >= t.tier ? 1 : 0;
    return POOR_LAND + (1 - POOR_LAND) * Math.min(1, (s.land?.[id] ?? 0) * (t.seam ?? 2.2));
  }

  // What a good fetches here, or what merchants would pay to carry it where it's dear: the export
  // price is what lets a mining town live by its ore instead of farming poor ground.
  worth(s, g) {
    return Math.max(s.price[g], (this.going?.[g] ?? 0) * EXPORT_SHARE);
  }

  // The going rate of every good across the country: the middle of all its markets' prices.
  survey() {
    const places = this.realm.settlements.filter((p) => p.price?.grain);
    this.going = {};
    for (const g of Object.keys(GOODS)) {
      const list = places.map((p) => p.price[g]).sort((a, b) => a - b);
      this.going[g] = list.length ? list[Math.floor(list.length / 2)] : GOODS[g].base;
    }
  }

  // What a day's work in each trade is worth here, and people moving toward the best of them.
  allot(s, days) {
    const value = {};
    for (const [id, t] of Object.entries(TRADES)) {
      const knack = this.knack(s, id);
      if (!knack) continue;
      const inputs = Object.entries(t.uses ?? {}).reduce((sum, [g, per]) => sum + s.price[g] * per, 0);
      value[id] = Math.max(0.01, t.rate * knack * (this.worth(s, t.makes) - inputs) + (t.also ? Object.entries(t.also).reduce((sum, [g, per]) => sum + s.price[g] * per, 0) : 0));
    }
    const sum = Object.values(value).reduce((a, v) => a + v ** SHARPER, 0);
    s.jobs ??= {};
    const k = Math.min(1, days * DRIFT);
    for (const id of Object.keys(TRADES)) {
      const want = value[id] ? value[id] ** SHARPER / sum : 0;
      s.jobs[id] = s.jobs[id] === undefined ? want : s.jobs[id] + (want - s.jobs[id]) * k;
    }
  }

  // One step of the country's trade, `days` long.
  tick(days) {
    const places = this.realm.settlements;
    for (const s of places) this.open(s);
    this.survey();
    for (const s of places) this.allot(s, days);
    for (const s of places) this.work(s, days);
    this.trade();
    for (const s of places) for (const g of Object.keys(GOODS)) s.price[g] = this.priceOf(s, g);
  }

  work(s, days) {
    const scorched = this.scorched(s);
    for (const [id, t] of Object.entries(TRADES)) {
      const hands = this.workers(s, id);
      if (!hands) continue;
      let made = hands * t.rate * this.knack(s, id) * days * (t.makes === 'grain' || t.makes === 'meat' ? 1 - scorched : 1);
      for (const [g, per] of Object.entries(t.uses ?? {})) made = Math.min(made, (s.stock[g] ?? 0) / per);
      for (const [g, per] of Object.entries(t.uses ?? {})) s.stock[g] -= made * per;
      s.stock[t.makes] += made;
      for (const [g, per] of Object.entries(t.also ?? {})) s.stock[g] += hands * per * days;
    }
    // The people eat, the cheapest food first, and use what else they need.
    const met = {};
    let hunger = s.pop * NEEDS.food * days;
    const eaten = hunger;
    for (const g of Object.keys(GOODS).filter((k) => GOODS[k].food).sort((a, b) => s.price[a] - s.price[b])) {
      const take = Math.min(hunger, s.stock[g]);
      s.stock[g] -= take;
      hunger -= take;
    }
    met.food = eaten ? 1 - hunger / eaten : 1;
    for (const [g, per] of Object.entries(NEEDS)) {
      if (g === 'food') continue;
      if (!per) continue;
      const want = s.pop * per * days, take = Math.min(want, s.stock[g]);
      s.stock[g] -= take;
      met[g] = want ? take / want : 1;
    }
    if (tierOf(s.pop) >= LUXURY_TIER) {
      let want = 0, got = 0;
      for (const [g, per] of Object.entries(LUXURY)) {
        const w = s.pop * per * days, take = Math.min(w, s.stock[g]);
        s.stock[g] -= take;
        want += w;
        got += take;
      }
      met.luxury = want ? got / want : 1;
    } else met.luxury = 1;
    s.met = met;
    // Fires burn stores; past a point, stock spoils.
    if (scorched) for (const g of ['grain', 'wood', 'meat', 'cloth']) s.stock[g] *= 1 - scorched * Math.min(1, days * 8);
    for (const g of Object.keys(GOODS)) s.stock[g] = Math.min(s.stock[g], this.need(s, g) * KEEP + 30);
    const content = Object.entries(WEIGHT).reduce((sum, [k, w]) => sum + w * (met[k] ?? 1), 0);
    s.prosperity += (content - s.prosperity) * Math.min(1, days * SETTLE);
    s.prosperity = Math.max(0, s.prosperity - scorched * PANIC * days); // burning fields frighten people away
    if (met.food < 0.6) s.pop = Math.max(2, s.pop * (1 - STARVE * (1 - met.food) * days));
    if (met.food < 0.5 && !s.famine) {
      s.famine = true;
      this.realm.say(`Famine grips ${s.name}.`, '#e8a040', s.x, s.z);
    } else if (met.food > 0.85) s.famine = false;
  }

  // Share of a place's fields on fire or burnt out, from the scars near a hero.
  scorched(s) {
    const { scars, players } = this.realm.world;
    if (!players.some((p) => Math.hypot(p.state.x - s.x, p.state.z - s.z) < SCORCH_REACH * 2)) return 0;
    let burnt = 0;
    for (const c of scars.cells.values()) {
      if ((c.burn > 0 || c.char > 0.4) && Math.hypot(c.x - s.x, c.z - s.z) < SCORCH_REACH) burnt++;
    }
    return clamp(burnt / 260, 0, 0.9);
  }

  // Taxes for the nation that holds a place.
  taxes(s, days) {
    return s.pop * TAX * (TAX_FLOOR + (1 - TAX_FLOOR) * s.prosperity) * days;
  }

  // Merchants set out with whatever pays best, and deliver what's on the road.
  trade() {
    for (let i = 0; i < PLANS && this.runs.length < MOST_RUNS; i++) this.plan();
  }

  // The best paying load from one market to another: what a merchant there would choose.
  plan() {
    const places = this.realm.settlements.filter((s) => s.stock && s.pop > 10);
    if (places.length < 2) return;
    const from = places[Math.floor(Math.random() * places.length)];
    if (this.runs.some((r) => r.from === from)) return;
    const [load, kind] = LOADS[Math.min(LOADS.length - 1, Math.max(0, tierOf(from.pop) - 1))];
    let best = null;
    for (const to of places) {
      const d = Math.hypot(to.x - from.x, to.z - from.z);
      if (to === from || d > REACH) continue;
      for (const g of Object.keys(GOODS)) {
        const spare = from.stock[g] - this.need(from, g) * SPARE_DAYS;
        if (spare < 3 || to.price[g] < from.price[g] * 1.15) continue;
        const qty = Math.min(load, spare), gain = (to.price[g] - from.price[g]) * qty - d * HAUL_COST * qty - this.tolls(from, to, to.price[g] * qty);
        if (gain > (best?.gain ?? 6)) best = { to, g, qty, gain, d };
      }
    }
    if (!best) return;
    from.stock[best.g] -= best.qty;
    this.runs.push({ id: `${from.id}>${best.to.id}:${Date.now() % 1e6}`, kind, from, to: best.to, good: best.g, qty: best.qty, buy: from.price[best.g], dist: best.d, gone: 0, owner: from.owner });
  }

  // Tolls on the way: the gate of a walled town, and every river crossed under another's flag.
  tolls(from, to, worth) {
    return worth * (this.gates(to) + this.bridges(from, to).length * BRIDGE_TOLL);
  }

  gates(s) {
    return tierOf(s.pop) >= 3 && s.owner !== 'free' ? GATE_TOLL : 0;
  }

  // Where a straight run crosses water, and who holds the crossing.
  bridges(from, to) {
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 40), out = [];
    let wet = false;
    for (let i = 1; i < steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps, z = from.z + ((to.z - from.z) * i) / steps, now = riverDistance(x, z) < 0;
      if (now && !wet) out.push({ x, z, owner: nationAt(x, z)?.id ?? 'free' });
      wet = now;
    }
    return out;
  }

  // Carts move every frame, so the map and (later) the roads can show them.
  update(dt) {
    for (const r of this.runs) r.gone += dt * CART_SPEED;
    for (const r of this.runs.filter((x) => x.gone >= x.dist)) this.arrive(r);
  }

  where(r) {
    const k = Math.min(1, r.gone / r.dist);
    return [r.from.x + (r.to.x - r.from.x) * k, r.from.z + (r.to.z - r.from.z) * k];
  }

  arrive(r) {
    this.runs.splice(this.runs.indexOf(r), 1);
    const { to, from, good, qty } = r, worth = to.price[good] * qty;
    to.stock[good] += qty;
    // Gates and bridges pay their holders; the merchant's profit is its home town's.
    const gate = worth * this.gates(to);
    if (gate && this.realm.nations[to.owner]) this.realm.nations[to.owner].gold += gate;
    for (const b of this.bridges(from, to)) if (this.realm.nations[b.owner]) this.realm.nations[b.owner].gold += worth * BRIDGE_TOLL;
    from.prosperity = Math.min(1, from.prosperity + Math.max(0, worth - r.buy * qty) / Math.max(50, from.pop * 40));
    to.price[good] = this.priceOf(to, good);
  }

  // A robbed or burnt cart: its load is gone and its town feels it.
  lose(r) {
    this.runs.splice(this.runs.indexOf(r), 1);
    r.from.prosperity = Math.max(0, r.from.prosperity - 0.05);
  }

  // What a nation's places add up to, for the Nations tab.
  report(id) {
    const places = this.realm.settlements.filter((s) => s.owner === id && s.stock);
    if (!places.length) return null;
    const people = places.reduce((a, s) => a + s.pop, 0) || 1;
    const prosperity = places.reduce((a, s) => a + s.prosperity * s.pop, 0) / people;
    const food = places.reduce((a, s) => a + (s.met?.food ?? 1) * s.pop, 0) / people;
    const income = places.reduce((a, s) => a + this.taxes(s, 1), 0);
    const arms = places.reduce((a, s) => a + s.stock.arms, 0);
    return { prosperity, food, income, arms, runs: this.runs.filter((r) => r.owner === id).length };
  }

  // What a place is short of, and what it has plenty of, for its sign.
  outlook(s) {
    const goods = Object.keys(GOODS).filter((g) => this.need(s, g) > 0.3 || s.stock[g] > 5);
    const ratio = (g) => s.price[g] / GOODS[g].base;
    const short = goods.filter((g) => ratio(g) > 1.8).sort((a, b) => ratio(b) - ratio(a)).slice(0, 2);
    const cheap = goods.filter((g) => ratio(g) < 0.6).sort((a, b) => ratio(a) - ratio(b)).slice(0, 2);
    return { short, cheap };
  }

  // Taking one of the arms a nation's markets hold, for each soldier it raises.
  arm(id, count) {
    let got = 0;
    for (const s of this.realm.settlements.filter((p) => p.owner === id && p.stock)) {
      const take = Math.min(count - got, s.stock.arms);
      s.stock.arms -= take;
      got += take;
      if (got >= count) break;
    }
    return got;
  }

  save(s) {
    return { stock: Object.fromEntries(Object.entries(s.stock ?? {}).map(([g, v]) => [g, Math.round(v * 10) / 10])), prosperity: Math.round((s.prosperity ?? 0.6) * 1000) / 1000, jobs: s.jobs && Object.fromEntries(Object.entries(s.jobs).map(([id, v]) => [id, Math.round(v * 1000) / 1000])) };
  }

  saveRuns() {
    return this.runs.map(({ kind, from, to, good, qty, buy, dist, gone, owner }) => ({ kind, from: from.id, to: to.id, good, qty, buy, dist, gone, owner }));
  }

  loadRuns(list = []) {
    for (const r of list) {
      const from = this.realm.settlements.find((s) => s.id === r.from), to = this.realm.settlements.find((s) => s.id === r.to);
      if (from && to) this.runs.push({ ...r, from, to });
    }
  }
}

export const nameOfOwner = (id) => (id === 'hero' ? 'yours' : id === 'free' ? 'free folk' : NATIONS.find((n) => n.id === id)?.name ?? id);
