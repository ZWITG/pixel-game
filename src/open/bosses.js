import { height } from './terrain.js';

// Bosses: huge monsters that hold a lair and fight with powers rather than swipes. Each power
// shows its warning first, so all of them can be escaped. Below half health they enrage.
//   wave   rings along the ground: jump over them.
//   rain   marked spots erupt a moment later: get off the marks.
//   line   eruptions run along the ground straight at you: step aside.
//   volley shots fan out: roll through or stand behind something.
//   charge it thunders at you: roll aside or parry.
//   call   it summons help.
export const POWERS = {
  gravemaw: { color: '#ff7a3a', adds: 'golem', powers: ['wave', 'line', 'rain', 'call'] },
  mirewyrm: { color: '#a8d84a', adds: 'lurker', powers: ['volley', 'rain', 'line', 'call'] },
  frostwarden: { color: '#9fe8ff', adds: 'wraith', powers: ['volley', 'wave', 'rain', 'call'] },
  emberhorn: { color: '#ffb020', adds: 'scorpion', powers: ['charge', 'wave', 'rain', 'line'] },
};
const TELL = 1.1;            // seconds of warning before a power, shorter when enraged
const REST = 1.5;            // seconds open afterward
const ENRAGED = 0.5;         // share of health where it gets worse
const WAVE_REACH = 60;
const WAVE_SPEED = 45;       // tiles per second; matches how rings grow
const MARK_DELAY = 1;        // seconds before a marked spot goes off
const MARK_SIZE = 6;
const CHARGE_SPEED = 42;
const MOST_ADDS = 4;

export function armBoss(e, type, monsters) {
  const kit = POWERS[type];
  Object.assign(e, { kit, boss: true, mode: 'hunt', until: monsters.time + 2, next: 0, enraged: false, moves: [] });
  e.think = (t) => think(monsters, e, t);
}

function cast(monsters, e, power, angry) {
  const hero = e.foe, { kit } = e, y = e.group.position.y;
  if (!hero) return;
  const s = hero.state;
  if (power === 'wave') {
    for (let i = 0; i < (angry ? 3 : 2); i++) monsters.quake.after(i * 0.75, () => monsters.startWave(e, kit.color));
  } else if (power === 'rain') {
    const n = angry ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, d = i ? 4 + Math.random() * 22 : 0;
      monsters.mark(s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, MARK_SIZE, MARK_DELAY + i * 0.06, e, kit.color);
    }
  } else if (power === 'line') {
    const dx = s.x - e.x, dz = s.z - e.z, d = Math.hypot(dx, dz) || 1;
    for (const turn of angry ? [-0.3, 0, 0.3] : [0]) {
      const ax = (dx / d) * Math.cos(turn) - (dz / d) * Math.sin(turn), az = (dx / d) * Math.sin(turn) + (dz / d) * Math.cos(turn);
      for (let k = 1; k <= 12; k++) monsters.mark(e.x + ax * (e.radius + k * 7), e.z + az * (e.radius + k * 7), MARK_SIZE - 1, 0.5 + k * 0.09, e, kit.color);
    }
  } else if (power === 'volley') {
    const n = angry ? 24 : 14, base = Math.atan2(s.z - e.z, s.x - e.x);
    for (let i = 0; i < n; i++) {
      const a = base + ((i / n) - 0.5) * (angry ? 6.28 : 2.4);
      monsters.fireOrbFrom(e.x + Math.cos(a) * e.radius, y + 6, e.z + Math.sin(a) * e.radius, Math.cos(a), Math.sin(a), e);
    }
  } else if (power === 'call') {
    const near = monsters.list.filter((m) => !m.boss && Math.hypot(m.x - e.x, m.z - e.z) < 90).length;
    for (let i = 0; i < Math.min(angry ? 4 : 2, MOST_ADDS - near); i++) {
      const a = Math.random() * 6.28;
      monsters.add(kit.adds, e.x + Math.cos(a) * (e.radius + 8), e.z + Math.sin(a) * (e.radius + 8), monsters.danger(e.x, e.z), false);
    }
  } else if (power === 'charge') {
    const d = Math.hypot(s.x - e.x, s.z - e.z) || 1;
    e.vel.set((s.x - e.x) / d, (s.z - e.z) / d).multiplyScalar(CHARGE_SPEED);
    e.mode = 'charging';
    e.until = monsters.time + Math.min(1.6, d / CHARGE_SPEED + 0.3);
    e.landed = false;
    return;
  }
  e.mode = 'rest';
  e.until = monsters.time + (angry ? REST * 0.6 : REST);
}

function think(monsters, e, t) {
  const hero = monsters.player;
  if (hero.dead) {
    e.vel.set(0, 0);
    return;
  }
  const dist = Math.hypot(hero.x - e.x, hero.z - e.z), d = dist || 1;
  const angry = e.hp < e.maxHp * ENRAGED;
  if (angry && !e.enraged) {
    e.enraged = true;
    e.baseGlow.set(e.kit.color).multiplyScalar(0.4);
    monsters.roar(e);
  }
  if (e.mode === 'tell') {
    e.vel.set(0, 0);
    e.state = 'windup';
    if (t >= e.until) {
      e.state = 'roam';
      cast(monsters, e, e.power, angry);
    }
    return;
  }
  if (e.mode === 'charging') {
    if (!e.landed && dist < e.radius + 3 && e.foe) {
      e.landed = true;
      monsters.hurt(e.foe, e.def.damage * 2, e.x, e.z, { heavy: true, from: e });
    }
    if (t >= e.until) {
      e.vel.set(0, 0);
      e.mode = 'rest';
      e.until = t + REST;
    }
    return;
  }
  if (e.mode === 'rest') {
    e.vel.set(0, 0);
    if (t >= e.until) e.mode = 'hunt';
    return;
  }
  if (e.mode === 'reeling') {
    e.vel.set(0, 0);
    if (t >= e.until) e.mode = 'hunt';
    return;
  }
  e.vel.set((hero.x - e.x) / d, (hero.z - e.z) / d).multiplyScalar(dist > e.radius + 6 ? e.def.chaseSpeed : 0);
  if (t >= e.until) {
    e.power = e.kit.powers[e.next++ % e.kit.powers.length];
    e.mode = 'tell';
    e.until = t + TELL * (angry ? 0.7 : 1);
    monsters.warn(e, { heavy: true });
  }
}

// The ground under a mark, for where its eruption rises from.
export const markGround = (x, z) => Math.max(height(x, z), 0);
export { WAVE_REACH, WAVE_SPEED };
