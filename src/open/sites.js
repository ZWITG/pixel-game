import * as THREE from 'three';
import { VoxelBuilder, vmat } from '../render/voxel.js';
import { height, biome, PLACES, SPAWN, WORLD, TOWNS } from './terrain.js';
import { ITEMS } from './items.js';

// Places worth finding. Every category has its own goal and its own kind of reward, and a
// beam of its color marks each one from a long way off. Add a category by adding an entry.
//  goal: 'hold' (keep Cross down), 'clear' (beat what's there), 'boss', 'break' (punch it),
//        'survive' (stay in the ring), 'reach' (just get there), 'open', 'trade'.
//  reward: items, practice (skill id -> amount) and perk (a lasting bonus from body.js).
//  land(y): where one may stand. `first` of each kind is placed near the start.
export const CATEGORIES = {
  shrine: { name: 'Dim Shrine', color: '#9fe8ff', count: 12, goal: 'hold', secs: 4, verb: 'Rekindle', text: 'Hold to rekindle its flame', land: (y) => y > 6 && y < 220, reward: { perk: { health: 5 } } },
  camp: { name: 'Monster Camp', color: '#ff8a4c', count: 12, goal: 'clear', mobs: ['slime', 'boar', 'fireSlime', 'puffcap'], size: 5, text: 'Defeat everything in the camp', land: (y) => y > 4 && y < 160, reward: { items: { hide: 3, tusk: 1, gel: 3 } } },
  den: { name: 'Elder Den', color: '#ff5a5a', count: 7, goal: 'boss', mobs: ['boar', 'puffcap', 'fireSlime'], text: 'Slay the Elder that lairs here', land: (y) => y > 10 && y < 240, reward: { items: { tusk: 3, pearl: 1 }, perk: { force: 0.03 } } },
  vault: { name: 'Sealed Vault', color: '#c9a0ff', count: 9, goal: 'break', hits: 24, text: 'Punch through the seal stones', land: (y) => y > 5 && y < 200, reward: { items: { iron: 6, pearl: 1, dust: 2 } } },
  vein: { name: 'Crystal Vein', color: '#7fe3c0', count: 10, goal: 'break', hits: 16, text: 'Smash the crystal for its ore', land: (y) => y > 30 && y < 400, reward: { items: { iron: 12, stone: 6 }, practice: { mining: 25 } } },
  trial: { name: 'Trial Ring', color: '#ffe27a', count: 7, goal: 'survive', secs: 30, verb: 'Begin the trial', text: 'Stay in the ring and survive', land: (y) => y > 5 && y < 150, reward: { practice: { fighting: 60 }, perk: { guard: 0.01 } } },
  cairn: { name: 'Summit Cairn', color: '#f3ead8', count: 8, goal: 'reach', text: 'Climb to the very top', steep: 9, land: (y) => y > 220 && y < 900, reward: { practice: { climbing: 80 }, perk: { carry: 10 } } },
  wreck: { name: 'Sunken Cache', color: '#5fd8f0', count: 7, goal: 'hold', secs: 3, verb: 'Dive', text: 'Dive down and pull it up', land: (y) => y < -4 && y > -30, reward: { items: { pearl: 2, dust: 2 }, practice: { swimming: 60 } } },
  hermit: { name: 'Hermit Camp', color: '#8fd86a', count: 8, goal: 'trade', pay: { wood: 8, stone: 4 }, verb: 'Trade', text: 'Bring 8 Wood and 4 Stone', land: (y) => y > 5 && y < 180, reward: { items: { salve: 3, tonic: 1 } } },
  cave: { name: 'Cave', color: '#b08cff', count: 9, goal: 'cave', verb: 'Enter the cave', text: 'Go in and find its treasure', steep: 9, land: (y) => y > 15 && y < 300, reward: { items: { pearl: 1, iron: 5, dust: 2 }, perk: { health: 3 } } },
  bandit: { name: 'Bandit Camp', color: '#ff6f6f', count: 0, goal: 'clear', mobs: ['chief', 'bandit', 'bandit', 'bandit', 'bandit', 'bandit', 'bandit'], size: 7, built: true, text: 'Drive out the bandits', reward: { items: { iron: 4, hide: 4, tusk: 1, tonic: 1 } } },
  keep: { name: 'Ruined Keep', color: '#c9bcc4', count: 0, goal: 'clear', mobs: ['boar', 'fireSlime', 'puffcap', 'fireSlime'], size: 9, built: true, text: 'Clear the ruins of what nests there', reward: { items: { iron: 8, pearl: 2 }, perk: { force: 0.02 } } },
  cache: { name: 'Lost Cache', color: '#ffb547', count: 12, goal: 'open', verb: 'Open', text: 'Open the old chest', land: (y) => y > 3 && y < 260, reward: { items: { salve: 1, iron: 2, wood: 4 } } },
};

