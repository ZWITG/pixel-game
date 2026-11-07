import { POWER_SKILLS } from './conquerors.js';
import { DISCIPLINE_SKILLS } from './nature.js';

// Skills are learned by doing, not bought. A skill gathers hidden practice from the first
// try; its first node lights on the skill map when practice reaches level 1.
// Practice also shapes the body: `trains` says how much each attribute gains per point of
// practice, so doing a thing makes the hero better in general, not just at that thing.
// `levels`: { at: practice needed, title, icon }. Add a skill here, plus a bough in skillMap.js.
export const SKILLS = {
  ...POWER_SKILLS,
  ...DISCIPLINE_SKILLS,
  swimming: {
    name: 'Swimming',
    color: '#5fd8f0',
    trains: { endurance: 0.03, strength: 0.015, speed: 0.01 },
    levels: [
      { at: 20, title: 'Paddler', icon: 'drop' },
      { at: 60, title: 'Swimmer', icon: 'ripple' },
      { at: 140, title: 'Strong Swimmer', icon: 'wave' },
      { at: 300, title: 'Lake Runner', icon: 'crest' },
      { at: 600, title: 'Born of the Water', icon: 'fish' },
    ],
  },
  climbing: {
    name: 'Climbing',
    color: '#ff8a4c',
    trains: { strength: 0.04, endurance: 0.015 },
    levels: [
      { at: 15, title: 'Scrambler', icon: 'hold' },
      { at: 50, title: 'Hillwalker', icon: 'hill' },
      { at: 120, title: 'Climber', icon: 'peak' },
      { at: 260, title: 'Cliffhand', icon: 'peaks' },
      { at: 520, title: 'Mountain Born', icon: 'flag' },
    ],
  },
  running: {
    name: 'Running',
    color: '#ffe27a',
    trains: { speed: 0.03, endurance: 0.015, strength: 0.005 },
    levels: [
      { at: 30, title: 'Jogger', icon: 'boot' },
      { at: 90, title: 'Runner', icon: 'dash' },
      { at: 200, title: 'Sprinter', icon: 'wind' },
      { at: 420, title: 'Roadrunner', icon: 'bolt' },
      { at: 800, title: 'Windfoot', icon: 'star' },
    ],
  },
  // Superspeed can't be practised until Running is maxed; then it grows like any other skill.
  superspeed: {
    name: 'Superspeed',
    color: '#ff7ad9',
    trains: { speed: 0.05, endurance: 0.02 },
    levels: [
      { at: 6, title: 'Quickstep', icon: 'dash' },
      { at: 25, title: 'Blur', icon: 'wind' },
      { at: 70, title: 'Waterstrider', icon: 'wave' },
      { at: 180, title: 'Streak', icon: 'bolt' },
      { at: 400, title: 'Faster Than Sight', icon: 'comet' },
    ],
  },
  jumping: {
    name: 'Jumping',
    color: '#9fd0ff',
    trains: { speed: 0.02, strength: 0.02 },
    levels: [
      { at: 5, title: 'Hopper', icon: 'boot' },
      { at: 20, title: 'Leaper', icon: 'hill' },
      { at: 50, title: 'Bounder', icon: 'peak' },
      { at: 110, title: 'Skyvaulter', icon: 'dash' },
      { at: 220, title: 'Sky-Touched', icon: 'star' },
    ],
  },
  // Flight can't be practised until Jumping is maxed; then it grows like any other skill.
  flight: {
    name: 'Flight',
    color: '#fff0a0',
    trains: { speed: 0.03, endurance: 0.03 },
    levels: [
      { at: 8, title: 'Fledgling', icon: 'feather' },
      { at: 35, title: 'Glider', icon: 'wing' },
      { at: 90, title: 'Cloudrider', icon: 'cloud' },
      { at: 220, title: 'Skydancer', icon: 'comet' },
      { at: 480, title: 'Skyborn', icon: 'nova' },
    ],
  },
  // These levels are also the punch stages in melee.js, which need Strength as well.
  punching: {
    name: 'Punching',
    color: '#ff5a5a',
    trains: { strength: 0.08, endurance: 0.01, speed: 0.01 },
    levels: [
      { at: 15, title: 'Solid Punch', icon: 'fist' },
      { at: 50, title: 'Heavy Blow', icon: 'burst' },
      { at: 130, title: 'Shockwave', icon: 'quake' },
      { at: 300, title: 'Earthsplitter', icon: 'crack' },
      { at: 650, title: 'Worldbreaker', icon: 'nova' },
    ],
  },
  fighting: {
    name: 'Fighting',
    color: '#ff6fb0',
    trains: { endurance: 0.06, strength: 0.03, speed: 0.01 },
    levels: [
      { at: 20, title: 'Scrapper', icon: 'heart' },
      { at: 70, title: 'Brawler', icon: 'fist' },
      { at: 180, title: 'Veteran', icon: 'burst' },
      { at: 400, title: 'Monster Bane', icon: 'crack' },
      { at: 850, title: 'Living Siege', icon: 'nova' },
    ],
  },
  // Destructive Blow can't be practised until Punching is maxed.
  blow: {
    name: 'Destructive Blow',
    color: '#ffb020',
    trains: { strength: 0.1, endurance: 0.02 },
    levels: [
      { at: 4, title: 'Blast', icon: 'burst' },
      { at: 14, title: 'Detonation', icon: 'flame' },
      { at: 35, title: 'Devastation', icon: 'quake' },
      { at: 80, title: 'Cataclysm', icon: 'crack' },
      { at: 170, title: 'World Ender', icon: 'nova' },
    ],
  },
  woodcutting: {
    name: 'Woodcutting',
    color: '#8fd86a',
    trains: { strength: 0.05, endurance: 0.02 },
    levels: [
      { at: 12, title: 'Kindling Gatherer', icon: 'stump' },
      { at: 40, title: 'Woodcutter', icon: 'log' },
      { at: 100, title: 'Feller', icon: 'axe' },
      { at: 220, title: 'Forester', icon: 'pine' },
      { at: 450, title: 'Forest Breaker', icon: 'oak' },
    ],
  },
  mining: {
    name: 'Mining',
    color: '#c9a0ff',
    trains: { strength: 0.06, endurance: 0.015 },
    levels: [
      { at: 10, title: 'Stone Picker', icon: 'pebble' },
      { at: 35, title: 'Quarry Hand', icon: 'pick' },
      { at: 90, title: 'Miner', icon: 'ore' },
      { at: 200, title: 'Deep Miner', icon: 'gem' },
      { at: 420, title: 'Mountain Breaker', icon: 'anvil' },
    ],
  },
};

