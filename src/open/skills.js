// Skills are learned by doing, not bought. A skill gathers hidden practice from the first
// try; it joins the Skills page when practice reaches its first level.
// `levels`: { at: practice needed, title } in order. Add a skill by adding an entry here.
export const SKILLS = {
  swimming: {
    name: 'Swimming',
    desc: 'Learned the hard way, one mouthful of lake at a time.',
    levels: [
      { at: 20, title: 'Paddler', perk: '8 seconds of breath' },
      { at: 60, title: 'Swimmer', perk: '16 seconds of breath, faster strokes' },
      { at: 140, title: 'Strong Swimmer', perk: '32 seconds of breath' },
      { at: 300, title: 'Lake Runner', perk: 'A full minute of breath' },
      { at: 600, title: 'Born of the Water', perk: 'Never run out of breath' },
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

  // Skills shown on the page: only the ones actually learned.
  learned() {
    return Object.keys(SKILLS).filter((id) => this.level(id) > 0).map((id) => {
      const skill = SKILLS[id], level = this.level(id), p = this.practice[id];
      const now = skill.levels[level - 1], next = skill.levels[level];
      return {
        name: skill.name, desc: skill.desc, level, title: now.title, perk: now.perk,
        next: next?.title ?? null, progress: next ? (p - now.at) / (next.at - now.at) : 1,
      };
    });
  }
}
