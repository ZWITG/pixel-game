// The five Conquerors. A hero chooses one on starting a game, for good. Each has eight powers
// of its own: trained by using them, four worn at a time on the D-pad, swapped in the menu.
// Add a power by adding a line to `powers`; `kind` picks what it does (see powers.js).
//   power: blows as a share of the hero's force. reach, range, dist: tiles. secs, cool: seconds.
//   element: what the Conqueror's powers look like and do to the land (scars.js, elementFx.js).
//   status: 'burn' | 'freeze' | 'shock'. mastery: total ranks needed before it can be worn.
const RANKS = [10, 30, 70, 150, 320];
export const MAX_RANK = RANKS.length;

const P = (name, kind, mastery, cool, text, more) => ({ name, kind, mastery, cool, text, ...more });

export const CONQUERORS = {
  titan: {
    name: 'Titan',
    element: 'earth',
    tag: 'The mountain that walks. Nations break beneath its fists.',
    color: '#e8964a',
    emblem: 'titan',
    stats: { Might: 5, Speed: 2, Reach: 2, Toughness: 5 },
    health: 1.3, force: 1.1, speed: 0.92, size: 1.12, punchCap: 5, blow: true,
    extra: 'Only a Titan grows the punch up to Worldbreaker and earns Destructive Blow.',
    trains: { strength: 0.1, endurance: 0.03 },
    look: { crest: 'horns', bulk: 1.28, hair: '#22160e', hairHi: '#4a2e1a', skin: '#8f6c50', iris: '#ff8a2a', coat: '#463a30', coatDark: '#29211b', trim: '#14100c', scarf: '#8a3a12', pants: '#1e1a16', boot: '#16120e', wrap: '#5a4a3c', gold: '#ff8a2a', glow: '#ff9a3a' },
    powers: {
      quake: P('Ground Pound', 'nova', 0, 7, 'Slam the earth and throw back everything around you.', { power: 2.2, reach: 9, crater: 3 }),
      boulder: P('Boulder Hurl', 'bolt', 0, 5, 'Tear out a boulder and hurl it. It bursts where it lands.', { power: 3, speed: 36, blast: 6, crater: 2, range: 60, size: 1.6 }),
      charge: P('Titan Charge', 'dash', 1, 8, 'Run through everything in a straight line.', { power: 2.4, dist: 18, reach: 4 }),
      skin: P('Stone Skin', 'buff', 2, 18, 'Turn your skin to rock and shrug off blows.', { secs: 8, guard: 0.5 }),
      spikes: P('Earth Spikes', 'strike', 4, 9, 'A line of stone spears bursts up ahead of you.', { power: 1.8, reach: 4, count: 5, line: 7 }),
      well: P('Gravity Well', 'nova', 7, 14, 'Drag every enemy nearby in toward you.', { power: 0.8, reach: 18, pull: true }),
      colossus: P('Colossus', 'buff', 11, 30, 'Swell with power: every blow lands far harder.', { secs: 10, force: 0.8 }),
      fault: P('Fault Line', 'strike', 16, 24, 'Split the land open in a long, deep rift.', { power: 3, reach: 6, count: 9, line: 8, crater: 3 }),
    },
  },
  storm: {
    name: 'Stormcaller',
    element: 'storm',
    tag: 'The sky, turned against the living. It strikes, and the world goes white.',
    color: '#ffe25a',
    emblem: 'storm',
    stats: { Might: 3, Speed: 5, Reach: 5, Toughness: 2 },
    health: 0.95, force: 1.02, speed: 1.2, size: 0.98, punchCap: 1, flight: true,
    extra: 'Only a Stormcaller can evolve Jumping into Flight.',
    trains: { speed: 0.08, endurance: 0.03 },
    look: { crest: 'bolt', bulk: 1, hair: '#dfe4f8', hairHi: '#ffffff', skin: '#aab6cc', iris: '#fff06a', coat: '#121a40', coatDark: '#0a0f28', trim: '#05070f', scarf: '#2a3a90', pants: '#0c1024', boot: '#080b18', wrap: '#3a4670', gold: '#fff06a', glow: '#fff48a' },
    powers: {
      arc: P('Arc Bolt', 'bolt', 0, 2.5, 'A fast bolt that leaps to one more enemy.', { power: 1.9, speed: 76, range: 70, chain: 1, status: 'shock' }),
      gust: P('Gale Burst', 'nova', 0, 7, 'A ring of wind blasts enemies away.', { power: 0.9, reach: 12 }),
      thunder: P('Thunderstrike', 'strike', 1, 6, 'Call lightning down on your target.', { power: 3, reach: 6, count: 1, status: 'shock' }),
      surge: P('Storm Surge', 'dash', 2, 6, 'Become lightning for a moment and flash ahead.', { power: 1.5, dist: 24, reach: 3 }),
      chain: P('Chain Lightning', 'bolt', 4, 9, 'Lightning jumps from enemy to enemy.', { power: 1.6, speed: 90, range: 60, chain: 5, status: 'shock' }),
      field: P('Lightning Field', 'strike', 7, 15, 'Bolts rain down all around your target.', { power: 1.6, reach: 5, count: 7, scatter: 14, status: 'shock' }),
      cloak: P('Static Cloak', 'buff', 11, 18, 'Shock everything that comes close.', { secs: 10, aura: 7, dps: 0.7, status: 'shock', speed: 0.2 }),
      tempest: P('Tempest', 'zone', 16, 26, 'A storm follows you, tearing at all around it.', { reach: 15, secs: 7, dps: 1.2, follow: true, status: 'shock' }),
    },
  },
  void: {
    name: 'Voidwalker',
    element: 'void',
    tag: 'What remained when the light died. It is always hungry.',
    color: '#b06aff',
    emblem: 'void',
    stats: { Might: 4, Speed: 4, Reach: 3, Toughness: 2 },
    health: 0.9, force: 1.12, speed: 1.14, size: 0.96, punchCap: 1, superspeed: true,
    extra: 'Only a Voidwalker can evolve Running into Superspeed.',
    trains: { speed: 0.05, endurance: 0.05 },
    look: { crest: 'hood', bulk: 0.96, hair: '#0a0612', hairHi: '#3a1a6a', skin: '#7c6a88', iris: '#d05aff', coat: '#1a1026', coatDark: '#0c0714', trim: '#050308', scarf: '#2c1250', pants: '#0a0710', boot: '#07050c', wrap: '#241a30', gold: '#b06aff', glow: '#c87aff' },
    powers: {
      step: P('Shadow Step', 'dash', 0, 4, 'Vanish, and appear further on. Nothing can touch you.', { dist: 20, blink: true }),
      rend: P('Rending Arc', 'nova', 0, 4, 'A sweep of shadow cuts everything close by.', { power: 2, reach: 6 }),
      drain: P('Soul Drain', 'nova', 1, 10, 'Tear out life nearby and take it for yourself.', { power: 1.2, reach: 10, drain: 0.5 }),
      lance: P('Void Lance', 'bolt', 2, 6, 'A spear of nothing, passing through every enemy.', { power: 2.2, speed: 64, range: 70, pierce: true }),
      shades: P('Summon Shades', 'orbit', 4, 16, 'Shades circle you and strike what comes near.', { power: 1.1, count: 3, secs: 12 }),
      veil: P('Veil', 'buff', 7, 16, 'Fade half out of the world: fast and hard to hurt.', { secs: 5, guard: 0.6, speed: 0.4 }),
      rift: P('Rift', 'zone', 11, 18, 'Open a hole that drags enemies in and eats them.', { reach: 9, secs: 5, dps: 1.3, pull: true, at: 'target' }),
      reap: P('Reaping Hour', 'strike', 16, 28, 'Death falls on every enemy you can see.', { power: 3.5, reach: 3, each: 34 }),
    },
  },
  ember: {
    name: 'Emberlord',
    element: 'fire',
    tag: 'The end of every city. Where it walks, only ash remains.',
    color: '#ff5a2a',
    emblem: 'ember',
    stats: { Might: 5, Speed: 3, Reach: 4, Toughness: 3 },
    health: 1, force: 1.14, speed: 1, size: 1, punchCap: 1,
    extra: 'Everything an Emberlord burns keeps burning.',
    trains: { strength: 0.06, speed: 0.03, endurance: 0.02 },
    look: { crest: 'flame', bulk: 1.08, hair: '#1a0a06', hairHi: '#7a1c0a', skin: '#5c2a1e', iris: '#ffc23a', coat: '#1e100c', coatDark: '#100806', trim: '#050202', scarf: '#6a1a0a', pants: '#140a08', boot: '#0c0604', wrap: '#3a1a10', gold: '#ff7a2a', glow: '#ff6a1a' },
    powers: {
      fireball: P('Fireball', 'bolt', 0, 3, 'Throw a ball of flame that bursts on impact.', { power: 1.6, speed: 46, range: 60, blast: 5, status: 'burn', size: 1.1 }),
      wave: P('Flame Wave', 'nova', 0, 8, 'A ring of fire rolls out and sets foes alight.', { power: 1.3, reach: 11, status: 'burn' }),
      stride: P('Burning Stride', 'buff', 1, 14, 'Every step leaves a trail of fire.', { secs: 8, trail: true, dps: 0.8, speed: 0.15 }),
      wall: P('Firewall', 'zone', 2, 12, 'Set the ground ablaze where you aim.', { reach: 9, secs: 7, dps: 1, status: 'burn', at: 'target' }),
      cloak: P('Ember Cloak', 'buff', 4, 18, 'Wreathe yourself in flame. Touching you burns.', { secs: 10, aura: 6, dps: 0.9, status: 'burn', guard: 0.2 }),
      rain: P('Cinder Rain', 'strike', 7, 15, 'Burning stones fall all around your target.', { power: 1.5, reach: 5, count: 8, scatter: 15, status: 'burn', crater: 1 }),
      meteor: P('Meteor', 'strike', 11, 22, 'Bring a falling star down on one spot.', { power: 6, reach: 13, count: 1, wait: 1, crater: 5, status: 'burn' }),
      supernova: P('Supernova', 'nova', 16, 40, 'Burn like a sun. Nothing near you survives.', { power: 5, reach: 26, crater: 6, status: 'burn' }),
    },
  },
  frost: {
    name: 'Frostwarden',
    element: 'ice',
    tag: 'The last winter, given a body. All things stop before it.',
    color: '#8fe0ff',
    emblem: 'frost',
    stats: { Might: 3, Speed: 3, Reach: 4, Toughness: 4 },
    health: 1.2, force: 1, speed: 1, size: 1.02, punchCap: 1,
    extra: 'A frozen enemy can do nothing at all.',
    trains: { endurance: 0.08, strength: 0.03 },
    look: { crest: 'ice', bulk: 1.1, tail: true, hair: '#cfe8f4', hairHi: '#ffffff', skin: '#9ec2d4', iris: '#7ff0ff', coat: '#1a3650', coatDark: '#0e2034', trim: '#071220', scarf: '#2a6a90', pants: '#0e1c2c', boot: '#16304a', wrap: '#6a9ab4', gold: '#8fe0ff', glow: '#9ff4ff' },
    powers: {
      shards: P('Ice Shards', 'bolt', 0, 3, 'A fan of shards that chill what they hit.', { power: 0.9, speed: 58, range: 50, count: 3, spread: 0.22, status: 'freeze', chill: 0.7 }),
      flash: P('Flash Freeze', 'nova', 0, 10, 'Everything around you stops dead, frozen solid.', { power: 0.7, reach: 10, status: 'freeze', chill: 2.5 }),
      wall: P('Ice Wall', 'wall', 1, 12, 'Raise a wall of ice between you and them.', { count: 7, secs: 9 }),
      armor: P('Frost Armor', 'buff', 2, 18, 'A shell of ice takes the worst of every hit.', { secs: 10, guard: 0.45, aura: 4, dps: 0.3, status: 'freeze', chill: 0.6 }),
      lance: P('Ice Lance', 'bolt', 4, 7, 'A long spear of ice that pierces all in its path.', { power: 2.6, speed: 70, range: 75, pierce: true, status: 'freeze', chill: 1 }),
      field: P('Glacial Field', 'zone', 7, 15, 'Freeze the ground. Enemies on it can barely move.', { reach: 11, secs: 7, dps: 0.5, status: 'freeze', chill: 0.8, at: 'target' }),
      avalanche: P('Avalanche', 'strike', 11, 18, 'A wall of ice crashes down the line ahead of you.', { power: 2, reach: 5, count: 7, line: 7, status: 'freeze', chill: 1.2 }),
      zero: P('Absolute Zero', 'nova', 16, 36, 'All warmth leaves the world around you.', { power: 3, reach: 24, status: 'freeze', chill: 5 }),
    },
  },
};

