// Swimming. Deep water always lets you in; what changes is how long you last.
// Run out of breath and you wash back to the last dry ground, a little wiser.
export const DEEP = -0.9;          // ground lower than this is over the hero's head
const BREATH = [4, 8, 16, 32, 60, Infinity]; // seconds, by skill level (Endurance adds to this)
const SPEED = [1.6, 2.6, 3.6, 4.6, 5.6, 7];  // tiles per second, by skill level (Speed adds to this)
const FAIL_PRACTICE = 3;           // a failed attempt teaches more than the seconds it took
const TRIES = [
  'You flail, swallow half the lake, and wash ashore.',
  'Coughing on the sand. That went a little better.',
  'Almost had it. Your legs are starting to get the idea.',
];

export default class Swim {
  constructor(skills, body, hud) {
    this.skills = skills;
    this.body = body;
    this.hud = hud;
    this.breath = this.maxBreath;
    this.inWater = false;
    this.fails = 0;
    this.land = null;
  }

  get level() {
    return this.skills.level('swimming');
  }

  get speed() {
    return SPEED[this.level] * this.body.moveScale;
  }

  get maxBreath() {
    return BREATH[this.level] * this.body.breathScale;
  }

  get flailing() {
    return this.inWater && this.level === 0;
  }

  // Returns the spot to wash up on when breath runs out, otherwise null.
  update(dt, x, z, ground, moving) {
    const max = this.maxBreath;
    if (ground >= DEEP) {
      if (ground > 0.5) this.land = { x, z };
      this.inWater = false;
      this.breath = Math.min(max, this.breath + dt * 3);
      this.hud.setBreath(null);
      return null;
    }
    if (!this.inWater && this.level === 0 && this.fails === 0) this.hud.message("You can't swim! Thrash your way back, or keep trying.");
    this.inWater = true;
    this.skills.add('swimming', dt * (moving ? 1 : 0.4));
    if (max === Infinity) {
      this.hud.setBreath(null);
      return null;
    }
    this.breath = Math.min(this.breath, max) - dt;
    this.hud.setBreath(this.breath / max);
    if (this.breath > 0) return null;

    // Out of breath: the failure itself is practice.
    const before = this.level;
    this.skills.add('swimming', FAIL_PRACTICE);
    // If this failure taught the skill, that news is the only message.
    if (this.level === before) this.hud.message(before === 0 ? TRIES[Math.min(this.fails, TRIES.length - 1)] : 'Out of breath. You drag yourself ashore.');
    this.fails++;
    this.inWater = false;
    this.breath = this.maxBreath;
    this.hud.setBreath(null);
    this.hud.gasp();
    return this.land;
  }
}
