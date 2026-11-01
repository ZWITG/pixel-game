// How monsters fight in the open world. Nothing hurts by touch: each attack is a tell you can
// read, a strike you can roll, block or parry, and a recovery you can punish. Monsters in a group
// take turns, so a crowd presses you without all swinging at once.
//  tell: seconds of warning. time: seconds the strike lasts. lunge: tiles per second forward.
//  reach: how close it connects. area: strikes all around at this radius, with a ground warning.
//  power: multiplies damage. heavy: breaks a guard, so roll it or parry it.
const MOVES = {
  hop: { tell: 0.55, time: 0.32, lunge: 15, reach: 2.2, power: 1 },
  swipe: { tell: 0.42, time: 0.22, lunge: 11, reach: 2.8, power: 1 },
  flurry: { tell: 0.34, time: 0.2, lunge: 9, reach: 2.6, power: 0.7, again: 2 },
  charge: { tell: 0.75, time: 0.8, lunge: 24, reach: 2.6, power: 1.5, heavy: true },
  burst: { tell: 0.95, time: 0.18, lunge: 0, area: 8, power: 1.3 },
  slam: { tell: 1.15, time: 0.22, lunge: 8, area: 11, power: 2, heavy: true },
};
const FIGHTERS = {
  slime: ['hop'],
  fireSlime: ['hop', 'burst'],
  puffcap: ['burst', 'swipe'],
  sporeling: ['hop'],
  boar: ['charge'],
  bandit: ['swipe', 'flurry'],
  chief: ['charge', 'slam', 'flurry'],
  soldier: ['swipe', 'charge'],
  legionary: ['swipe', 'charge', 'slam'],
  assassin: ['flurry', 'swipe'],
  iceGuard: ['slam', 'swipe'],
  bomber: ['burst'],
  drowned: ['hop', 'swipe'],
  wolf: ['swipe', 'hop'],
  golem: ['slam', 'swipe'],
  scorpion: ['swipe', 'charge'],
  lurker: ['hop', 'burst'],
  bat: ['hop'],
};
const TURN_TAKERS = 2;       // monsters attacking one hero at a time
const PRESS = 8;             // tiles from a hero that those waiting their turn circle at
const TURN_REACH = 3;        // tiles past that ring they'll put their name down for a turn
const STRIKE_FROM = 3;       // extra tiles out from a move's reach that it starts its attack
const RECOVER = 0.75;        // seconds open after a miss or a hit
const STAGGER = 0.6;         // seconds reeling from a blow that interrupts it
const TOUGH_FROM = 4;        // from this form, single blows don't interrupt
export const PARRIED = 1.6;  // seconds dazed by a parry

export function arm(e, type, monsters) {
  // Only shooters fight with no moves; anything else unlisted still has to be able to strike.
  e.moves = (FIGHTERS[type] ?? (e.def.keepAway ? [] : ['swipe'])).slice();
  e.mode = 'roam';
  e.until = 0;
  e.think = (t) => think(monsters, e, t);
}

const setMode = (e, mode, seconds, t) => {
  e.mode = mode;
  e.until = t + seconds;
};

// Gives up its turn, for the next in line.
export function standDown(e) {
  e.turn = false;
}

// Knocked off balance, as long as it isn't a form too big to care about one blow.
export function stagger(e, seconds, t, force = false) {
  if (!force && (e.tier ?? 0) >= TOUGH_FROM && e.mode !== 'recover') return;
  standDown(e);
  e.state = 'roam';
  setMode(e, 'reeling', seconds, t);
  e.vel.set(0, 0);
}

function pickMove(e, dist) {
  const list = (e.tier ?? 0) >= 3 && !e.moves.includes('slam') ? [...e.moves, 'slam'] : e.moves;
  const near = list.filter((m) => dist < (MOVES[m].area ?? MOVES[m].reach) + STRIKE_FROM + (MOVES[m].lunge * MOVES[m].time) / 2);
  return near[Math.floor(Math.random() * near.length)];
}

function strike(monsters, e, move) {
  const hero = e.foe;
  if (!hero || e.landed) return;
  const s = hero.state, d = Math.hypot(s.x - e.x, s.z - e.z);
  if (s.air > 3) return;
  if (d < (move.area ?? move.reach) + e.radius) {
    e.landed = true;
    monsters.hurt(hero, e.def.damage * move.power, e.x, e.z, { heavy: move.heavy, from: e });
  }
}

function think(monsters, e, t) {
  const hero = monsters.player, def = e.def;
  // Town wards push them out, as in the main game.
  if (monsters.inVillage(e.x, e.z)) {
    const c = monsters.villageCenter();
    e.vel.set(e.x - c.x, e.z - c.z).normalize().multiplyScalar(Math.max(def.speed, 3));
    return;
  }
  const dist = Math.hypot(hero.x - e.x, hero.z - e.z), dx = (hero.x - e.x) / (dist || 1), dz = (hero.z - e.z) / (dist || 1);
  if (e.mode === 'held') return;
  if (e.mode === 'reeling' || e.mode === 'recover') {
    e.vel.set(0, 0);
    if (t >= e.until) {
      standDown(e);
      e.mode = 'hunt';
    }
    return;
  }
  if (e.mode === 'tell') {
    e.vel.set(0, 0);
    e.state = 'windup';
    if (t >= e.until) {
      const m = MOVES[e.move];
      e.state = 'roam';
      e.landed = false;
      e.vel.set(dx, dz).multiplyScalar(m.lunge);
      setMode(e, 'strike', m.time, t);
      if (m.area) monsters.quakeAt(e, m.area);
    }
    return;
  }
  if (e.mode === 'strike') {
    const m = MOVES[e.move];
    strike(monsters, e, m);
    if (t < e.until) return;
    e.vel.set(0, 0);
    if (e.left > 0 && !e.landed) {
      e.left--;
      setMode(e, 'tell', m.tell * 0.6, t);
      return;
    }
    setMode(e, 'recover', RECOVER, t);
    return;
  }
  if (hero.dead || dist > def.aggro) {
    e.mode = 'roam';
    standDown(e);
    e.wander(t);
    return;
  }
  if (!e.moves.length) {
    e.thinkShoot(t, dist);
    return;
  }
  e.mode = 'hunt';
  const move = !e.turn && dist < PRESS + e.radius + TURN_REACH ? monsters.takeTurn(e) : e.turn;
  if (move) {
    e.turn = true;
    const pick = pickMove(e, dist);
    if (pick) {
      e.move = pick;
      e.left = MOVES[pick].again ?? 0;
      setMode(e, 'tell', MOVES[pick].tell, t);
      e.vel.set(0, 0);
      monsters.warn(e, MOVES[pick]);
      return;
    }
    e.vel.set(dx, dz).multiplyScalar(def.chaseSpeed);
    return;
  }
  // Waiting their turn: keep close and circle, looking for a way in.
  const out = dist - (PRESS + e.radius), side = e.strafe;
  e.vel.set(dx * Math.sign(out) * Math.min(1, Math.abs(out)) - dz * side, dz * Math.sign(out) * Math.min(1, Math.abs(out)) + dx * side).normalize().multiplyScalar(dist > PRESS * 2 ? def.chaseSpeed : def.speed);
}

export { TURN_TAKERS };
