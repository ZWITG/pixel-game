// The skill map: the Spirit Tree at night, drawn in pixels. Each skill is a bough of nodes that
// light up as levels are reached. Undiscovered boughs stay dark, with only their buds showing.
const W = 320, H = 180;
const INK = '#0a0f22';
const REVEAL = 1.1; // seconds for the light to run out along a bough when the map opens

// 9 x 9 pixel icons, one per swimming level.
const ICONS = {
  drop: ['....#....', '....#....', '...###...', '..#####..', '.#######.', '.###.###.', '.##.####.', '..#####..', '...###...'],
  ripple: ['.........', '..#####..', '.#.....#.', '#..###..#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..', '.........'],
  wave: ['.........', '.........', '.##...##.', '#..#.#..#', '....#....', '.##...##.', '#..#.#..#', '....#....', '.........'],
  crest: ['.....###.', '...##...#', '..#..##..', '.#..#..#.', '.#..##...', '#......##', '#..######', '.#......#', '..######.'],
  fish: ['.........', '..####..#', '.######.#', '#.#######', '#########', '.######.#', '..####..#', '.........', '.........'],
};

// Bough paths on the 320 x 180 map. Node positions sit on them.
const TRUNK = [[160, 182], [158, 150], [162, 122], [160, 100]];
const BOUGHS = {
  swimming: [[160, 108], [132, 100], [104, 84], [78, 80], [56, 58], [36, 54], [24, 30]],
};
const SEALED = [
  [[161, 106], [190, 96], [216, 78], [244, 74], [268, 52], [292, 46]],
  [[160, 102], [156, 78], [166, 56], [158, 34], [162, 16]],
  [[160, 118], [196, 124], [226, 112], [258, 118], [288, 100]],
  [[159, 118], [124, 128], [92, 114], [60, 122], [28, 104]],
];

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

// Points evenly spaced along a path; `count` nodes, skipping the path's start.
function along(path, count) {
  const lens = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  return Array.from({ length: count }, (_, k) => {
    let d = (total * (k + 1)) / count, i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const t = d / lens[i];
    return [Math.round(path[i][0] + (path[i + 1][0] - path[i][0]) * t), Math.round(path[i][1] + (path[i + 1][1] - path[i][1]) * t)];
  });
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
  for (let i = 0; i < 110; i++) g.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.8), 1, 1);
  // Canopy: soft dark clouds of leaves behind the boughs.
  g.fillStyle = '#121c3a';
  for (let i = 0; i < 60; i++) disc(g, Math.floor(20 + r() * 280), Math.floor(14 + r() * 100), 8 + Math.floor(r() * 14));
  g.fillStyle = '#17234a';
  for (let i = 0; i < 26; i++) disc(g, Math.floor(30 + r() * 260), Math.floor(14 + r() * 80), 5 + Math.floor(r() * 9));
  // Hill, trunk and roots.
  g.fillStyle = '#0c1228';
  for (let x = 0; x < W; x++) {
    const y = 164 + Math.sin(x * 0.03) * 4 + Math.abs(x - 160) * 0.05;
    g.fillRect(x, Math.floor(y), 1, H);
  }
  g.fillStyle = '#2a2240';
  TRUNK.slice(1).forEach((p, i) => line(g, TRUNK[i], p, 16 - i * 3));
  line(g, [160, 172], [120, 180], 5);
  line(g, [160, 172], [204, 180], 5);
  g.fillStyle = '#3a2f55';
  TRUNK.slice(1).forEach((p, i) => line(g, [TRUNK[i][0] - 3, TRUNK[i][1]], [p[0] - 3, p[1]], 3));
  // Boughs: every one starts dark, sealed or not.
  for (const path of [...Object.values(BOUGHS), ...SEALED]) {
    path.slice(1).forEach((p, i) => {
      g.fillStyle = '#2a2240';
      line(g, path[i], p, i < 2 ? 4 : 3);
    });
  }
  for (const path of SEALED) {
    for (const [x, y] of along(path, path.length - 1)) {
      g.fillStyle = '#0a0f22';
      disc(g, x, y, 6);
      g.fillStyle = '#242a4c';
      disc(g, x, y, 4);
    }
  }
  return c;
}

