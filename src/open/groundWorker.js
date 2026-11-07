import { addDent } from './terrain.js';
import { addPlan, settlementPlan } from './cityPlan.js';
import { gridData, blockData, spotsData, grassData } from './ground.js';
import { FEATURES } from '../config/features.js';

// Builds land away from the game's frame, so walking and running never stall on it.
self.onmessage = ({ data: m }) => {
  if (m.type === 'dents') for (const d of m.list) addDent(...d);
  else if (m.type === 'plan') addPlan(settlementPlan(m.place, m.limit));
  else if (m.type === 'chunk') {
    const g = FEATURES.voxelWorld ? blockData(m.cx * 64, m.cz * 64, 64, m.step, true) : gridData(m.cx * 64, m.cz * 64, 64, m.step, true);
    const send = [g.pos, g.nor, g.bio, g.road, g.land, g.idx, g.cube, g.deep, g.water?.pos, g.water?.deep, g.water?.idx].filter(Boolean).map((a) => a.buffer);
    self.postMessage({ type: 'chunk', k: m.k, g, redo: m.redo }, send);
  } else if (m.type === 'spots') self.postMessage({ type: 'spots', cx: m.cx, cz: m.cz, s: spotsData(m.cx, m.cz) });
  else if (m.type === 'grass') {
    const g = grassData(m.cx, m.cz);
    self.postMessage({ type: 'grass', cx: m.cx, cz: m.cz, g, stamp: m.stamp }, [g.mats.buffer, g.cols.buffer]);
  }
};
