import { addDent } from './terrain.js';
import { addPlan, settlementPlan } from './cityPlan.js';
import { gridData, spotsData, grassData } from './ground.js';

// Builds land away from the game's frame, so walking and running never stall on it.
self.onmessage = ({ data: m }) => {
  if (m.type === 'dents') for (const d of m.list) addDent(...d);
  else if (m.type === 'plan') addPlan(settlementPlan(m.place, m.limit));
  else if (m.type === 'chunk') {
    const g = gridData(m.cx * 64, m.cz * 64, 64, m.step, true);
    self.postMessage({ type: 'chunk', k: m.k, g }, [g.pos.buffer, g.nor.buffer, g.bio.buffer, g.road.buffer, g.land.buffer, g.idx.buffer, g.deep.buffer]);
  } else if (m.type === 'spots') self.postMessage({ type: 'spots', cx: m.cx, cz: m.cz, s: spotsData(m.cx, m.cz) });
  else if (m.type === 'grass') {
    const g = grassData(m.cx, m.cz);
    self.postMessage({ type: 'grass', cx: m.cx, cz: m.cz, g, stamp: m.stamp }, [g.mats.buffer, g.cols.buffer]);
  }
};
