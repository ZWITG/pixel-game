// What the hero's attributes do. Every effect of Strength, Speed and Endurance lives here,
// so a new system (combat, carrying, climbing walls) reads one number from one place.
export const ATTRIBUTES = {
  strength: { name: 'Strength', color: '#ff8a4c', icon: 'fist' },
  speed: { name: 'Speed', color: '#ffe27a', icon: 'boot' },
  endurance: { name: 'Endurance', color: '#7fe38a', icon: 'heart' },
  mass: { name: 'Mass', color: '#c9a0ff', icon: 'anvil', full: 300 },
};

const BASE_CLIMB = 1.0;  // steepest slope (rise per tile) a beginner can walk up

export default class Body {
  constructor(skills) {
    this.skills = skills;
    this.bag = null; // set once the bag exists: worn gear and potions add to the numbers below
    this.powers = null; // the hero's Conqueror: its nature and its active powers count here too
    this.nature = null; // how that Conqueror bends the shared skills (nature.js)
  }

  get conq() {
    return this.powers?.def ?? null;
  }

  bonus(name) {
    return (this.bag?.bonus(name) ?? 0) + (this.powers?.bonus(name) ?? 0);
  }

  get strength() { return this.skills.attribute('strength'); }
  get speed() { return this.skills.attribute('speed'); }
  get endurance() { return this.skills.attribute('endurance'); }
  get mass() { return this.skills.attribute('mass') + this.bonus('mass'); }

  // Movement, on land and in water. Early points of Speed add about 1.5% each, then it levels
  // off, so a sprint stays a sprint and Superspeed always has room above it.
  get moveScale() {
    const gain = (this.speed - 10) * 0.015;
    return (1 + gain / (1 + gain * 0.35)) * (1 + this.bonus('speed')) * (this.conq?.speed ?? 1);
  }
  // Every point of Endurance is 3% more breath.
  get breathScale() { return (1 + (this.endurance - 10) * 0.03) * (1 + this.bonus('breath')); }
  // Strength lets the hero haul up steeper ground.
  get climbLimit() { return BASE_CLIMB + (this.strength - 10) * 0.03 + (this.nature?.climb ?? 0); }
  // Mass is how much hero there is. Compared to a beginner's 60: it multiplies every blow,
  // spreads shockwaves, softens hits and shrugs off knockback, and the hero visibly grows.
  get massScale() { return this.mass / 60; }
  // The hero's level: their whole build, before gear. Monsters evolve against it.
  get level() { return this.skills.heroLevel(); }
  get heroScale() { return (1 + Math.min(0.6, (this.mass - 60) * 0.004)) * (this.conq?.size ?? 1); }
  // Heavy enough, and just landing from a jump shakes the ground. Tiles of reach, 0 for none.
  get stompReach() { return Math.max(0, (this.mass - 90) * 0.06); }
  get maxHealth() { return (20 + (this.endurance - 10) * 2.5) * (this.conq?.health ?? 1) + this.bonus('health'); }
  // Share of every hit that armor takes away.
  get guard() { return Math.min(0.7, this.bonus('guard')); }

  // Each point of Strength is 3% more force behind every blow (melee.js multiplies this)
  // and 2 more units of carrying.
  get damageScale() { return (1 + (this.strength - 10) * 0.03) * (1 + this.bonus('force')) * (this.conq?.force ?? 1); }
  // What's behind everything but the punch itself, which grows in stages of its own. Powers and
  // monsters are measured by this, so every Conqueror is on the same scale.
  get might() { return this.damageScale * this.massScale; }
  get carry() { return 20 + (this.strength - 10) * 2 + this.bonus('carry'); }
  // Strong legs jump higher: about 1.3 tiles at the start, past 3 when fully trained.
  get jumpSpeed() { return 7.5 + (this.strength - 10) * 0.05 + (this.speed - 10) * 0.03 + this.skills.level('jumping') * 0.4; }
  // Stronger arms snap back from a punch sooner.
  get punchTime() { return 0.34 / (1 + (this.strength - 10) * 0.01); }
}