for (const [id, skill] of Object.entries(SKILLS)) skill.id = id;

export const ATTRIBUTE_START = 10;
// Mass isn't trained directly: it builds on a stronger, tougher body and on time spent fighting.
const MASS = { start: 60, strength: 1.5, endurance: 1.2, fighting: 0.3 };
// The body grows ever slower as the hero rises: practice still earns skill levels and power ranks
// at full rate, but only 1 / (1 + (level - 1) / LEVEL_PACE) of it builds Strength, Speed, Endurance
// and Mass, which are what the hero's level is made of. Raise LEVEL_PACE to level faster.
export const LEVEL_PACE = 3;
export const paceAt = (level) => 1 / (1 + Math.max(0, level - 1) / LEVEL_PACE);
const SAVE_EVERY = 2000; // ms; practice ticks every frame

export default class Skills {
  // onLevel(skill, level) when a level is reached; onGain(attribute, value) when an attribute
  // reaches a new whole number.
  constructor(onLevel, onGain, saveKey) {
    this.saveKey = saveKey;
    this.onLevel = onLevel;
    this.onGain = onGain;
    this.practice = {};
    this.trained = null;       // the share of practice that went into the body (see LEVEL_PACE)
    this.savedAt = 0;
    try {
      this.practice = JSON.parse(localStorage.getItem(saveKey)) ?? {};
      this.trained = JSON.parse(localStorage.getItem(`${saveKey}.trained`));
    } catch { /* no saved skills: start fresh */ }
    // Saves from before v0.31.1 put all practice into the body, so the hero keeps the level they had.
    this.trained ??= { ...this.practice };
    // Practice saves every couple of seconds; this catches the last of it when the page goes.
    addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  level(id) {
    const p = this.practice[id] ?? 0;
    return SKILLS[id].levels.filter((l) => p >= l.at).length;
  }

  // Attributes are worked out from trained practice, so they can never drift from what you've done.
  attribute(name) {
    if (name === 'mass') {
      return MASS.start + (this.attribute('strength') - ATTRIBUTE_START) * MASS.strength
        + (this.attribute('endurance') - ATTRIBUTE_START) * MASS.endurance + (this.trained.fighting ?? 0) * MASS.fighting;
    }
    let value = ATTRIBUTE_START;
    for (const [id, skill] of Object.entries(SKILLS)) value += (this.trained[id] ?? 0) * (skill.trains[name] ?? 0);
    return value;
  }

  // The hero's level: their whole build, before gear. Monsters evolve against it.
  heroLevel() {
    return 1 + Math.floor((this.attribute('mass') - MASS.start) / 18 + (this.attribute('speed') - ATTRIBUTE_START) / 10);
  }

  add(id, amount) {
    const skill = SKILLS[id], before = this.level(id);
    const whole = [...Object.keys(skill.trains), 'mass'].map((a) => [a, Math.floor(this.attribute(a))]);
    this.trained[id] = (this.trained[id] ?? 0) + amount * paceAt(this.heroLevel());
    this.practice[id] = (this.practice[id] ?? 0) + amount;
    const after = this.level(id);
    if (after > before) this.onLevel(skill, after);
    for (const [a, was] of whole) {
      const now = Math.floor(this.attribute(a));
      if (now > was) this.onGain(a, now);
    }
    if (performance.now() - this.savedAt > SAVE_EVERY) this.save();
  }

  save() {
    this.savedAt = performance.now();
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(this.practice));
      localStorage.setItem(`${this.saveKey}.trained`, JSON.stringify(this.trained));
    } catch { /* private window: skills last this session only */ }
  }

  // What the skill map draws for each skill. Hidden practice shows only as the next node's ring.
  all() {
    return Object.keys(SKILLS).map((id) => {
      const skill = SKILLS[id], level = this.level(id), p = this.practice[id] ?? 0;
      const from = level ? skill.levels[level - 1].at : 0, next = skill.levels[level];
      return { ...skill, id, level, progress: next ? (p - from) / (next.at - from) : 1 };
    });
  }
}
