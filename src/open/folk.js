import { TOWNS, height } from './terrain.js';
import { townPlans } from './cityPlan.js';
import { makeFigure } from './figures.js';
import { LOOKS } from '../art/looks.js';
import { walkPose } from '../render/models.js';
import { nearSolids } from './solidGrid.js';
import { ITEMS } from './items.js';

// Townsfolk with a day to live (phase 7). Each has a trade, a home and a place of work, and keeps
// a simple schedule anyone watching can read: out at first light (some earlier than others, as
// the Skyrim modders advise), at work through the day, to the market late on, the tavern at dusk,
// home to bed. Guards keep day and night shifts, lanterns in hand after dark. Like Stardew Valley's
// villagers they're learned by watching, not by being told, and like Oblivion's lesson says, the
// rules stay few. They walk the town's streets (cityPlan.js), not through its houses.
const FOLK_NEAR = 160;      // tiles past a town's edge that people come into being
const FLEE = 9;               // tiles a second a frightened townsperson runs
const CROWD = { village: 12, city: 48 };
const SEEN = 200;           // tiles (as the crow walks the grid) at which a townsperson is drawn
const TALK = 3.6, GREET = 8;
const WALK = 2.6, SCALE = 2.3;
const LINK = 4;             // tiles: street points this close are joined (crossings)
const TRADE_COST = 5;

// The day by the clock (world.clock, 0..1): bed, first light, market, tavern.
const WAKE = 0.19, MARKET = 0.62, TAVERN = 0.7, BED = 0.84, SHIFT = [0.25, 0.75];

export const TRADES = {
  priest: { look: 'elder', gear: ['hood'], work: 'chapel', act: 'pray', title: 'healer', line: 'Bring me your hurts. The chapel door is open.' },
  trader: { look: 'merchant', gear: ['ledger'], work: 'market', act: 'haggle', title: 'trader', line: 'Fair weights, fair prices. Mostly.' },
  smith: { look: 'smith', gear: ['apron', 'hammer'], work: 'workshop', act: 'hammer', title: 'smith', line: 'Can\'t stop. The iron won\'t wait.' },
  farmer: { look: 'elder', gear: ['hood', 'pitchfork'], work: 'fields', act: 'rake', title: 'farmer', line: 'Rain tomorrow, if my knees are right.' },
  porter: { look: 'merchant', gear: ['sack'], work: 'market', act: 'carry', title: 'porter', line: 'Grain for the market. Mind your back.' },
  guard: { look: 'guard', gear: [], work: 'post', act: 'stand', title: 'guard', shifts: true, line: 'Keep the peace and we\'ll get along.' },
  child: { look: 'kid', gear: [], work: 'play', act: 'run', title: 'child', early: true, line: 'Race you to the well!' },
  innkeep: { look: 'merchant', gear: ['apron', 'broom'], work: 'inn', act: 'sweep', title: 'innkeeper', late: true, line: 'Rooms upstairs, ale downstairs.' },
  bard: { look: 'bard', gear: ['lute'], work: 'market', act: 'play', title: 'bard', late: true, line: 'A song for a coin? A better one for two.' },
};
const ORDER = ['priest', 'trader', 'smith', 'farmer', 'porter', 'guard', 'child', 'innkeep', 'farmer', 'guard', 'bard', 'smith', 'child', 'porter', 'farmer', 'trader'];
const BUILDS = [{}, { bulk: 1.22, thin: 1.15 }, { tall: 1.1, bulk: 0.95 }, { bulk: 0.88, thin: 0.9 }, { lean: 0.22, tall: 0.94 }, { tall: 1.05 }];
const GIVEN = ['Alda', 'Bram', 'Cora', 'Dell', 'Edda', 'Finn', 'Greta', 'Hob', 'Ilse', 'Jory', 'Kett', 'Liss', 'Merrin', 'Nolle', 'Orla', 'Pell', 'Rhoswen', 'Sim', 'Tamsin', 'Ulf', 'Wenna', 'Yorick'];
const SAY = {
  market: ['Prices are up again. Blame the war.', 'Have you seen the cloth from the south? Lovely stuff.'],
  tavern: ['Pull up a stool. The ale\'s not bad tonight.', 'One more song and then home, I swear.'],
  night: ['Move along. It\'s late.', 'Quiet night. Let\'s keep it that way.'],
};

