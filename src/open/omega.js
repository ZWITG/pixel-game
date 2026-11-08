import { NATIONS, nationAt } from './nations.js';
import { DOCTRINES } from './doctrines.js';

// The Omega Level: how the world sees the heroes. Every deed of destruction adds to it (DEEDS), and it
// climbs through phases (PHASES). It ratchets: lying low lets it fall back toward the start of the
// phase reached, never below it. Each phase changes how the world answers (see `update`):
//   1 Rumour   bounties are posted; towns that fear you charge more
//   2 Menace   townsfolk flee on sight; hunter squads track you through a nation's land
//   3 Scourge  warbands with siege engines come out; the weakest foes may break and run; cowed towns pay tribute
//   4, 5       nation armies and coalitions march on you (armies.js); Watchers from 3 (watchers.js)
// Being feared is power too: Wrath fills faster with every phase. `world.omega`; saved to `lumen.omega`.
export const PHASES = [
  { name: 'Unknown', from: 0, color: '#9a9aa8' },
  { name: 'Rumour', from: 60, color: '#e8c070' },
  { name: 'Menace', from: 180, color: '#ff9a4a' },
  { name: 'Scourge', from: 380, color: '#ff5a3a' },
  { name: 'Calamity', from: 620, color: '#d03a8a' },
  { name: 'Omega', from: 900, color: '#ffffff' },
];
export const MOST = 1000;
// What each deed adds. `scorch` is per burning cell of land, each quarter second (capped).
export const DEEDS = { soldier: 2, captain: 15, machine: 6, ruler: 40, house: 4, estate: 12, caravan: 3, stronghold: 25, nation: 80, scorch: 0.0005, watcher: 30, army: 40 };
const SAVE_KEY = 'lumen.omega';
const QUIET = 300, FADE = 0.2;           // seconds without a deed before it falls back, and how fast
const FELL = 10;                          // what a hero falling takes off it
const PRICE = 0.08;                       // dearer per phase in the markets
const WRATH = 0.08;                       // more Wrath per phase
const HUNT_EVERY = [0, 0, 240, 180, 150, 120], WAR_EVERY = [0, 0, 0, 300, 240, 180]; // seconds, by phase
const HUNT_NEAR = 70;                     // tiles out that a squad or warband comes in from
const TRIBUTE_EVERY = 600;                // seconds between one town's tributes
const FEAR_CHECK = 3, FEAR_ODDS = 0.25;   // the weakest foes, from Scourge: how often they may break and run

