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
  if (fx.maxHp) {
    const maxHp = registry.get('maxHp') + fx.maxHp;
    registry.set('maxHp', maxHp);
    registry.set('hp', maxHp);
  }
  if (item.once) registry.set('owned', [...owned, id]);
  return { ok: true, msg: `Bought ${item.name}!` };
}
