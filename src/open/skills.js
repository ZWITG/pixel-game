// Skills are learned by doing, not bought. A skill gathers hidden practice from the first
// try; its first node lights on the skill map when practice reaches level 1.
// Practice also shapes the body: `trains` says how much each attribute gains per point of
// practice, so doing a thing makes the hero better in general, not just at that thing.
// `levels`: { at: practice needed, title, icon }. Add a skill here, plus a bough in skillMap.js.
export const SKILLS = {
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
};

export const ATTRIBUTE_START = 10;
const SAVE_KEY = 'lumen.skills';
const SAVE_EVERY = 2000; // ms; practice ticks every frame

export default class Skills {
  // onLevel(skill, level) when a level is reached; onGain(attribute, value) when an attribute
  // reaches a new whole number.
  constructor(onLevel, onGain) {
    this.onLevel = onLevel;
    this.onGain = onGain;
    this.practice = {};
    this.savedAt = 0;
    try {
      this.practice = JSON.parse(localStorage.getItem(SAVE_KEY)) ?? {};
    } catch { /* no saved skills: start fresh */ }
  }

  level(id) {
    const p = this.practice[id] ?? 0;
    return SKILLS[id].levels.filter((l) => p >= l.at).length;
  }

  // Attributes are worked out from practice, so they can never drift from what you've done.
  attribute(name) {
    let value = ATTRIBUTE_START;
    for (const [id, skill] of Object.entries(SKILLS)) value += (this.practice[id] ?? 0) * (skill.trains[name] ?? 0);
    return value;
  }

  add(id, amount) {
    const skill = SKILLS[id], before = this.level(id);
    const whole = Object.keys(skill.trains).map((a) => [a, Math.floor(this.attribute(a))]);
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
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.practice));
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
