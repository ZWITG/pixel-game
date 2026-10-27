// Items you can buy. `once: true` items can only be bought one time.
export const ITEMS = {
  tonic: { name: 'Herb Tonic', price: 5, desc: 'Restores all hearts.', once: false, effect: { heal: true } },
  sword: { name: 'Steel Sword', price: 25, desc: '+1 attack power.', once: true, effect: { atk: 1 } },
  boots: { name: 'Wind Boots', price: 20, desc: 'Move 20% faster.', once: true, effect: { speed: 0.2 } },
  charm: { name: 'Heart Charm', price: 30, desc: '+1 max heart.', once: true, effect: { maxHp: 1 } },
};

// Monster drops. Picked up by walking over them; sell them to a shop that `buysLoot`.
export const LOOT = {
  gel: { name: 'Slime Gel', value: 2, color: '#7be36a', desc: 'Wobbly goo. Mina turns it into glue.' },
  ember: { name: 'Ember Core', value: 6, color: '#ff8a3d', desc: 'Still warm. Heats a stove for a week.' },
  pearl: { name: 'Slime Pearl', value: 15, color: '#e8dcff', desc: 'A rare gem that grows inside slimes.' },
};

export const SHOPS = {
  mina: { title: "Mina's Goods", items: ['tonic', 'sword', 'boots', 'charm'], buysLoot: true },
};
