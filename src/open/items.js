import { LOOT } from '../data/items.js';

// Everything a hero can carry, and how to make it.
//  kind: 'material', 'gear' (worn in `slot`, gives `bonus`) or 'use' (`heal` or a timed `bonus`).
//  bonus names are read by body.js: force, guard, speed, health, carry, mass, breath.
//  icon: a name from ICONS in skillMap.js.
export const SLOTS = [
  { id: 'hands', name: 'Hands', icon: 'fist' },
  { id: 'body', name: 'Body', icon: 'vest' },
  { id: 'feet', name: 'Feet', icon: 'boot' },
  { id: 'charm', name: 'Charm', icon: 'ring' },
  { id: 'back', name: 'Back', icon: 'pack' },
];

const LOOT_ICONS = { gel: 'drop', ember: 'flame', pearl: 'gem', spore: 'cap', hide: 'hide', tusk: 'horn', dust: 'sparkle' };

export const ITEMS = {
  wood: { name: 'Wood', kind: 'material', weight: 1, color: '#c98f5a', icon: 'log' },
  stone: { name: 'Stone', kind: 'material', weight: 2, color: '#b7a9b4', icon: 'pebble' },
  iron: { name: 'Iron', kind: 'material', weight: 3, color: '#e8a06a', icon: 'ore' },
  // Trade goods: what markets and caravans deal in (economy.js). Iron, wood and stone double as goods.
  grain: { name: 'Grain', kind: 'material', weight: 1, color: '#e8c060', icon: 'sheaf', text: 'Sacks of grain. Every town eats.' },
  fish: { name: 'Fish', kind: 'material', weight: 1, color: '#8fd0e8', icon: 'fish', text: 'Salted fish.' },
  meat: { name: 'Meat', kind: 'material', weight: 1, color: '#d86a5a', icon: 'meat', text: 'Cured meat.' },
  tools: { name: 'Tools', kind: 'material', weight: 2, color: '#c9d4e2', icon: 'hammer', text: "Smiths' tools. Towns can't grow without them." },
  arms: { name: 'Arms', kind: 'material', weight: 3, color: '#e8e0f0', icon: 'sword', text: 'Blades and spearheads. Nations arm their soldiers with these.' },
  cloth: { name: 'Cloth', kind: 'material', weight: 1, color: '#d8b0e8', icon: 'vest', text: 'Bolts of woven cloth.' },
  ale: { name: 'Ale', kind: 'material', weight: 2, color: '#e8a040', icon: 'jar', text: 'A cask of ale.' },
  furs: { name: 'Furs', kind: 'material', weight: 1, color: '#c8a888', icon: 'hide', text: 'Northern furs, dear in the south.' },
  wine: { name: 'Wine', kind: 'material', weight: 2, color: '#b03a5a', icon: 'flask', text: 'Wine from the warm lands. Cities pay well for it.' },

  salve: { name: 'Healing Salve', kind: 'use', weight: 1, color: '#7be36a', icon: 'jar', heal: 0.5, text: 'Heals half your health.' },
  tonic: { name: 'Ember Tonic', kind: 'use', weight: 1, color: '#ff8a3d', icon: 'flask', bonus: { force: 0.5 }, secs: 60, text: '+50% force for 60 seconds.' },
  draught: { name: 'Wisp Draught', kind: 'use', weight: 1, color: '#73eff7', icon: 'flask', bonus: { breath: 2, speed: 0.15 }, secs: 90, text: 'Triple breath and +15% speed for 90 seconds.' },

  knuckles: { name: 'Iron Knuckles', kind: 'gear', slot: 'hands', weight: 2, color: '#c9d4e2', icon: 'fist', bonus: { force: 0.25 }, text: '+25% force.' },
  tuskfist: { name: 'Tusk Fists', kind: 'gear', slot: 'hands', weight: 3, color: '#f4ecd8', icon: 'horn', bonus: { force: 0.6, mass: 10 }, text: '+60% force, +10 Mass.' },
  vest: { name: 'Hide Vest', kind: 'gear', slot: 'body', weight: 3, color: '#8a5a32', icon: 'vest', bonus: { guard: 0.2 }, text: 'Takes 20% off every hit.' },
  plate: { name: 'Iron Plate', kind: 'gear', slot: 'body', weight: 6, color: '#a4b0c0', icon: 'vest', bonus: { guard: 0.4, mass: 40, speed: -0.08 }, text: 'Takes 40% off every hit, +40 Mass, 8% slower.' },
  boots: { name: 'Trail Boots', kind: 'gear', slot: 'feet', weight: 2, color: '#b97a4a', icon: 'boot', bonus: { speed: 0.12 }, text: '+12% speed.' },
  charm: { name: 'Pearl Charm', kind: 'gear', slot: 'charm', weight: 1, color: '#e8dcff', icon: 'ring', bonus: { health: 20 }, text: '+20 health.' },
  frame: { name: 'Pack Frame', kind: 'gear', slot: 'back', weight: 2, color: '#d8a060', icon: 'pack', bonus: { carry: 40 }, text: 'Carry 40 more.' },
};
for (const [id, loot] of Object.entries(LOOT)) {
  ITEMS[id] = { name: loot.name, kind: 'material', weight: 1, color: loot.color, icon: LOOT_ICONS[id], text: loot.desc };
}

// `bench`: can only be made inside a house, where the chest's contents count too.
export const RECIPES = [
  { id: 'salve', needs: { gel: 2, spore: 1 } },
  { id: 'tonic', needs: { ember: 1, gel: 1 } },
  { id: 'draught', needs: { dust: 2, gel: 1 } },
  { id: 'knuckles', needs: { iron: 3, hide: 1 }, bench: true },
  { id: 'tuskfist', needs: { tusk: 2, iron: 4, hide: 2 }, bench: true },
  { id: 'vest', needs: { hide: 4, wood: 2 }, bench: true },
  { id: 'plate', needs: { iron: 8, hide: 3 }, bench: true },
  { id: 'boots', needs: { hide: 2, gel: 2 }, bench: true },
  { id: 'charm', needs: { pearl: 1, dust: 2 }, bench: true },
  { id: 'frame', needs: { wood: 10, hide: 2 }, bench: true },
];
