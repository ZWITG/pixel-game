// Enemy types. Add a new enemy by adding an entry here (and art in art/sprites.js).
export const ENEMIES = {
  slime: {
    texture: 'slime',
    tint: null,
    hp: 3,
    damage: 1,
    speed: 30,
    chaseSpeed: 48,
    aggro: 90,
    xp: 4,
    minLevel: 1,
  },
  fireSlime: {
    texture: 'slime',
    tint: 0xff7a55,
    hp: 6,
    damage: 2,
    speed: 36,
    chaseSpeed: 62,
    aggro: 110,
    xp: 10,
    minLevel: 3,
  },
};
