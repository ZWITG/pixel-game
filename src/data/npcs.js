// Villagers. `spot` is a named position from the village layout in world/generateWorld.js,
// `look` is a color set from art/sprites.js, and `shop` opens that shop after talking.
export const NPCS = [
  {
    id: 'elder',
    name: 'Elder Mirae',
    look: 'elder',
    spot: 'elder',
    lines: [
      'Welcome to Lumen Hollow, traveler.',
      'Since the Spirit Tree dimmed, slimes have crept out of the woods.',
      'Grow stronger. Perhaps one day you can rekindle its light.',
    ],
  },
  {
    id: 'mina',
    name: 'Mina',
    look: 'merchant',
    spot: 'merchant',
    shop: 'mina',
    lines: ["Hi there! Mina's Goods, best prices in the Hollow.", 'Have a look!'],
  },
  {
    id: 'pip',
    name: 'Pip',
    look: 'kid',
    spot: 'kid',
    lines: [
      "Did you know slimes drop coins? I'm saving up for a sword!",
      'Fire slimes only show up once you get tough. Mom says stay away from them.',
    ],
  },
  {
    id: 'bram',
    name: 'Guard Bram',
    look: 'guard',
    spot: 'guard',
    lines: [
      "Monsters can't get into the village. The old wards keep us safe.",
      "Out past the road, though, you're on your own.",
    ],
  },
];
