// Enemy types. Add a new enemy by adding an entry here (colors in art/looks.js).
// Speeds and ranges are in tiles (per second). `drops`: monster drops (data/items.js LOOT) and their chance.
export const ENEMIES = {
  slime: {
    name: 'Slime',
    colors: 'green',
    hp: 3,
    damage: 1,
    speed: 1.9,
    chaseSpeed: 3.0,
    aggro: 5.5,
    radius: 0.33,
    xp: 4,
    minLevel: 1,
    drops: [{ item: 'gel', chance: 0.6 }, { item: 'pearl', chance: 0.04 }],
  },
  fireSlime: {
    name: 'Fire Slime',
    colors: 'fire',
    hp: 6,
    damage: 2,
    speed: 2.2,
    chaseSpeed: 3.9,
    aggro: 7,
    radius: 0.33,
    xp: 10,
    minLevel: 3,
    drops: [{ item: 'ember', chance: 0.5 }, { item: 'gel', chance: 0.3 }, { item: 'pearl', chance: 0.08 }],
  },
};