// Every power as a skill, so it trains by use and shapes the body like any other practice.
export const POWER_SKILLS = Object.fromEntries(Object.entries(CONQUERORS).flatMap(([cid, c]) => Object.entries(c.powers).map(([pid, p]) => [`${cid}.${pid}`, {
  name: p.name,
  color: c.color,
  trains: c.trains,
  power: true,
  levels: RANKS.map((at, i) => ({ at, title: `Rank ${i + 2}`, icon: 'drop' })),
}])));

// Icons, on a 24 by 24 grid.
export const ICONS = {
  bolt: 'M21 3 9 7l3 2-9 9 2 2 9-9 2 3z',
  nova: 'M12 1l2 7 5-5-3 6 7-1-6 4 6 4-7-1 3 6-5-5-2 7-2-7-5 5 3-6-7 1 6-4-6-4 7 1-3-6 5 5z',
  strike: 'M14 1 5 13h6l-2 10 10-13h-6z',
  dash: 'M4 4h4l8 8-8 8H4l8-8zm9 0h4l7 8-7 8h-4l7-8z',
  buff: 'M12 1l9 4v6c0 6-4 10-9 12-5-2-9-6-9-12V5z',
  zone: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  orbit: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm16 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9 17a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  wall: 'M2 22 5 8l3 6 3-13 3 13 3-6 3 14z',
  titan: 'M2 21 9 7l3 5 3-8 7 17z',
  storm: 'M14 1 5 13h6l-2 10 10-13h-6z',
  void: 'M12 2a10 10 0 1 0 8 16A8 8 0 0 1 12 2z',
  ember: 'M13 1.500s1.200 4.300-1.800 7.300S6 13.800 6 16.800a6.200 6.200 0 0 0 12.400.200c0-3.500-2.300-6.300-3.200-8.500-.2 1.700-.8 2.800-1.900 3.300.8-3.600.6-7.700-.3-10.300z',
  frost: 'M11 1h2v5l3-3 1.500 1.500L13 9v2h2l4.500-4.500L21 8l-3 3h5v2h-5l3 3-1.500 1.500L15 13h-2v2l4.500 4.500L16 21l-3-3v5h-2v-5l-3 3-1.500-1.500L11 15v-2H9l-4.500 4.500L3 16l3-3H1v-2h5L3 8l1.500-1.500L9 11h2V9L6.500 4.500 8 3l3 3z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3h2v12H5V10zm2 0h6V7a3 3 0 0 0-6 0z',
};
export const svg = (name, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
