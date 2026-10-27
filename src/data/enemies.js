// Enemy types. Add a new enemy by adding an entry here (colors in art/looks.js).
// Speeds and ranges are in tiles (per second).
export const ENEMIES = {
  slime: {
    colors: 'green',
    hp: 3,
    damage: 1,
    speed: 1.9,
    chaseSpeed: 3.0,
    aggro: 5.5,
    radius: 0.33,
    xp: 4,
    minLevel: 1,
  },
  fireSlime: {
    colors: 'fire',
    hp: 6,
    damage: 2,
    speed: 2.2,
    chaseSpeed: 3.9,
    aggro: 7,
    radius: 0.33,
    xp: 10,
    minLevel: 3,
  },
};