const SAVE_KEY = 'lumen.sites';
const SEEN_AT = 70, REACH = 6, SHOW_PROP = 450, FIRST_FROM = 160, FIRST_TO = 520, SPACING = 140;
const SAFE = 280;            // no sites in the middle of the Hollow
const SURVIVE_RING = 40;     // tiles
const WAVE_EVERY = 6;
const SCALE = 3;

function prop(key, color) {
  const b = new VoxelBuilder(), stone = '#8e8490', wood = '#7a5230';
  const pile = (n, r, c) => {
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, d = r * (0.4 + (i % 3) * 0.3);
      b.box(Math.cos(a) * d, 0.2 + (i % 2) * 0.1, Math.sin(a) * d, 0.4, 0.4, 0.4, c, 0.08);
    }
  };
  if (key === 'shrine') {
    b.box(0, 0.15, 0, 1.6, 0.3, 1.6, stone, 0.05).box(0, 0.7, 0, 0.5, 0.9, 0.5, '#a89aa4', 0.05).box(0, 1.3, 0, 0.8, 0.25, 0.8, stone, 0.05).box(0, 1.55, 0, 0.3, 0.3, 0.3, color);
  } else if (key === 'camp') {
    for (const [x, z] of [[-1.2, 0.4], [1, -0.8]]) b.box(x, 0.4, z, 1, 0.8, 1, '#8a5a32', 0.08).box(x, 0.95, z, 0.6, 0.4, 0.6, '#6a4428', 0.08);
    b.box(0, 1.1, 1, 0.1, 2.2, 0.1, wood).box(0.3, 1.9, 1, 0.6, 0.45, 0.04, color).box(0, 0.1, 0, 0.6, 0.15, 0.6, '#3a2c30').box(0, 0.3, 0, 0.3, 0.3, 0.3, '#ff8a4c');
  } else if (key === 'den') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 5, h = 0.8 + (i % 3) * 0.5;
      b.box(Math.cos(a) * 1.8, h / 2, Math.sin(a) * 1.8, 0.8, h, 0.8, stone, 0.08);
    }
    b.box(0, 0.25, 0, 0.5, 0.5, 0.6, '#e4dccb').box(-0.25, 0.6, 0, 0.1, 0.4, 0.1, '#e4dccb').box(0.25, 0.6, 0, 0.1, 0.4, 0.1, '#e4dccb');
  } else if (key === 'vault') {
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(x, 0.8, z, 0.5, 1.6, 0.5, stone, 0.06).box(x, 1.2, z, 0.52, 0.2, 0.52, color);
    b.box(0, 0.1, 0, 2.6, 0.2, 2.6, '#6a5a64', 0.04).box(0, 0.5, 0, 1, 0.6, 1, color, 0.05);
  } else if (key === 'vein') {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.1, d = 0.3 + i * 0.13, h = 2.2 - i * 0.16;
      b.box(Math.cos(a) * d, h / 2, Math.sin(a) * d, 0.42, h, 0.42, i % 2 ? color : '#c8fff0', 0.05);
    }
  } else if (key === 'trial') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.28;
      b.box(Math.cos(a) * 3.2, 0.6, Math.sin(a) * 3.2, 0.4, 1.2, 0.4, i % 3 ? stone : color, 0.05);
    }
    b.box(0, 0.06, 0, 1.2, 0.12, 1.2, color);
  } else if (key === 'cairn') {
    [1, 0.75, 0.5, 0.3].forEach((w, i) => b.box(0, 0.25 + i * 0.45, 0, w, 0.45, w, i % 2 ? '#c9bcc4' : stone, 0.06));
    b.box(0, 2.3, 0, 0.07, 1, 0.07, wood).box(0.25, 2.6, 0, 0.5, 0.3, 0.03, color);
  } else if (key === 'wreck') {
    b.box(0, 0.5, 0, 0.12, 1, 0.12, wood).box(0, 0.1, 0, 0.6, 0.3, 0.6, '#d0344a').box(0, 1, 0, 0.3, 0.3, 0.3, color);
  } else if (key === 'hermit') {
    b.box(0, 0.5, 0, 1.6, 1, 1.4, '#c9b89e', 0.08).box(0, 1.15, 0, 1.2, 0.35, 1.1, '#8a7a5e', 0.08).box(0, 1.4, 0, 0.7, 0.25, 0.7, '#8a7a5e', 0.08).box(0, 0.35, 0.72, 0.4, 0.7, 0.03, '#3a2c30');
    pile(5, 1.6, wood);
  } else if (key === 'cave') {
    // A rock arch around a dark mouth.
    b.box(0, 1.1, -0.3, 2.8, 2.2, 1.4, '#5a5260', 0.1).box(0, 0.8, 0.42, 1.4, 1.6, 0.05, '#0c0a12', 0).box(-1.4, 0.7, 0.2, 0.6, 1.4, 0.8, stone, 0.1).box(1.4, 0.9, 0.2, 0.6, 1.8, 0.8, stone, 0.1).box(0, 2.3, 0.1, 2.2, 0.5, 1, stone, 0.1);
    pile(4, 1.8, stone);
  } else {
    b.box(0, 0.3, 0, 1.1, 0.6, 0.7, '#8a5a30', 0.05).box(0, 0.72, 0, 1.14, 0.24, 0.74, '#6a4428').box(0, 0.5, 0.37, 0.2, 0.25, 0.04, color);
    pile(4, 1, stone);
  }
  return b.build();
}