function seeded(text) {
  let seed = [...text].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// ---- the streets as a graph, to walk from anywhere to anywhere ----
function streetGraph(T, plan) {
  const nodes = [], edges = [], grid = new Map(), key = (x, z) => `${Math.floor(x / LINK)},${Math.floor(z / LINK)}`;
  const add = (x, z) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const n of grid.get(`${Math.floor(x / LINK) + i},${Math.floor(z / LINK) + j}`) ?? []) if (Math.hypot(nodes[n][0] - x, nodes[n][1] - z) < LINK) return n;
    }
    nodes.push([x, z]);
    edges.push([]);
    const k = key(x, z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(nodes.length - 1);
    return nodes.length - 1;
  };
  for (const st of plan.streets) {
    let prev = -1;
    for (let i = 0; i < st.pts.length; i++) {
      const [ax, az] = st.pts[i];
      // Long stretches get points along them, so a walker can join a street anywhere.
      if (i > 0) {
        const [px, pz] = st.pts[i - 1], steps = Math.floor(Math.hypot(ax - px, az - pz) / 12);
        for (let s = 1; s < steps; s++) {
          const n = add(T.x + px + ((ax - px) * s) / steps, T.z + pz + ((az - pz) * s) / steps);
          if (prev >= 0 && prev !== n) edges[prev].push(n), edges[n].push(prev);
          prev = n;
        }
      }
      const n = add(T.x + ax, T.z + az);
      if (prev >= 0 && prev !== n) edges[prev].push(n), edges[n].push(prev);
      prev = n;
    }
  }
  return { nodes, edges, grid };
}

function nearestNode(g, x, z) {
  let best = 0, bd = 1e9;
  for (let r = 0; r < 6 && bd === 1e9; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      for (const n of g.grid.get(`${Math.floor(x / LINK) + i},${Math.floor(z / LINK) + j}`) ?? []) {
        const d = Math.hypot(g.nodes[n][0] - x, g.nodes[n][1] - z);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
    }
  }
  if (bd === 1e9) g.nodes.forEach(([nx, nz], n) => {
    const d = Math.hypot(nx - x, nz - z);
    if (d < bd) {
      bd = d;
      best = n;
    }
  });
  return best;
}

// The shortest way along the streets (Dijkstra with a small binary heap).
function route(g, from, to) {
  const a = nearestNode(g, from[0], from[1]), b = nearestNode(g, to[0], to[1]);
  const dist = new Float64Array(g.nodes.length).fill(Infinity), prev = new Int32Array(g.nodes.length).fill(-1), heap = [[0, a]];
  dist[a] = 0;
  while (heap.length) {
    let top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    } else top = last;
    const [d, n] = top;
    if (n === b) break;
    if (d > dist[n]) continue;
    for (const m of g.edges[n]) {
      const nd = d + Math.hypot(g.nodes[m][0] - g.nodes[n][0], g.nodes[m][1] - g.nodes[n][1]);
      if (nd >= dist[m]) continue;
      dist[m] = nd;
      prev[m] = n;
      heap.push([nd, m]);
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    }
  }
  const path = [to];
  if (prev[b] >= 0 || a === b) for (let n = b; n >= 0; n = prev[n]) path.unshift(g.nodes[n]);
  path.unshift(from);
  return path;
}

export class People {
  constructor(scene, world) {
    Object.assign(this, { scene, world });
    this.list = [];
    this.live = new Set();
    this.towns = new Map();
    this.t = 0;
  }

