// Each Conqueror's own three branches: which powers and which boughs of the Spirit Tree grow from
// each, and which shared boughs it doesn't grow at all (`drop`; the skill still trains and keeps
// its levels, its tree just doesn't show it). The Conqueror updates add new powers to these.
// Pure data, from docs/combat-upgrade-plan.md section 5.
const B = (id, name, color, text, powers, boughs) => ({ id, name, color, text, powers, boughs });

export const BRANCHES = {
  titan: {
    drop: ['swimming'],
    list: [
      B('mountain', 'Mountain', '#d8b07a', 'Armour, footing and sensing through the ground: Stone Mail, Mountain Form, Grounded, Seismic Sense.', ['skin', 'colossus'], ['climbing', 'fighting']),
      B('quake', 'Quake', '#ff8a2a', 'Breaking the land: columns, spears, sand and rifts, the Blow and the Upheaval.', ['quake', 'spikes', 'well', 'fault'], ['punching', 'blow', 'jumping', 'titan.demolition']),
      B('forge', 'Forge', '#ff5a3a', 'Stone, iron and fire: slabs hurled and ridden, iron bent, magma raised.', ['boulder', 'charge', 'ironbend', 'magma'], ['running', 'mining', 'woodcutting']),
    ],
  },
  storm: {
    drop: ['climbing'],
    list: [
      B('thunder', 'Thunder', '#ffe25a', 'Bolts, spears and beams, and the Charge that leaps between foes.', ['arc', 'thunder', 'chain', 'field'], ['punching', 'fighting', 'storm.conductance']),
      B('sky', 'Sky', '#9fd0ff', 'The storm overhead: clouds, cyclones, flight, the Stormwyrm.', ['gust', 'tempest'], ['jumping', 'flight', 'swimming']),
      B('tempest', 'Tempest', '#c8a8ff', 'Becoming lightning: the flash-step, the living current, magnetism and plasma.', ['surge', 'cloak', 'magnet', 'plasma'], ['running', 'mining', 'woodcutting']),
    ],
  },
  void: {
    drop: ['swimming', 'climbing'],
    list: [
      B('legion', 'Legion', '#b06aff', 'The fallen who answer you, and how many: Rise, the Hollow Gate, Amalgam.', ['rend', 'gate', 'amalgam'], ['fighting', 'void.harvest']),
      B('dominion', 'Dominion', '#8a5ad8', 'Command over the dead: orders, the Grave Tide, Husk Burst, the Reaping Mark.', ['shades', 'veil', 'rift', 'reap'], ['mining', 'woodcutting']),
      B('hollow', 'Hollow', '#d08aff', 'Your own void craft: the Soul Lance, Soul Drain, the Shade Swap and the Shade Run.', ['step', 'lance', 'drain'], ['running', 'superspeed', 'jumping', 'punching']),
    ],
  },
  ember: {
    drop: ['swimming'],
    list: [
      B('pyre', 'Pyre', '#ff5a2a', 'Fire that brands, and the Brands set off: Flame Fist, Ignite, the Pyre Serpent.', ['fireball', 'wave', 'cloak'], ['punching', 'fighting', 'ember.pyromancy']),
      B('sun', 'Sun', '#ffd27a', 'Heat that builds into a sun of your own: Meteor, Sunlance, Blue Inferno, Supernova.', ['meteor', 'sunlance', 'blue', 'supernova'], ['jumping', 'mining']),
      B('cinder', 'Cinder', '#ff8a4a', 'Fire as movement and walls: Jet Burst, Flare Wall, Inferno Pillar.', ['stride', 'wall', 'rain'], ['running', 'climbing', 'woodcutting']),
    ],
  },
  frost: {
    drop: ['running'],
    list: [
      B('forge', 'Frostforge', '#bfeaff', 'Ice made into weapons and armour: the forge, shards, armour, a mirror of yourself.', ['flash', 'shards', 'armor', 'mirror'], ['punching', 'fighting']),
      B('glacier', 'Glacier', '#8fe0ff', 'Ice as land: walls, hail, rime and moving glaciers, the sea itself frozen.', ['wall', 'lance', 'field', 'avalanche', 'zero'], ['swimming', 'climbing', 'mining']),
      B('stillness', 'Stillness', '#e4f6ff', 'All things stopping: the Crystal Prison, Shatter, and time itself.', ['prison'], ['jumping', 'woodcutting', 'frost.stillness']),
    ],
  },
};

// The branch a power or bough belongs to, for a Conqueror.
export function branchOf(conq, id) {
  return BRANCHES[conq]?.list.find((b) => b.powers.includes(id) || b.boughs.includes(id)) ?? null;
}

// A Conqueror's powers, branch by branch; any not placed in a branch come last.
export function powerOrder(conq, powers) {
  const placed = (BRANCHES[conq]?.list ?? []).flatMap((b) => b.powers).filter((id) => id in powers);
  return [...placed, ...Object.keys(powers).filter((id) => !placed.includes(id))];
}

// The boughs a Conqueror's tree shows, branch by branch, from those it could grow.
export function boughOrder(conq, ids) {
  const own = BRANCHES[conq];
  if (!own) return ids;
  const kept = ids.filter((id) => !own.drop.includes(id)), placed = own.list.flatMap((b) => b.boughs).filter((id) => kept.includes(id));
  return [...placed, ...kept.filter((id) => !placed.includes(id))];
}
