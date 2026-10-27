// Villagers. `spot` is a named position from the village layout in world/generateWorld.js,
// `look` is a color set from art/looks.js, and `shop` opens that shop after talking.
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
    lines: [
      "Hi there! Mina's Goods, best prices in the Hollow.",
      "Got slime gel or other monster drops? I'll buy them. Just pick Sell!",
    ],
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
      'Watch for Thornback Boars. When one paws the ground, roll out of the way!',
    ],
  },
  {
    id: 'odo',
    name: 'Odo the Smith',
    look: 'smith',
    spot: 'smith',
    shop: 'odo',
    lines: [
      'Welcome to Market Row. Mind the sparks.',
      "Bring me coin and I'll forge you something that bites back. I buy boar hide and tusks, too.",
    ],
  },
  {
    id: 'lyra',
    name: 'Lyra the Bard',
    look: 'bard',
    spot: 'bard',
    lines: [
      'Ah, an audience! Have you heard the Ballad of the Dim Tree?',
      'Wisps drift where the Spirit Tree once glowed. They spit little stars. Roll right through them!',
      'And Puffcaps... squash one and two more pop out. Nature is generous, and rude.',
    ],
  },
];
