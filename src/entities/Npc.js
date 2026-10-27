import { LOOKS } from '../art/looks.js';
import { makeHumanoid } from '../render/models.js';

// A villager that stands in place and can be talked to. Data comes from data/npcs.js.
export default class Npc {
  constructor(game, def, spot) {
    this.def = def;
    this.model = makeHumanoid(LOOKS[def.look]);
    this.group = this.model.group;
    this.group.position.set(spot.tx + 0.5, 0, spot.ty + 0.5);
    game.scene.add(this.group);
    this.radius = 0.3;
    this.phase = Math.random() * Math.PI * 2;
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  // Solid area so the hero and monsters walk around villagers.
  rect() {
    return { x0: this.x - 0.25, x1: this.x + 0.25, z0: this.z - 0.25, z1: this.z + 0.25 };
  }

  face(x, z) {
    this.group.rotation.y = Math.atan2(x - this.x, z - this.z);
  }

  animate(t) {
    const breathe = Math.sin(t * 2 + this.phase);
    this.model.root.position.y = Math.max(0, breathe) * 0.015;
    this.model.arms[0].rotation.x = breathe * 0.08;
    this.model.arms[1].rotation.x = -breathe * 0.08;
    this.model.head.rotation.y = Math.sin(t * 0.5 + this.phase) * 0.25;
  }
}
