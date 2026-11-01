// The skill map: the Spirit Tree at night, drawn in pixels. Each skill is a bough of nodes that
// light up as levels are reached. Undiscovered boughs stay dark, with only their buds showing.
import { ATTRIBUTES } from './body.js';

const W = 520, H = 292;
const INK = '#0a0f22';
const REVEAL = 1.1; // seconds for the light to run out along a bough when the map opens

// 9 x 9 pixel icons for skill levels and attributes.
export const ICONS = {
  drop: ['....#....', '....#....', '...###...', '..#####..', '.#######.', '.###.###.', '.##.####.', '..#####..', '...###...'],
  ripple: ['.........', '..#####..', '.#.....#.', '#..###..#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..', '.........'],
  wave: ['.........', '.........', '.##...##.', '#..#.#..#', '....#....', '.##...##.', '#..#.#..#', '....#....', '.........'],
  crest: ['.....###.', '...##...#', '..#..##..', '.#..#..#.', '.#..##...', '#......##', '#..######', '.#......#', '..######.'],
  fish: ['.........', '..####..#', '.######.#', '#.#######', '#########', '.######.#', '..####..#', '.........', '.........'],
  hold: ['...##....', '..####...', '..#####..', '.######..', '.#######.', '.#######.', '..######.', '...####..', '.........'],
  hill: ['.........', '.........', '....##...', '...####..', '..######.', '.########', '#########', '#########', '.........'],
  peak: ['....#....', '...###...', '...###...', '..#####..', '..#####..', '.#######.', '.#######.', '#########', '.........'],
  peaks: ['.....#...', '....###..', '..#.###..', '.###.####', '.########', '#########', '#########', '#########', '.........'],
  flag: ['..####...', '..#####..', '..####...', '..#......', '..#......', '..#......', '.###.....', '#####....', '.........'],
  boot: ['..####...', '..####...', '..####...', '..####...', '..#####..', '..######.', '..#######', '..#######', '.........'],
  dash: ['.........', '####.....', '.....###.', '..######.', '.........', '.#######.', '.....##..', '####.....', '.........'],
  wind: ['.....##..', '.......#.', '#######..', '.........', '########.', '........#', '.......#.', '.........', '.........'],
  bolt: ['.....##..', '....##...', '...##....', '..#####..', '....##...', '...##....', '..##.....', '.##......', '.........'],
  star: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.........'],
  fist: ['.........', '.#.#.#.#.', '.#######.', '########.', '#.######.', '########.', '.######..', '..####...', '.........'],
  axe: ['..###....', '.#####.#.', '.######..', '..####...', '....##...', '.....##..', '......##.', '.......##', '.........'],
  log: ['.........', '.########', '#.......#', '#.###...#', '#.#.#...#', '#.###...#', '#.......#', '.########', '.........'],
  stump: ['.........', '.........', '..#####..', '.#.....#.', '.#######.', '.#.#.#.#.', '.#.#.#.#.', '#########', '.........'],
  pine: ['....#....', '...###...', '..#####..', '...###...', '..#####..', '.#######.', '#########', '....#....', '....#....'],
  oak: ['..#####..', '.#######.', '#########', '#########', '.#######.', '...###...', '....#....', '....#....', '...###...'],
  pebble: ['.........', '.........', '...###...', '..#####..', '.#######.', '.#######.', '..#####..', '.........', '.........'],
  pick: ['..#####..', '.##..####', '#.....###', '.....#.##', '....#...#', '...#.....', '..#......', '.#.......', '#........'],
  ore: ['...###...', '..#####..', '.##.####.', '.######.#', '#.####.##', '####.####', '.#######.', '..#####..', '.........'],
  gem: ['.........', '..#####..', '.#.#.#.#.', '#########', '.#.#.#.#.', '..#.#.#..', '...###...', '....#....', '.........'],
  anvil: ['.........', '#########', '.########', '...####..', '...###...', '...###...', '.#######.', '#########', '.........'],
  burst: ['....#....', '.#..#..#.', '..#.#.#..', '...###...', '#########', '...###...', '..#.#.#..', '.#..#..#.', '....#....'],
  quake: ['.........', '..#####..', '.#.....#.', '#..###..#', '#.#####.#', '#..###..#', '.#.....#.', '..#####..', '.........'],
  crack: ['#########', '####.####', '###..####', '####..###', '#####.###', '####..###', '###..####', '####.####', '#########'],
  nova: ['#...#...#', '.#.###.#.', '..#####..', '.#######.', '#########', '.#######.', '..#####..', '.#.###.#.', '#...#...#'],
  vest: ['.##...##.', '#########', '#.#####.#', '..#####..', '..#.#.#..', '..#####..', '..#####..', '..#####..', '.........'],
  ring: ['...###...', '..#...#..', '.#.....#.', '.#.....#.', '.#.....#.', '..#...#..', '...###...', '.........', '.........'],
  pack: ['...###...', '..#...#..', '.#######.', '#########', '#.#####.#', '#.##.##.#', '#.#####.#', '#########', '.........'],
  hammer: ['.######..', '########.', '.######..', '....##...', '....##...', '....##...', '....##...', '....##...', '.........'],
  jar: ['..#####..', '...###...', '.#######.', '.#.....#.', '.#######.', '.#######.', '.#######.', '..#####..', '.........'],
  flask: ['...###...', '...#.#...', '...#.#...', '..#...#..', '.#.....#.', '.#######.', '#########', '.#######.', '.........'],
  flame: ['....#....', '...##....', '...###.#.', '.#.####..', '.#######.', '.###.###.', '.##...##.', '..#####..', '.........'],
  cap: ['..#####..', '.#######.', '#########', '#.#####.#', '...###...', '...###...', '...###...', '..#####..', '.........'],
  hide: ['.##...##.', '#########', '.#######.', '..#####..', '..#####..', '.#######.', '.#######.', '##.....##', '.........'],
  horn: ['.......#.', '......##.', '.....###.', '....###..', '...###...', '..###....', '.###.....', '###......', '##.......'],
  sparkle: ['....#....', '....#....', '...###...', '#########', '...###...', '.#..#..#.', '....#....', '.#.....#.', '.........'],
  feather: ['.......##', '.....###.', '....####.', '...####..', '..####...', '..###....', '.##......', '#........', '.........'],
  wing: ['#........', '##.......', '###......', '#####....', '#######..', '.########', '...######', '.....###.', '.........'],
  cloud: ['.........', '...##....', '..####.#.', '.#######.', '#########', '#########', '.#######.', '.........', '.........'],
  comet: ['#.......#', '.#.....##', '..#...###', '...#.####', '....#####', '...######', '..#######', '.#.......', '.........'],
  heart: ['.........', '.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
};
const DIGITS = ['###,#.#,#.#,#.#,###', '.#.,##.,.#.,.#.,###', '###,..#,###,#..,###', '###,..#,.##,..#,###', '#.#,#.#,###,..#,..#', '###,#..,###,..#,###', '###,#..,###,#.#,###', '###,..#,.#.,.#.,.#.', '###,#.#,###,#.#,###', '###,#.#,###,..#,###'].map((d) => d.split(','));
const ATTR_ORDER = ['strength', 'speed', 'endurance', 'mass'];
const ATTR_FULL = 100; // gauges fill at this value, for now

// Bough paths on the 320 x 180 map. `out`: which way left/right moves toward the tip.
const HUB = [260, 190];
const TRUNK = [[260, 296], [256, 250], [264, 215], HUB];
// The boughs fan out evenly from the top of the trunk, left to right; Flight grows beside the
// Jumping it evolved from, and Superspeed beside Running. Each is its own spoke, so nodes never crowd one another.
const FAN = ['running', 'superspeed', 'swimming', 'climbing', 'jumping', 'flight', 'punching', 'blow', 'fighting', 'mining', 'woodcutting'];
const FAN_FROM = 0.955, FAN_SPAN = 0.91;     // share of a half turn, left end and width
const RINGS = [92, 117, 142, 167, 192];      // distance of each node from the hub
const WIDE = 1.25, TALL = 0.88;              // the fan is an oval, to fill a wide map
const BOUGHS = Object.fromEntries(FAN.map((id, i) => {
  const a = Math.PI * (FAN_FROM - (FAN_SPAN * i) / (FAN.length - 1));
  // A slight sway keeps the spokes looking grown rather than ruled.
  const nodes = RINGS.map((r, k) => {
    const sway = Math.sin(k * 1.5 + i * 2) * 5 * (k / 4);
    return [Math.round(HUB[0] + Math.cos(a) * r * WIDE - Math.sin(a) * sway), Math.round(HUB[1] - Math.sin(a) * r * TALL - Math.cos(a) * sway)];
  });
  return [id, { path: [HUB, ...nodes], nodes }];
}));

function rng(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function line(g, [x0, y0], [x1, y1], w) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n - w / 2), Math.round(y0 + ((y1 - y0) * i) / n - w / 2), w, w);
}

