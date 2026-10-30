// Skills are learned by doing, not bought. A skill gathers hidden practice from the first
// try; its first node lights on the skill map when practice reaches level 1.
// `levels`: { at: practice needed, title } in order. Add a skill by adding an entry here.
export const SKILLS = {
  swimming: {
    name: 'Swimming',
    color: '#5fd8f0',
    levels: [
      { at: 20, title: 'Paddler', icon: 'drop' },
      { at: 60, title: 'Swimmer', icon: 'ripple' },
      { at: 140, title: 'Strong Swimmer', icon: 'wave' },
      { at: 300, title: 'Lake Runner', icon: 'crest' },
      { at: 600, title: 'Born of the Water', icon: 'fish' },
    ],
  },
};

const SAVE_KEY = 'lumen.skills';

export default class Skills {
  constructor(onLevel) {
    this.onLevel = onLevel; // (skill, level) when a level is reached; level 1 means just learned
    this.practice = {};
    try {
      this.practice = JSON.parse(localStorage.getItem(SAVE_KEY)) ?? {};
    } catch { /* no saved skills: start fresh */ }
  }

  level(id) {
    const p = this.practice[id] ?? 0;
    return SKILLS[id].levels.filter((l) => p >= l.at).length;
  }

  add(id, amount) {
    const before = this.level(id);
    this.practice[id] = (this.practice[id] ?? 0) + amount;
    const after = this.level(id);
    if (after > before) this.onLevel(SKILLS[id], after);
    this.save();
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.practice));
    } catch { /* private window: skills last this session only */ }
  }

  // What the skill map draws for one skill. Hidden practice shows only as the next node's ring.
  map(id) {
    const skill = SKILLS[id], level = this.level(id), p = this.practice[id] ?? 0;
    const from = level ? skill.levels[level - 1].at : 0, next = skill.levels[level];
    return { ...skill, id, level, progress: next ? (p - from) / (next.at - from) : 1 };
  }
}
