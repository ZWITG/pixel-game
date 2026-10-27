// Player stats live in the game registry so every scene (World, UI) can read
// them and react to 'changedata' events.
export const MAX_HEARTS = 15;

export const START_STATS = {
  hp: 5,
  maxHp: 5,
  atk: 1,
  atkBonus: 0,    // from gear
  speedBonus: 0,  // from gear, 0.2 = 20% faster
  level: 1,
  xp: 0,
  xpNext: 10,
  coins: 0,
  owned: [],      // ids of one-time items bought
  bag: {},        // monster drops carried: item id -> count
  dead: false,
};

export function resetStats(registry) {
  for (const [key, value] of Object.entries(START_STATS)) {
    registry.set(key, Array.isArray(value) ? [...value] : typeof value === 'object' ? { ...value } : value);
  }
}

// Adds XP and handles level ups. Returns how many levels were gained.
export function addXp(registry, amount) {
  let xp = registry.get('xp') + amount;
  let xpNext = registry.get('xpNext');
  let gained = 0;
  while (xp >= xpNext) {
    xp -= xpNext;
    xpNext = Math.floor(xpNext * 1.5);
    gained++;
  }
  if (gained) {
    const level = registry.get('level') + gained;
    const maxHp = Math.min(MAX_HEARTS, registry.get('maxHp') + gained);
    registry.set('level', level);
    registry.set('maxHp', maxHp);
    registry.set('hp', maxHp);
    registry.set('atk', 1 + Math.floor((level - 1) / 2));
  }
  registry.set('xpNext', xpNext);
  registry.set('xp', xp);
  return gained;
}
