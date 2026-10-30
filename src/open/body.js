// What the hero's attributes do. Every effect of Strength, Speed and Endurance lives here,
// so a new system (combat, carrying, climbing walls) reads one number from one place.
export const ATTRIBUTES = {
  strength: { name: 'Strength', color: '#ff8a4c', icon: 'fist' },
  speed: { name: 'Speed', color: '#ffe27a', icon: 'boot' },
  endurance: { name: 'Endurance', color: '#7fe38a', icon: 'heart' },
};

const BASE_CLIMB = 1.0;  // steepest slope (rise per tile) a beginner can walk up

export default class Body {
  constructor(skills) {
    this.skills = skills;
  }

  get strength() { return this.skills.attribute('strength'); }
  get speed() { return this.skills.attribute('speed'); }
  get endurance() { return this.skills.attribute('endurance'); }

  // Movement: every point of Speed is 1.5% faster, on land and in water.
  get moveScale() { return 1 + (this.speed - 10) * 0.015; }
  // Every point of Endurance is 3% more breath.
  get breathScale() { return 1 + (this.endurance - 10) * 0.03; }
  // Strength lets the hero haul up steeper ground.
  get climbLimit() { return BASE_CLIMB + (this.strength - 10) * 0.03; }
  // The hero fills out as they get stronger.
  get heroScale() { return 1 + Math.min(0.2, (this.strength - 10) * 0.004); }

  // Strength's main jobs later, read by combat and inventory when they move to the open world:
  // each point is 3% more melee damage and 2 more units of carrying.
  get damageScale() { return 1 + (this.strength - 10) * 0.03; }
  get carry() { return 20 + (this.strength - 10) * 2; }
}