export default class Omega {
  constructor(world) {
    this.world = world;
    this.value = 0;
    this.phase = 0;
    this.quiet = 0;
    this.huntIn = HUNT_EVERY[2];
    this.warIn = WAR_EVERY[3];
    this.tributes = {};
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (saved) Object.assign(this, { value: saved.value ?? 0, phase: saved.phase ?? 0 });
    } catch { /* a clean name */ }
    addEventListener('pagehide', () => this.save());
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ value: this.value, phase: this.phase }));
    } catch { /* it lasts for this visit */ }
  }

  get info() {
    return PHASES[this.phase];
  }

  // How far through the current phase, 0..1.
  get progress() {
    const next = PHASES[this.phase + 1];
    return next ? (this.value - this.info.from) / (next.from - this.info.from) : 1;
  }

  // A deed was done. With two heroes, each counts for a little less (their names spread together).
  deed(kind, times = 1) {
    const add = (DEEDS[kind] ?? 0) * times * (this.world.players.length > 1 ? 0.7 : 1);
    if (!add) return;
    this.value = Math.min(MOST, this.value + add);
    this.quiet = 0;
    while (this.phase < PHASES.length - 1 && this.value >= PHASES[this.phase + 1].from) this.rise();
  }

  rise() {
    this.phase++;
    const ph = this.info, hero = this.world.players[0];
    const words = ['', 'Bounties go up on every notice board with your face on them.', 'Townsfolk run when they see you, and hunters are sent after you.',
      'Warbands march with siege engines. The weak break and run from you.', 'The nations call up their armies.', 'Every nation left stands against you.'][this.phase];
    for (const p of this.world.players) {
      p.hud.message(`Omega: ${ph.name}. ${words}`, true, 5000);
      p.hud.flash(0.25);
    }
    this.world.realm?.say(`The world now calls you ${ph.name}.`, ph.color, hero.state.x, hero.state.z);
    this.save();
  }

  // A hero fell: the world thinks you beaten, a little.
  fell() {
    this.value = Math.max(PHASES[this.phase].from, this.value - FELL);
  }

  // Market prices for a hero: dearer the more they're feared.
  priceFactor() {
    return 1 + this.phase * PRICE;
  }

  wrathFactor() {
    return 1 + this.phase * WRATH;
  }

  // The weakest foes, from Scourge, may lose their nerve when a hero comes near.
  afraid(e, hero, t) {
    if (this.phase < 3 || !hero) return false;
    if (e.fleeUntil > t) return true;
    if (t < (e.fearAt ?? 0)) return false;
    e.fearAt = t + FEAR_CHECK;
    const weak = ['slime', 'sporeling', 'bat', 'puffcap', 'wisp', 'fireSlime', 'bandit', 'drowned'].includes(e.kind);
    if (!weak || Math.hypot(e.x - hero.state.x, e.z - hero.state.z) > 25 || Math.random() > FEAR_ODDS) return false;
    e.fleeUntil = t + 4;
    hero.hud.float('Flees!', e.x, e.group.position.y + 3, e.z, '#e8c070');
    return true;
  }

  // Townsfolk run from a hero they recognise, from Menace.
  scary(x, z) {
    // Places a power has filled with dread (a flood, a plague cloud, the dark): `world.terror` = [{ x, z, r, until }].
    const now = this.world.monsters.time;
    if (this.world.terror?.some((t) => t.until > now && Math.hypot(t.x - x, t.z - z) < t.r)) return true;
    return this.phase >= 2 && this.world.players.some((p) => !p.rooms.house && Math.hypot(p.state.x - x, p.state.z - z) < 16);
  }

  update(dt) {
    const { players, realm, monsters } = this.world;
    // Lying low: back toward the start of the phase, never below it.
    this.quiet += dt;
    if (this.quiet > QUIET) this.value = Math.max(PHASES[this.phase].from, this.value - FADE * dt);
    // Burning land adds a little, and only while it burns.
    if ((this.scorchIn = (this.scorchIn ?? 0) - dt) <= 0) {
      this.scorchIn = 0.25;
      let burning = 0;
      for (const c of this.world.scars.cells.values()) if (c.burn > 0 && c.owner && players.includes(c.owner)) burning++;
      if (burning) this.deed('scorch', Math.min(burning, 200));
    }
    const hero = players[0], n = nationAt(hero.state.x, hero.state.z);
    const standing = n && !this.world.nations.isFallen(n);
    // Hunters, then warbands with siege engines, sent into the nation's land the hero walks.
    if (this.phase >= 2 && standing && !hero.rooms.house) {
      if ((this.huntIn -= dt) <= 0) {
        this.huntIn = HUNT_EVERY[Math.min(this.phase, 5)];
        this.send(hero, n, 'hunt');
      }
      if (this.phase >= 3 && (this.warIn -= dt) <= 0) {
        this.warIn = WAR_EVERY[Math.min(this.phase, 5)];
        this.send(hero, n, 'warband');
      }
    }
    // Cowed towns pay to be left alone.
    if (this.phase >= 3) {
      for (const p of players) {
        const s = realm?.settlements.find((q) => q.owner !== 'hero' && q.owner !== 'free' && Math.hypot(q.x - p.state.x, q.z - p.state.z) < 60);
        if (!s || (this.tributes[s.id] ?? -1e9) > monsters.time - TRIBUTE_EVERY) continue;
        this.tributes[s.id] = monsters.time;
        const coin = Math.round(40 + s.pop * 0.15 * this.phase);
        p.bag.gold += coin;
        p.hud.message(`${s.name} pays you ${coin} gold to pass it by.`, true);
      }
    }
  }

  // A hunter squad (elite troops with one machine) or a warband (more troops, two machines).
  send(hero, n, kind) {
    const d = DOCTRINES[n.id], force = this.world.realm.of(n.id);
    if (!force || force.troops < 4) return;
    const big = kind === 'warband', count = big ? 8 : 4, machines = big ? [d.machine, n.id === 'aurel' ? 'trebuchet' : d.machine] : [d.machine];
    const a = Math.random() * 6.283, cx = hero.state.x + Math.cos(a) * HUNT_NEAR, cz = hero.state.z + Math.sin(a) * HUNT_NEAR;
    const m = this.world.monsters, danger = m.danger(cx, cz) + (big ? 1 : 2);
    for (let i = 0; i < count; i++) {
      const e = m.add(d.troops[i % d.troops.length], cx + (i % 4) * 3, cz + Math.floor(i / 4) * 3, danger, !big && i === 0);
      e.nation = n.id;
    }
    machines.forEach((kindOf, i) => {
      const e = m.add(kindOf, cx - 6 - i * 5, cz - 6, danger, false);
      e.nation = n.id;
    });
    force.troops = Math.max(0, force.troops - count);
    const nation = NATIONS.find((x) => x.id === n.id);
    for (const p of this.world.players) p.hud.message(big ? `A warband of ${nation.name} marches on you, with siege engines.` : `Hunters of ${nation.name} are on your trail.`, true, 4000);
  }
}
