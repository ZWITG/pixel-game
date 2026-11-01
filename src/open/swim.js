// Swimming. Water never stops you or sends you back: anyone can go anywhere. Skill decides how
// well it goes. Effort drains while you swim; run out and you tire, slow right down and get
// your breath back, and that struggle teaches more than easy strokes do.
export const DEEP = -0.9;          // ground lower than this is over the hero's head
export const SURFACE = -1.0;       // where a swimmer's feet hang
const EFFORT = [8, 14, 24, 40, 70, Infinity]; // seconds of swimming, by skill level (Endurance adds to this)
const SPEED = [4, 5, 6, 7, 8.5, 10];          // tiles per second, by skill level (Speed adds to this)
const SPRINT = 1.5;                // R2 in the water: faster, but tiring twice as quickly
const TIRED = 0.55;                // speed while getting your breath back
const REST = 0.5;                  // share of full effort to recover before you're fresh again
const RECOVER = 8;                 // seconds to recover from empty to full, in water
const FAIL_PRACTICE = 3;           // tiring out teaches more than the seconds it took
const TRIES = [
  'You flail and swallow half the lake, but stay afloat.',
  'Coughing and kicking. That went a little better.',
  'Almost had it. Your legs are starting to get the idea.',
];

export default class Swim {
  constructor(skills, body, hud) {
    this.skills = skills;
    this.body = body;
    this.hud = hud;
    this.breath = this.maxBreath;
    this.inWater = false;
    this.tired = false;
    this.fails = 0;
  }

  get level() {
    return this.skills.level('swimming');
  }

  speed(sprint) {
    return SPEED[this.level] * this.body.moveScale * (this.tired ? TIRED : sprint ? SPRINT : 1);
  }

  get maxBreath() {
    return EFFORT[this.level] * this.body.breathScale;
  }

  get flailing() {
    return this.inWater && (this.level === 0 || this.tired);
  }

  update(dt, ground, moving, sprint) {
    const max = this.maxBreath;
    if (ground >= DEEP) {
      this.inWater = false;
      this.tired = false;
      this.breath = Math.min(max, this.breath + dt * 3);
      this.hud.setBreath(null);
      return;
    }
    if (!this.inWater && this.level === 0 && this.fails === 0) this.hud.message('You can barely swim. Keep at it, or head for the shore.');
    this.inWater = true;
    this.skills.add('swimming', dt * (moving ? 1 : 0.4));
    if (max === Infinity) {
      this.hud.setBreath(null);
      return;
    }
    if (this.tired || !moving) {
      this.breath = Math.min(max, this.breath + (dt * max) / RECOVER);
      if (this.breath >= max * REST) this.tired = false;
    } else {
      this.breath -= dt * (sprint ? 2 : 1);
      if (this.breath <= 0) this.tire();
    }
    this.hud.setBreath(Math.max(0, this.breath) / max);
  }

  tire() {
    const before = this.level;
    this.tired = true;
    this.breath = 0;
    this.skills.add('swimming', FAIL_PRACTICE);
    // If this taught the skill, that news is the only message.
    if (this.level === before) this.hud.message(before === 0 ? TRIES[Math.min(this.fails, TRIES.length - 1)] : 'Out of breath. Ease off for a moment.');
    this.fails++;
  }
}