  // A town's places: homes, work, market, tavern, posts and fields, from its plan and houses.
  places(T) {
    if (this.towns.has(T.name)) return this.towns.get(T.name);
    const plan = townPlans().get(T.name), s = this.world.realm?.settlements.find((p) => p.name === T.name);
    const houses = (s?.houses ?? this.world.marks.houses.filter((h) => Math.hypot(h.x - T.x, h.z - T.z) < T.r)).filter((h) => !h.solid?.off);
    const doors = (types) => houses.filter((h) => types.includes(h.type)).map((h) => [h.door.x, h.door.z]);
    const m = plan.market, market = [T.x + m.x, T.z + m.z];
    const ring = (r, n) => Array.from({ length: n }, (_, i) => [T.x + Math.cos((i / n) * 6.283 + 0.4) * r, T.z + Math.sin((i / n) * 6.283 + 0.4) * r]);
    const P = {
      plan, graph: streetGraph(T, plan), market, mr: m.r,
      homes: doors(['house', 'cottage', 'townhouse', 'merchant', 'towerhouse']),
      workshop: doors(['workshop']), inn: doors(['inn']), chapel: doors(['chapel']),
      fields: ring((plan.R ?? T.r) * 1.08 + 12, 6).filter(([x, z]) => height(x, z) > 2),
      post: plan.gates.length ? plan.gates.map((g) => [T.x + Math.cos(g.a) * (plan.R ?? T.r) * 0.9, T.z + Math.sin(g.a) * (plan.R ?? T.r) * 0.9]) : ring(m.r + 6, 2),
    };
    if (P.homes.length < 6) P.homes = houses.map((h) => [h.door.x, h.door.z]); // a small or broken town: anyone sleeps anywhere
    for (const k of ['homes', 'workshop', 'inn', 'chapel', 'fields']) if (!P[k].length) P[k] = [market];
    this.towns.set(T.name, P);
    return P;
  }

  fill(T) {
    this.live.add(T);
    const P = this.places(T), rand = seeded(`${T.name}folk`);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    for (let i = 0; i < CROWD[T.kind]; i++) {
      const id = ORDER[i % ORDER.length], trade = TRADES[id], dayShift = i % 2 === 0;
      const work = id === 'guard' ? pick(P.post) : id === 'trader' || id === 'porter' || id === 'bard' || id === 'child' ? [P.market[0] + (rand() - 0.5) * P.mr, P.market[1] + (rand() - 0.5) * P.mr] : pick(P[trade.work]);
      const gear = [...trade.gear, ...(trade.shifts && !dayShift ? ['lantern'] : [])];
      const model = makeFigure(LOOKS[trade.look], { gear, build: id === 'child' ? null : pick(BUILDS) });
      model.group.scale.setScalar(SCALE);
      this.scene.add(model.group);
      const f = {
        T, id, trade, model, name: GIVEN[Math.floor(rand() * GIVEN.length)], home: pick(P.homes), work, dayShift,
        wake: WAKE + rand() * 0.1, bed: trade.early ? 0.74 : BED + rand() * 0.07, path: null, goal: null, act: null, phase: rand() * 6, seed: rand() * 9,
        x: 0, z: 0, job: id === 'priest' ? 'healer' : id === 'trader' ? 'trader' : 'folk',
      };
      // Start where the hour says they'd be.
      const g = this.goal(f, this.world.clock);
      [f.x, f.z] = this.where(f, g);
      f.goal = g;
      f.act = g.act;
      f.inside = !!g.sleep;
      this.list.push(f);
    }
  }

  empty(T) {
    this.live.delete(T);
    this.list = this.list.filter((f) => {
      if (f.T !== T) return true;
      this.scene.remove(f.model.group);
      return false;
    });
  }

  // Where a person should be at clock `c`, and what they do there.
  goal(f, c) {
    const P = this.places(f.T);
    if (f.trade.shifts) {
      const day = c > SHIFT[0] && c < SHIFT[1];
      return day === f.dayShift ? { key: 'post', at: f.work, act: 'stand' } : { key: 'home', at: f.home, sleep: true };
    }
    if (c < f.wake || c >= f.bed) return { key: 'home', at: f.home, sleep: true };
    if (c < MARKET || (f.trade.late && c < TAVERN)) return { key: 'work', at: f.work, act: f.trade.act };
    if (c < TAVERN && f.id !== 'child') return { key: 'market', at: P.market, act: 'haggle', spread: P.mr * 0.8 };
    if (f.id === 'child') return { key: 'play', at: P.market, act: 'run', spread: P.mr };
    return { key: 'tavern', at: P.inn[Math.floor(f.seed) % P.inn.length], act: f.id === 'bard' ? 'play' : 'drink', spread: 5 };
  }

  // A spot near the goal, a little apart from the others there.
  where(f, g) {
    const r = g.spread ?? (g.sleep ? 0 : 2.5), a = f.seed * 2.4;
    return [g.at[0] + Math.cos(a) * r * ((f.seed % 1) + 0.3), g.at[1] + Math.sin(a) * r * ((f.seed % 1) + 0.3)];
  }

