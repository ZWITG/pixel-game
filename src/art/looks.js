// Color sets for voxel characters. Villagers pick one by name in data/npcs.js.
const base = { skin: '#ffcda2', eye: '#1a1c2c', belt: '#ffcd75', boots: '#3a2a1f' };

export const HERO_LOOK = {
  ...base,
  hair: '#5d6ee8',
  hairShine: '#8fa0ff',
  tunic: '#e04060',
  tunicShade: '#a02848',
  pants: '#333c57',
};

export const LOOKS = {
  elder: { ...base, hair: '#d8d8de', hairShine: '#ffffff', tunic: '#5b3a8e', tunicShade: '#3e2465', pants: '#3e2465', robe: true },
  merchant: { ...base, hair: '#7a4a2a', hairShine: '#a86a3a', tunic: '#38b764', tunicShade: '#257150', pants: '#5a3a22' },
  kid: { ...base, hair: '#ef7d57', hairShine: '#ffcd75', tunic: '#41a6f6', tunicShade: '#3b5dc9', pants: '#333c57', scale: 0.78 },
  guard: { ...base, hair: '#7a4a2a', hairShine: '#a86a3a', tunic: '#94b0c2', tunicShade: '#566c86', pants: '#333c57', belt: '#333c57', helmet: true },
};

export const SLIME_COLORS = {
  green: { main: '#38b764', shade: '#257150', shine: '#a7f070' },
  fire: { main: '#ef7d57', shade: '#b13e53', shine: '#ffcd75' },
};
