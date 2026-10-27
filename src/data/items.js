// Items you can buy. `once: true` items can only be bought one time.
export const ITEMS = {
  tonic: { name: 'Herb Tonic', price: 5, desc: 'Restores all hearts.', once: false, effect: { heal: true } },
  sword: { name: 'Steel Sword', price: 25, desc: '+1 attack power.', once: true, effect: { atk: 1 } },
  boots: { name: 'Wind Boots', price: 20, desc: 'Move 20% faster.', once: true, effect: { speed: 0.2 } },
  charm: { name: 'Heart Charm', price: 30, desc: '+1 max heart.', once: true, effect: { maxHp: 1 } },
  blade: { name: 'Knight Blade', price: 70, desc: "+2 attack power. Odo's finest work.", once: true, effect: { atk: 2 } },
  vest: { name: 'Iron Vest', price: 45, desc: 'Take 1 less damage from every hit.', once: true, effect: { def: 1 } },
  greaves: { name: 'Swift Greaves', price: 35, desc: 'Move 15% faster. Rolls go further too.', once: true, effect: { speed: 0.15 } },
};

// Monster drops. Picked up by walking over them; sell them to a shop that `buysLoot`.
export const LOOT = {
  gel: { name: 'Slime Gel', value: 2, color: '#7be36a', desc: 'Wobbly goo. Mina turns it into glue.' },
  ember: { name: 'Ember Core', value: 6, color: '#ff8a3d', desc: 'Still warm. Heats a stove for a week.' },
  pearl: { name: 'Slime Pearl', value: 15, color: '#e8dcff', desc: 'A rare gem that grows inside slimes.' },
  spore: { name: 'Spore Cap', value: 3, color: '#e04060', desc: 'Puffs when squeezed. Smells like rain.' },
  hide: { name: 'Boar Hide', value: 5, color: '#8a5a32', desc: 'Tough and bristly. Odo makes vests from it.' },
  tusk: { name: 'Boar Tusk', value: 12, color: '#f4ecd8', desc: 'A curved tusk, sharp as a knife.' },
  dust: { name: 'Wisp Dust', value: 8, color: '#73eff7', desc: 'Glows faintly, even in daylight.' },
};

export const SHOPS = {
  mina: { title: "Mina's Goods", items: ['tonic', 'sword', 'boots', 'charm'], buysLoot: true },
  odo: { title: "Odo's Forge", items: ['blade', 'vest', 'greaves'], buysLoot: true },
};