  blocked(x, z) {
    return nearSolids(this.world.marks, x, z).some((s) => !s.off && (s.r ? Math.hypot(x - s.x, z - s.z) < s.r + 1 : x > s.x0 - 1 && x < s.x1 + 1 && z > s.z0 - 1 && z < s.z1 + 1));
  }

  update(dt) {
    this.t += dt;
    const { players } = this.world, c = this.world.clock;
    for (const T of TOWNS) {
      if (!CROWD[T.kind]) continue;
      const near = players.some((p) => Math.hypot(p.state.x - T.x, p.state.z - T.z) < T.r + FOLK_NEAR);
      if (near && !this.live.has(T)) this.fill(T);
      else if (!near && this.live.has(T)) this.empty(T);
      for (const p of players) {
        const inside = !p.rooms.house && Math.hypot(p.state.x - T.x, p.state.z - T.z) < T.r * 0.8;
        if (inside && p.town !== T) {
          p.town = T;
          p.hud.message(T.name, true);
        } else if (!inside && p.town === T) p.town = null;
      }
    }
    for (const f of this.list) {
      // A change of hour: set off for the next place.
      const g = this.goal(f, c);
      if (g.key !== f.goal?.key) {
        f.goal = g;
        f.inside = false;
        f.path = route(this.places(f.T).graph, [f.x, f.z], this.where(f, g));
        f.act = null;
      }
      const m = f.model, grp = m.group;
      // From Menace on, they run from a hero they recognise; afterwards they find their way again.
      if (!f.inside && this.world.omega?.scary(f.x, f.z)) {
        const p = players.reduce((a, b) => (Math.hypot(b.state.x - f.x, b.state.z - f.z) < Math.hypot(a.state.x - f.x, a.state.z - f.z) ? b : a));
        const dx = f.x - p.state.x, dz = f.z - p.state.z, d = Math.hypot(dx, dz) || 1;
        f.x += (dx / d) * FLEE * dt;
        f.z += (dz / d) * FLEE * dt;
        f.goal = null;
        f.path = null;
        f.phase += dt * 14;
        if (grp.visible) {
          grp.position.set(f.x, height(f.x, f.z), f.z);
          grp.rotation.y = Math.atan2(dx, dz);
          walkPose(m, f.phase, 1.6);
        }
        continue;
      }
      const seen = !f.inside && players.some((p) => Math.abs(p.state.x - f.x) + Math.abs(p.state.z - f.z) < SEEN);
      grp.visible = seen;
      if (f.path?.length) {
        const [tx, tz] = f.path[0], dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz), step = WALK * (f.id === 'child' ? 1.5 : f.model.root.scale.y < 1 ? 0.85 : 1) * dt;
        if (d <= step) {
          f.x = tx;
          f.z = tz;
          f.path.shift();
          if (!f.path.length) {
            f.act = f.goal.act;
            if (f.goal.sleep) f.inside = true;
          }
        } else {
          f.x += (dx / d) * step;
          f.z += (dz / d) * step;
          grp.rotation.y = Math.atan2(dx, dz);
        }
        if (!seen) continue;
        f.phase += dt * 8;
        grp.position.set(f.x, height(f.x, f.z), f.z);
        walkPose(m, f.phase, 1);
        if (f.id === 'porter') m.arms[0].rotation.set(-2.7, 0, 0.2);
        continue;
      }
      if (!seen) continue;
      grp.position.set(f.x, height(f.x, f.z), f.z);
      // Someone close by gets a look and a wave.
      const friend = players.find((p) => Math.hypot(p.state.x - f.x, p.state.z - f.z) < GREET);
      if (friend && f.act !== 'hammer' && f.act !== 'pray') {
        grp.rotation.y = Math.atan2(friend.state.x - f.x, friend.state.z - f.z);
        walkPose(m, f.phase, 0);
        m.arms[1].rotation.set(-2.6 + Math.sin(this.t * 12) * 0.3, 0, 0);
        continue;
      }
      this.work(f, dt);
    }
  }

  // What each act looks like, on the shared figure rig.
  work(f, dt) {
    const m = f.model, t = this.t + f.seed, [a0, a1] = m.arms;
    walkPose(m, f.phase, 0);
    m.head.rotation.x = 0;
    if (f.act === 'hammer') {
      a0.rotation.set(-1.3 + Math.max(0, Math.sin(t * 7)) * -1.1, 0, 0);
      a1.rotation.set(-0.7, 0, 0.2);
    } else if (f.act === 'sweep') {
      a0.rotation.set(-0.6, 0, Math.sin(t * 3) * 0.5);
      a1.rotation.set(-0.8, 0, Math.sin(t * 3) * 0.5);
    } else if (f.act === 'rake') {
      a0.rotation.set(-0.9 + Math.sin(t * 2.5) * 0.5, 0, 0);
      a1.rotation.set(-0.6 + Math.sin(t * 2.5) * 0.4, 0, 0);
      m.head.rotation.x = 0.3;
    } else if (f.act === 'pray') {
      a0.rotation.set(-1.25, 0, -0.45);
      a1.rotation.set(-1.25, 0, 0.45);
      m.head.rotation.x = 0.45;
    } else if (f.act === 'haggle') {
      a1.rotation.set(-0.9 + Math.sin(t * 4) * 0.4, 0, Math.sin(t * 2) * 0.3);
      if ((f.turn = (f.turn ?? 0) - dt) <= 0) {
        f.turn = 3 + (f.seed % 3);
        m.group.rotation.y += 1.4 + f.seed % 1;
      }
    } else if (f.act === 'play') {
      a0.rotation.set(-0.9, 0, -0.3 + Math.sin(t * 11) * 0.15);
      a1.rotation.set(-1.15, 0.3, 0.3);
    } else if (f.act === 'drink') {
      const sip = Math.max(0, Math.sin(t * 0.8)) ** 4;
      a1.rotation.set(-0.6 - sip * 1.9, 0, 0.1);
    } else if (f.act === 'carry') {
      a0.rotation.set(-2.7, 0, 0.2);
    } else if (f.act === 'run') {
      // Children dash about the square.
      if ((f.turn = (f.turn ?? 0) - dt) <= 0) {
        f.turn = 1 + (f.seed % 2);
        f.dir = Math.random() * 6.283;
      }
      const P = this.places(f.T), nx = f.x + Math.sin(f.dir ?? 0) * WALK * 1.8 * dt, nz = f.z + Math.cos(f.dir ?? 0) * WALK * 1.8 * dt;
      if (Math.hypot(nx - P.market[0], nz - P.market[1]) < P.mr && !this.blocked(nx, nz)) {
        f.x = nx;
        f.z = nz;
        m.group.rotation.y = f.dir;
        f.phase += dt * 14;
        walkPose(m, f.phase, 1.2);
      } else f.dir = (f.dir ?? 0) + 2.5;
    }
  }

  // What the Cross button does near someone out and about.
  spot(p) {
    const f = this.list.find((k) => !k.inside && k.model.group.visible && Math.hypot(k.x - p.state.x, k.z - p.state.z) < TALK);
    if (!f) return null;
    return { label: f.job === 'healer' ? `Be healed by ${f.name}` : f.job === 'trader' ? `Trade ${TRADE_COST} goods with ${f.name}` : `Talk to ${f.name} the ${f.trade.title}`, person: f };
  }

  talk(p, f) {
    const { hud, bag, body } = p;
    if (f.job === 'healer') {
      p.hp = body.maxHealth;
      hud.setHealth(1);
      hud.message(`${f.name}: "Rest easy. You're mended."`);
    } else if (f.job === 'trader') {
      const pile = Object.keys(bag.items).find((id) => ITEMS[id].kind === 'material' && bag.items[id] >= TRADE_COST);
      if (!pile) return hud.message(`${f.name}: "Bring ${TRADE_COST} of anything and I'll make you a salve."`);
      bag.remove(pile, TRADE_COST);
      bag.items.salve = (bag.items.salve ?? 0) + 1;
      bag.save();
      hud.message(`${TRADE_COST} ${ITEMS[pile].name} for a Healing Salve.`);
    } else {
      const k = f.goal?.key, site = p.site;
      const line = k === 'market' ? SAY.market[Math.floor(f.seed) % 2] : k === 'tavern' ? SAY.tavern[Math.floor(f.seed) % 2] : f.trade.shifts && !f.dayShift ? SAY.night[Math.floor(f.seed) % 2] : f.trade.line;
      hud.message(site && Math.random() < 0.4 ? `${f.name}: "They say there's a ${site.cat.name} about ${Math.round(p.siteDist)} m from here."` : `${f.name} the ${f.trade.title}: "${line}"`);
    }
    return undefined;
  }
}
