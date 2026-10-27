// All art is drawn in code from these character grids, one character per pixel.
// '.' is transparent; other characters map to PALETTE colors.
export const PALETTE = {
  k: '#1a1c2c', // outline
  w: '#f4f4f4', // white
  s: '#ffcda2', // skin
  h: '#5d6ee8', // hair
  H: '#8fa0ff', // hair shine
  b: '#e04060', // tunic
  B: '#a02848', // tunic shade
  y: '#ffcd75', // gold
  Y: '#c08530', // gold shade
  p: '#333c57', // pants
  g: '#38b764', // slime
  l: '#a7f070', // slime shine / leaf shine
  d: '#257150', // slime shade
  e: '#14492e', // leaf outline
  f: '#257150', // leaf dark
  F: '#38b764', // leaf
  t: '#5a3a22', // trunk dark
  T: '#7a5230', // trunk
  m: '#c2c3c7', // white hair
  n: '#7a4a2a', // brown hair
  N: '#a86a3a', // brown hair shine
  o: '#ef7d57', // orange hair
  q: '#38b764', // green clothes
  Q: '#257150', // green clothes shade
  v: '#5b3a8e', // purple robe
  V: '#3e2465', // purple robe shade
  c: '#41a6f6', // blue clothes
  C: '#3b5dc9', // blue clothes shade
  a: '#94b0c2', // steel armor
  A: '#566c86', // steel armor shade
};

// Villagers reuse the hero's shape with swapped colors.
export const NPC_LOOKS = {
  elder: { h: 'm', H: 'w', b: 'v', B: 'V' },
  merchant: { h: 'n', H: 'N', b: 'q', B: 'Q' },
  kid: { h: 'o', H: 'y', b: 'c', B: 'C' },
  guard: { h: 'n', H: 'N', b: 'a', B: 'A', y: 'k' },
};

export function recolor(rows, map) {
  return rows.map((row) => [...row].map((ch) => map[ch] ?? ch).join(''));
}

const heroTop = [
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '..khhHhhhhHhhk..',
  '..khsssssssshk..',
  '..khskwsskwshk..',
  '..khsssssssshk..',
  '...kksssssskk...',
  '....kkkkkkkk....',
  '...kbbbbbbbbk...',
  '..ksbbbyybbbsk..',
  '..ksbbbbbbbbsk..',
  '...kBByyyyBBk...',
  '....kppkkppk....',
];

export const SPRITES = {
  hero_0: [...heroTop, '....kpk..kpk....', '....kkk..kkk....'],
  hero_1: [...heroTop, '...kpk....kpk...', '...kkk....kkk...'],

  slime_0: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkggggkk....',
    '...kgggggglgk...',
    '..kggggggggllk..',
    '..kggkwggkwggk..',
    '.kgggkkggkkgggk.',
    '.kggggggggggggk.',
    '.kggggggggggggk.',
    '..kddddddddddk..',
    '...kkkkkkkkkk...',
    '................',
  ],
  slime_1: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkggggglkk...',
    '.kkgggggggggllk.',
    '.kgggkwggkwgggk.',
    'kggggkkggkkggggk',
    'kggggggggggggggk',
    '.kddddddddddddk.',
    '..kkkkkkkkkkkk..',
    '................',
  ],

  tree: [
    '.....eeeeee.....',
    '...eefFFFffee...',
    '..efFFFFFFFffe..',
    '.efFFFlFFFFFffe.',
    '.efFFFFFFFlFffe.',
    'efFFlFFFFFFFfffe',
    'efFFFFFFFFFffffe',
    'effFFFFFFFfffffe',
    '.efffFFFfffffe..',
    '..eeffffffffee..',
    '....eeeeeeee....',
    '......tTTt......',
    '......tTTt......',
    '......tTTt......',
    '.....ttTTtt.....',
    '................',
  ],

  slash: [
    '................',
    '........ww......',
    '.........ww.....',
    '..........yw....',
    '..........yyw...',
    '...........yw...',
    '...........yyw..',
    '...........yyw..',
    '...........yyw..',
    '...........yyw..',
    '...........yw...',
    '..........yyw...',
    '..........yw....',
    '.........ww.....',
    '........ww......',
    '................',
  ],

  coin: [
    '..kkkk..',
    '.kyyYYk.',
    'kywyyyYk',
    'kywyyyYk',
    'kyyyyYYk',
    'kyyyyYYk',
    '.kYYYYk.',
    '..kkkk..',
  ],

  heart: [
    '.kk.kk.',
    'kbwkbbk',
    'kbbbbbk',
    'kbbbbbk',
    '.kbbbk.',
    '..kbk..',
    '...k...',
  ],
  heart_empty: [
    '.kk.kk.',
    'kppkppk',
    'kpppppk',
    'kpppppk',
    '.kpppk.',
    '..kpk..',
    '...k...',
  ],
};