function disc(g, x, y, r) {
  for (let j = -r; j <= r; j++) {
    const w = Math.round(Math.sqrt(r * r - j * j));
    g.fillRect(x - w, y + j, w * 2 + 1, 1);
  }
}

// The still part: sky, stars, the dark tree and its sealed buds.
function paintBackdrop() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const bands = ['#0a0f22', '#0d1430', '#111a3c', '#162048', '#1b2752'];
  bands.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(0, Math.floor((H * i) / bands.length), W, H);
  });
  const r = rng(77);
  g.fillStyle = '#c9d4ff';
  for (let i = 0; i < 240; i++) g.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.8), 1, 1);
  // Canopy: soft dark clouds of leaves behind the boughs.
  g.fillStyle = '#121c3a';
  for (let i = 0; i < 130; i++) disc(g, Math.floor(20 + r() * (W - 40)), Math.floor(14 + r() * 170), 8 + Math.floor(r() * 18));
  g.fillStyle = '#17234a';
  for (let i = 0; i < 60; i++) disc(g, Math.floor(30 + r() * (W - 60)), Math.floor(14 + r() * 140), 5 + Math.floor(r() * 11));
  // Hill, trunk and roots.
  g.fillStyle = '#0c1228';
  for (let x = 0; x < W; x++) {
    const y = H - 28 + Math.sin(x * 0.03) * 4 + Math.abs(x - W / 2) * 0.03;
    g.fillRect(x, Math.floor(y), 1, H);
  }
  g.fillStyle = '#2a2240';
  TRUNK.slice(1).forEach((p, i) => line(g, TRUNK[i], p, 20 - i * 4));
  line(g, [260, 276], [210, H], 6);
  line(g, [260, 276], [312, H], 6);
  g.fillStyle = '#3a2f55';
  TRUNK.slice(1).forEach((p, i) => line(g, [TRUNK[i][0] - 3, TRUNK[i][1]], [p[0] - 3, p[1]], 3));
  // Boughs: every one starts dark, sealed or not.
  for (const { path } of Object.values(BOUGHS)) {
    path.slice(1).forEach((p, i) => {
      g.fillStyle = '#2a2240';
      line(g, path[i], p, i < 2 ? 4 : 3);
    });
  }
  return c;
}

