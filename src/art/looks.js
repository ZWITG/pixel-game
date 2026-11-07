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
  bandit: { ...base, skin: '#d8a078', hair: '#2b2f45', hairShine: '#566c86', tunic: '#5a4a38', tunicShade: '#3a2c30', pants: '#3a2a1f', belt: '#b13e53', hat: '#8e2036' },
  chief: { ...base, skin: '#d8a078', hair: '#7a2a3e', hairShine: '#b13e53', tunic: '#8e2036', tunicShade: '#5a1a26', pants: '#2b2f45', belt: '#ffcd75', beard: '#7a2a3e', scale: 1.15 },
  ruler: { ...base, skin: '#d8a078', hair: '#2b2f45', hairShine: '#566c86', tunic: '#a8201e', tunicShade: '#6e1414', pants: '#33263a', belt: '#e8c050', boots: '#3a2a1f' },
  thornqueen: { ...base, skin: '#c8d8b8', hair: '#141a14', hairShine: '#2a3a2a', tunic: '#1e3020', tunicShade: '#2a4a2c', pants: '#141a14', belt: '#5fae62' },
  legion: { ...base, hair: '#3a3028', hairShine: '#5a4a38', tunic: '#a8201e', tunicShade: '#6e1414', pants: '#33263a', belt: '#e8c050', helmet: true, pauldron: '#e8c050' },
  assassin: { ...base, skin: '#b89878', hair: '#141a14', hairShine: '#2a3a2a', tunic: '#2a3a24', tunicShade: '#1a2616', pants: '#141a14', belt: '#5fae62', hat: '#1a2616' },
  rime: { ...base, skin: '#a8c8d8', hair: '#dff4ff', hairShine: '#ffffff', tunic: '#4a7a9c', tunicShade: '#2a5070', pants: '#1a3048', belt: '#dff4ff', helmet: true, pauldron: '#8fe0ff' },
  cinder: { ...base, skin: '#7a4a38', hair: '#1a0a06', hairShine: '#7a1c0a', tunic: '#3a1c12', tunicShade: '#ff5a2a', pants: '#1e100c', belt: '#ff7a2a', apron: '#6a2a12' },
  // The Watchers: pale, robed, one colour of their own (`glow`) and one sign (`sign`).
  lantern: { ...base, skin: '#f4ecd8', hair: '#fff6d0', hairShine: '#ffffff', tunic: '#e8dcb8', tunicShade: '#b8a878', pants: '#8a7a58', belt: '#fff0a0', boots: '#6a5a3a', glow: '#fff0a0', sign: 'halo' },
  anchor: { ...base, skin: '#8a86a0', hair: '#1a1630', hairShine: '#3a2a6a', tunic: '#2a2440', tunicShade: '#1a1630', pants: '#141020', belt: '#a88aff', boots: '#141020', glow: '#a88aff', sign: 'rings' },
  hush: { ...base, skin: '#c8dce8', hair: '#e8f4ff', hairShine: '#ffffff', tunic: '#4a6a80', tunicShade: '#2a4458', pants: '#1a2a38', belt: '#8fd8ff', boots: '#1a2a38', glow: '#8fd8ff', sign: 'mask' },
  echo: { ...base, skin: '#d8d8e0', hair: '#c8c8d8', hairShine: '#ffffff', tunic: '#9a9aae', tunicShade: '#6a6a80', pants: '#3a3a4a', belt: '#e8e8ff', boots: '#3a3a4a', glow: '#e8e8ff', sign: 'shards' },
  thornwarden: { ...base, skin: '#6a3a3a', hair: '#2a1014', hairShine: '#5a1a22', tunic: '#3a1a1e', tunicShade: '#5a2028', pants: '#1e0e10', belt: '#e0445a', boots: '#1e0e10', glow: '#e0445a', sign: 'thorns' },
  drowned: { ...base, skin: '#7a9a7c', hair: '#2a3a24', hairShine: '#4a5a3a', tunic: '#3a4a34', tunicShade: '#26321f', pants: '#1e2a1a', belt: '#a8d84a' },
  bard: { ...base, hair: '#ffcd75', hairShine: '#fff3c0', tunic: '#b13e53', tunicShade: '#73eff7', pants: '#257179', hat: '#257179' },
};

export const SLIME_COLORS = {
  green: { main: '#38b764', shade: '#257150', shine: '#a7f070' },
  fire: { main: '#ef7d57', shade: '#b13e53', shine: '#ffcd75' },
};