export default class SkillMap {
  constructor(canvas, tag) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.g = canvas.getContext('2d');
    this.tag = tag;
    this.backdrop = paintBackdrop();
    this.focus = 0;
    this.age = 0;
    this.motes = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % W, y: (i * 61) % H, s: 4 + (i % 5) * 2 }));
  }

  open(skill) {
    this.skill = skill;
    this.age = 0;
    this.focus = Math.max(0, skill.level - 1);
    this.nodes = along(BOUGHS[skill.id], skill.levels.length);
    this.showTag();
  }

  showTag() {
    const s = this.skill, node = s.levels[this.focus];
    this.tag.textContent = this.focus < s.level ? `${s.name} · ${node.title}` : '?';
    this.tag.style.color = this.focus < s.level ? s.color : '#7a84b0';
  }

  handle(just) {
    const last = this.skill.levels.length - 1, before = this.focus;
    if (just.left || just.up) this.focus = Math.min(last, this.focus + 1);
    if (just.right || just.down) this.focus = Math.max(0, this.focus - 1);
    if (this.focus !== before) this.showTag();
  }

  update(dt) {
    this.age += dt;
    const g = this.g, s = this.skill, t = this.age;
    const reveal = Math.min(1, t / REVEAL);
    const lit = Math.min(s.level, s.levels.length);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.backdrop, 0, 0);
    g.fillStyle = s.color;

    // Light climbs the trunk, then runs out along the bough as far as you have learned.
    const path = BOUGHS[s.id], reach = lit ? (lit / s.levels.length) * reveal : 0;
    const segs = path.length - 1, upto = reach * segs;
    for (let i = 0; i < segs && i < upto; i++) {
      const k = Math.min(1, upto - i), a = path[i], b = path[i + 1];
      line(g, a, [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], 2);
    }
    // Sparks travel along the lit stretch, so the tree feels alive.
    if (lit) {
      const p = ((t * 0.35) % 1) * Math.min(upto, segs), i = Math.floor(p), f = p - i;
      if (path[i + 1]) {
        g.fillStyle = '#ffffff';
        g.fillRect(Math.round(path[i][0] + (path[i + 1][0] - path[i][0]) * f) - 1, Math.round(path[i][1] + (path[i + 1][1] - path[i][1]) * f) - 1, 3, 3);
      }
    }

    this.nodes.forEach(([x, y], i) => {
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
      g.fillStyle = on ? '#eafcff' : '#1c2346';
      disc(g, x, y, 7);
      if (on) {
        const icon = ICONS[s.levels[i].icon];
        g.fillStyle = INK;
        icon.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '#') g.fillRect(x - 4 + rx, y - 4 + ry, 1, 1); }));
      }
      // The next node fills like a ring as you practise.
      if (i === lit && s.progress > 0) {
        g.fillStyle = s.color;
        const steps = Math.floor(s.progress * reveal * 28);
        for (let a = 0; a < steps; a++) {
          const ang = (a / 28) * Math.PI * 2 - Math.PI / 2;
          g.fillRect(Math.round(x + Math.cos(ang) * 8), Math.round(y + Math.sin(ang) * 8), 1 + Math.round(pulse * 0.4), 1 + Math.round(pulse * 0.4));
        }
      }
      if (i === this.focus) {
        // Gold corners mark the focused node.
        g.fillStyle = '#ffb547';
        const o = 13 + Math.round(pulse);
        for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.fillRect(x + cx * o - (cx > 0 ? 3 : 0), y + cy * o - (cy > 0 ? 0 : 0), 4, 1);
          g.fillRect(x + cx * o - (cx > 0 ? 0 : 0), y + cy * o - (cy > 0 ? 3 : 0), 1, 4);
        }
      }
    });

    // Motes drift up the tree.
    g.fillStyle = s.color;
    for (const m of this.motes) {
      m.y -= m.s * dt;
      if (m.y < 0) m.y = H;
      if (Math.sin(t * 2 + m.x) > 0) g.fillRect(Math.round(m.x + Math.sin(m.y * 0.05) * 4), Math.round(m.y), 1, 1);
    }
  }
}
