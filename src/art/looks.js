// Color sets for voxel characters. Villagers pick one by name in data/npcs.js.
const base = { skin: '#ffcda2', eye: '#1a1c2c', belt: '#ffcd75', boots: '#3a2a1f' };

export const HERO_LOOK = {
  ...base,
  cape: '#b13e53',
  capeShade: '#7a2a3e',
  pauldron: '#94b0c2',
  spiky: true,
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
  smith: { ...base, skin: '#e0a878', hair: '#2b2f45', hairShine: '#566c86', tunic: '#5a3a22', tunicShade: '#3a2a1f', pants: '#333c57', belt: '#94b0c2', apron: '#3a2a1f', beard: '#2b2f45', scale: 1.08 },
  bard: { ...base, hair: '#ffcd75', hairShine: '#fff3c0', tunic: '#b13e53', tunicShade: '#73eff7', pants: '#257179', hat: '#257179' },
};

export const SLIME_COLORS = {
  green: { main: '#38b764', shade: '#257150', shine: '#a7f070' },
  fire: { main: '#ef7d57', shade: '#b13e53', shine: '#ffcd75' },
};