export default class Sites {
  constructor(scene, monsters, work, players) {
    Object.assign(this, { scene, monsters, work, players });
    let seed = 2741;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const done = new Set(this.load());
    this.list = [];
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      for (let n = 0; n < cat.count; n++) {
        const spot = this.find(cat, rand, n === 0);
        if (!spot) continue;
        this.list.push({ id: `${key}${n}`, key, cat, ...spot, done: done.has(`${key}${n}`), seen: false, hits: 0, held: 0, mobs: null, timer: 0, runner: null, wave: 0, mesh: null });
      }
    }
    for (const T of TOWNS) {
      if (!CATEGORIES[T.kind]) continue;
      const id = `${T.kind}-${T.name}`, cat = { ...CATEGORIES[T.kind], name: T.name };
      this.list.push({ id, key: T.kind, cat, x: T.x, y: T.y, z: T.z, done: done.has(id), seen: false, hits: 0, held: 0, mobs: null, timer: 0, runner: null, wave: 0, mesh: null });
    }
    // One beam per site, all in one draw.
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 500, 6, 1, true).translate(0, 250, 0);
    this.beams = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }), this.list.length);
    this.beams.frustumCulled = false;
    const m = new THREE.Matrix4(), c = new THREE.Color();
    this.list.forEach((s, i) => {
      s.index = i;
      this.beams.setMatrixAt(i, s.done ? m.makeScale(0, 0, 0) : m.makeTranslation(s.x, s.y, s.z));
      this.beams.setColorAt(i, c.set(s.cat.color));
    });
    scene.add(this.beams);
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY)) ?? [];
    } catch {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.list.filter((s) => s.done).map((s) => s.id)));
    } catch { /* private window: lasts this session only */ }
  }

  find(cat, rand, first) {
    for (let t = 0; t < 900; t++) {
      const near = first && t < 300, a = rand() * 6.28, d = FIRST_FROM + rand() * (FIRST_TO - FIRST_FROM);
      const x = near ? SPAWN.x + Math.cos(a) * d : 300 + rand() * (WORLD - 600), z = near ? SPAWN.z + Math.sin(a) * d : 300 + rand() * (WORLD - 600);
      const y = height(x, z);
      if (!cat.land(y) || Math.hypot(x - PLACES.hollow.x, z - PLACES.hollow.z) < SAFE) continue;
      if (y > 0 && Math.max(Math.abs(height(x + 8, z) - y), Math.abs(height(x, z + 8) - y)) > (cat.steep ?? 5)) continue; // not on a cliff face
      if (Math.hypot(x - PLACES.spire.x, z - PLACES.spire.z) < 260 || biome(x, z)[0] === undefined) continue;
      if (TOWNS.some((T) => Math.hypot(x - T.x, z - T.z) < T.r + 60)) continue;
      if (this.list.some((s) => Math.hypot(s.x - x, s.z - z) < SPACING)) continue;
      return { x, y: Math.max(y, 0), z };
    }
    return null;
  }

  // What's on offer right here for the Cross button, if anything.
  spot(p) {
    const s = p.site;
    if (!s || s.done || p.siteDist > REACH + 2) return null;
    const { goal, verb } = s.cat;
    if (goal === 'hold') return { label: verb, site: s, held: true };
    if (goal === 'open' || goal === 'trade' || goal === 'cave') return { label: verb, site: s };
    if (goal === 'survive' && !s.timer) return { label: verb, site: s };
    return null;
  }

  use(p, site) {
    const { cat } = site, { bag, hud } = p;
    if (cat.goal === 'open') this.finish(site, p);
    else if (cat.goal === 'trade') {
      const short = Object.entries(cat.pay).some(([id, n]) => bag.count(id, false) < n);
      if (short) return hud.message(cat.text);
      for (const [id, n] of Object.entries(cat.pay)) bag.spend(id, n);
      this.finish(site, p);
    } else if (cat.goal === 'survive') {
      site.timer = cat.secs;
      site.runner = p;
      site.wave = 0;
      hud.message('The ring wakes. Stay inside!', true);
    }
    return undefined;
  }

  // A blow landed nearby: seals and crystals take it, more from a bigger punch.
  struck(x, z, reach, stage, p) {
    for (const s of this.list) {
      if (s.done || s.cat.goal !== 'break' || Math.hypot(s.x - x, s.z - z) > Math.max(reach, 2) + 5) continue;
      s.hits += 1 + stage;
      this.work.burst(s.x, s.y + 2, s.z, [s.cat.color, '#ffffff'], 10, 6);
      if (s.hits >= s.cat.hits) this.finish(s, p);
    }
  }

  finish(s, p) {
    s.done = true;
    s.timer = 0;
    this.hideBeam(s);
    if (s.mesh) s.mesh.material.color.set('#6a6470');
    const near = this.players.filter((h) => h === p || Math.hypot(h.state.x - s.x, h.state.z - s.z) < 120);
    for (const h of near) this.reward(h, s);
    this.save();
  }

  hideBeam(s) {
    this.beams.setMatrixAt(s.index, new THREE.Matrix4().makeScale(0, 0, 0));
    this.beams.instanceMatrix.needsUpdate = true;
  }

  reward(p, s) {
    const { items = {}, practice = {}, perk = {} } = s.cat.reward, { bag, hud } = p, said = [];
    for (const [id, n] of Object.entries(items)) {
      bag.items[id] = (bag.items[id] ?? 0) + n; // rewards are earned, so they never go to waste
      said.push(`${ITEMS[id].name} ${n}`);
    }
    for (const [id, n] of Object.entries(practice)) {
      p.skills.add(id, n);
      said.push(`${id} practice`);
    }
    for (const [name, n] of Object.entries(perk)) {
      bag.perks[name] = (bag.perks[name] ?? 0) + n;
      said.push(`lasting ${name} bonus`);
    }
    bag.save();
    hud.setBag(bag);
    hud.message(`${s.cat.name} done! ${said.join(', ')}`, true);
  }

  showProp(s) {
    if (s.mesh || s.cat.built) return;
    s.mesh = new THREE.Mesh(prop(s.key, s.cat.color), vmat({ color: s.done ? '#6a6470' : '#ffffff' }));
    s.mesh.castShadow = true;
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.scale.setScalar(SCALE);
    this.scene.add(s.mesh);
  }

  // Brings a site's monsters; the Elder of a den comes a form above what's around.
  rally(s) {
    const { cat } = s, count = cat.goal === 'boss' ? 1 : cat.size;
    s.mobs = [];
    for (let i = 0; i < count; i++) {
      const reach = s.cat.built ? 20 : 12, a = (i / count) * 6.28, x = s.x + Math.cos(a) * reach, z = s.z + Math.sin(a) * reach;
      const e = this.monsters.add(cat.mobs[i % cat.mobs.length], x, z, this.monsters.danger(s.x, s.z), cat.goal === 'boss');
      s.mobs.push(e);
    }
  }

  dismiss(s) {
    for (const e of s.mobs ?? []) if (this.monsters.list.includes(e)) this.monsters.removeEnemy(e);
    s.mobs = null;
  }

  arrow(p, s) {
    const a = Math.atan2(s.x - p.state.x, s.z - p.state.z) - p.world.viewYaw(p) + Math.PI;
    return ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  }

  status(s, p) {
    const { cat } = s;
    if (cat.goal === 'clear' || cat.goal === 'boss') return `${cat.text}: ${s.mobs ? this.alive(s).length : '?'} left`;
    if (cat.goal === 'break') return `${cat.text}: ${Math.min(100, Math.floor((s.hits / cat.hits) * 100))}%`;
    if (cat.goal === 'survive' && s.timer) return `Survive ${Math.ceil(s.timer)}s`;
    if (cat.goal === 'hold' && s.held) return `${cat.verb}... ${Math.floor((s.held / cat.secs) * 100)}%`;
    return cat.text;
  }

  alive(s) {
    return s.mobs.filter((e) => this.monsters.list.includes(e) && !e.dying);
  }

  updateSurvive(s, dt) {
    const p = s.runner, d = Math.hypot(p.state.x - s.x, p.state.z - s.z);
    if (d > SURVIVE_RING) {
      s.timer = 0;
      p.hud.message('You left the ring. The trial fades.');
      return;
    }
    s.timer -= dt;
    if ((s.wave -= dt) <= 0) {
      s.wave = WAVE_EVERY;
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * 6.28;
        this.monsters.add(['slime', 'boar', 'fireSlime'][i], s.x + Math.cos(a) * 20, s.z + Math.sin(a) * 20, this.monsters.danger(s.x, s.z), false);
      }
    }
    if (s.timer <= 0) this.finish(s, p);
  }

  update(dt) {
    const out = this.players.filter((p) => !p.rooms.house);
    for (const p of this.players) {
      let best = null, d = 1e9;
      for (const s of this.list) {
        if (s.done) continue;
        const k = Math.hypot(s.x - p.state.x, s.z - p.state.z);
        if (k < d) { d = k; best = s; }
      }
      p.site = best;
      p.siteDist = d;
      if (!best || p.rooms.house) {
        p.hud.setGoal(p.rooms.house?.goalText ?? '');
        continue;
      }
      if (d < SEEN_AT && !best.seen) {
        best.seen = true;
        p.hud.message(`${best.cat.name}: ${best.cat.text}`, true);
      }
      p.hud.setGoal(d < SEEN_AT ? `${best.cat.name}: ${this.status(best, p)}` : `${best.cat.name} ${this.arrow(p, best)} ${Math.round(d)} m`, best.cat.color);
      if (best.cat.goal === 'reach' && d < REACH) this.finish(best, p);
      if (best.cat.goal === 'hold') {
        const holding = d < REACH + 2 && (p.controls.padHeld.CROSS || p.controls.held.has('KeyE'));
        best.held = holding ? best.held + dt : 0;
        if (best.held >= best.cat.secs) this.finish(best, p);
      }
    }
    for (const s of this.list) {
      const near = out.reduce((m, p) => Math.min(m, Math.hypot(s.x - p.state.x, s.z - p.state.z)), 1e9);
      if (near < SHOW_PROP) this.showProp(s);
      if (s.done) continue;
      if (s.timer) this.updateSurvive(s, dt);
      if (s.cat.goal !== 'clear' && s.cat.goal !== 'boss') continue;
      if (!s.mobs && near < SEEN_AT) this.rally(s);
      else if (s.mobs && near > SEEN_AT * 3) this.dismiss(s);
      else if (s.mobs && !this.alive(s).length) {
        const p = out.reduce((a, b) => (Math.hypot(a.state.x - s.x, a.state.z - s.z) < Math.hypot(b.state.x - s.x, b.state.z - s.z) ? a : b));
        this.finish(s, p);
      }
    }
  }
}