export function icon(g, name, x, y) {
  ICONS[name].forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '#') g.fillRect(x - 4 + rx, y - 4 + ry, 1, 1); }));
}

export function number(g, value, x, y) {
  [...String(value)].forEach((d, i) => DIGITS[d].forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '#') g.fillRect(x + i * 4 + rx, y + ry, 1, 1); })));
}

export default class SkillMap {
  constructor(canvas, tag) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.g = canvas.getContext('2d');
    this.tag = tag;
    this.backdrop = paintBackdrop();
    this.bough = 0;
    this.focus = 0;
    this.age = 0;
    this.motes = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % W, y: (i * 61) % H, s: 4 + (i % 5) * 2 }));
  }

  open(skills, body) {
    this.skills = FAN.map((id) => skills.find((s) => s.id === id)).map((s) => ({ ...s, nodes: BOUGHS[s.id].nodes }));
    this.body = body;
    this.age = 0;
    this.pick(this.bough);
  }

  // Jump to a bough, landing on its newest lit node.
  pick(i) {
    this.bough = (i + this.skills.length) % this.skills.length;
    this.focus = Math.max(0, this.skills[this.bough].level - 1);
    this.showTag();
  }

  showTag() {
    const s = this.skills[this.bough], node = s.levels[this.focus];
    this.tag.textContent = this.focus < s.level ? `${s.name} · ${node.title}` : '?';
    this.tag.style.color = this.focus < s.level ? s.color : '#7a84b0';
  }

  // Left and right step across the fan; up and down travel out along a bough and back.
  handle(just) {
    if (just.left) return this.pick(this.bough - 1);
    if (just.right) return this.pick(this.bough + 1);
    const s = this.skills[this.bough], before = this.focus;
    if (just.up) this.focus = Math.min(s.levels.length - 1, this.focus + 1);
    if (just.down) this.focus = Math.max(0, this.focus - 1);
    if (this.focus !== before) this.showTag();
    return undefined;
  }

  drawBough(s, index, t) {
    const g = this.g, reveal = Math.min(1, t / REVEAL), lit = s.level, path = BOUGHS[s.id].path;
    const segs = path.length - 1, upto = (lit / s.levels.length) * reveal * segs;

    // Light runs out along the bough as far as you have learned.
    g.fillStyle = s.color;
    for (let i = 0; i < segs && i < upto; i++) {
      const k = Math.min(1, upto - i), a = path[i], b = path[i + 1];
      line(g, a, [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], 2);
    }
    // Sparks travel along the lit stretch, so the tree feels alive.
    if (lit) {
      const p = ((t * 0.35 + index * 0.3) % 1) * Math.min(upto, segs), i = Math.floor(p), f = p - i;
      if (path[i + 1]) {
        g.fillStyle = '#ffffff';
        g.fillRect(Math.round(path[i][0] + (path[i + 1][0] - path[i][0]) * f) - 1, Math.round(path[i][1] + (path[i + 1][1] - path[i][1]) * f) - 1, 3, 3);
      }
    }

    s.nodes.forEach(([x, y], i) => {
      const on = i < lit && reveal >= (i + 0.6) / s.levels.length;
      const pulse = Math.sin(t * 3 + i) * 0.5 + 0.5;
      if (on) {
        // Glow, then the node with its icon in dark ink.
        const glow = g.createRadialGradient(x, y, 2, x, y, 20);
        glow.addColorStop(0, `${s.color}aa`);
        glow.addColorStop(1, `${s.color}00`);
        g.fillStyle = glow;
        g.fillRect(x - 20, y - 20, 40, 40);
      }
      g.fillStyle = INK;
      disc(g, x, y, 10);
      g.fillStyle = on ? s.color : '#2c3460';
      disc(g, x, y, 9);
      g.fillStyle = on ? '#fff8ea' : '#1c2346';
      disc(g, x, y, 7);
      if (on) {
        g.fillStyle = INK;
        icon(g, s.levels[i].icon, x, y);
      }
      // The next node fills like a ring as you practise.
      if (i === lit && s.progress > 0) {
        g.fillStyle = s.color;
        const steps = Math.floor(s.progress * reveal * 28);
        for (let a = 0; a < steps; a++) {
          const ang = (a / 28) * Math.PI * 2 - Math.PI / 2;
          g.fillRect(Math.round(x + Math.cos(ang) * 8), Math.round(y + Math.sin(ang) * 8), 1, 1);
        }
      }
      if (index === this.bough && i === this.focus) {
        // Gold corners mark the focused node.
        g.fillStyle = '#ffb547';
        const o = 13 + Math.round(pulse);
        for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.fillRect(x + cx * o - (cx > 0 ? 3 : 0), y + cy * o, 4, 1);
          g.fillRect(x + cx * o, y + cy * o - (cy > 0 ? 3 : 0), 1, 4);
        }
      }
    });
  }

  // Body gauges in the roots: an icon, a bar that grows, and the value.
  drawBody() {
    const g = this.g, reveal = Math.min(1, this.age / REVEAL);
    ATTR_ORDER.forEach((name, i) => {
      const a = ATTRIBUTES[name], value = this.body[name], x = W / 2 - 96 + i * 48, y = H - 10;
      g.fillStyle = INK;
      g.fillRect(x - 7, y - 7, 46, 14);
      g.fillStyle = a.color;
      icon(g, a.icon, x, y);
      g.fillStyle = '#242a4c';
      g.fillRect(x + 7, y - 4, 30, 3);
      g.fillStyle = a.color;
      g.fillRect(x + 7, y - 4, Math.max(1, Math.round((Math.min(a.full ?? ATTR_FULL, value) / (a.full ?? ATTR_FULL)) * 30 * reveal)), 3);
      number(g, Math.floor(value), x + 7, y + 1);
    });
  }

  update(dt) {
    this.age += dt;
    const g = this.g, t = this.age;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.backdrop, 0, 0);
    this.skills.forEach((s, i) => this.drawBough(s, i, t));
    this.drawBody();

    // Motes drift up the tree.
    g.fillStyle = '#c9f4ff';
    for (const m of this.motes) {
      m.y -= m.s * dt;
      if (m.y < 0) m.y = H;
      if (Math.sin(t * 2 + m.x) > 0) g.fillRect(Math.round(m.x + Math.sin(m.y * 0.05) * 4), Math.round(m.y), 1, 1);
    }
  }
}
