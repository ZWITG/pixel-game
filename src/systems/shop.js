import { MAX_HEARTS } from '../config/stats.js';

// Tries to buy an item and applies its effect. Returns { ok, msg }.
export function tryBuy(registry, id, item) {
  const owned = registry.get('owned');
  const fx = item.effect;
  if (item.once && owned.includes(id)) return { ok: false, msg: 'You already have that.' };
  if (registry.get('coins') < item.price) return { ok: false, msg: 'Not enough coins.' };
  if (fx.heal && registry.get('hp') >= registry.get('maxHp')) return { ok: false, msg: "You're already at full health." };
  if (fx.maxHp && registry.get('maxHp') >= MAX_HEARTS) return { ok: false, msg: 'Your hearts are already full.' };

  registry.set('coins', registry.get('coins') - item.price);
  if (fx.heal) registry.set('hp', registry.get('maxHp'));
  if (fx.atk) registry.set('atkBonus', registry.get('atkBonus') + fx.atk);
  if (fx.speed) registry.set('speedBonus', registry.get('speedBonus') + fx.speed);
  if (fx.def) registry.set('def', registry.get('def') + fx.def);
  if (fx.maxHp) {
    const maxHp = registry.get('maxHp') + fx.maxHp;
    registry.set('maxHp', maxHp);
    registry.set('hp', maxHp);
  }
  if (item.once) registry.set('owned', [...owned, id]);
  return { ok: true, msg: `Bought ${item.name}!` };
}

// Sells one monster drop from the bag. Returns { ok, msg }.
export function trySell(registry, id, item) {
  const bag = { ...registry.get('bag') };
  if (!bag[id]) return { ok: false, msg: 'You have none left.' };
  if (--bag[id] === 0) delete bag[id];
  registry.set('bag', bag);
  registry.set('coins', registry.get('coins') + item.value);
  return { ok: true, msg: `Sold ${item.name} for ${item.value}c.` };
}

export function bagCount(bag) {
  return Object.values(bag).reduce((sum, n) => sum + n, 0);
}

export function bagValue(bag, loot) {
  return Object.entries(bag).reduce((sum, [id, n]) => sum + n * loot[id].value, 0);
}

// Sells every monster drop in the bag.
export function sellAll(registry, loot) {
  const bag = registry.get('bag');
  const count = bagCount(bag), total = bagValue(bag, loot);
  if (!count) return { ok: false, msg: 'Nothing to sell.' };
  registry.set('bag', {});
  registry.set('coins', registry.get('coins') + total);
  return { ok: true, msg: `Sold ${count} drops for ${total}c.` };
}
