// Small pixel icons for the HUD, drawn as crisp SVG from character grids.
const PALETTE = {
  k: '#1a1c2c',
  w: '#f4f4f4',
  b: '#e04060',
  p: '#333c57',
  y: '#ffcd75',
  Y: '#c08530',
};

export const ICONS = {
  heart: ['.kk.kk.', 'kbwkbbk', 'kbbbbbk', 'kbbbbbk', '.kbbbk.', '..kbk..', '...k...'],
  heartEmpty: ['.kk.kk.', 'kppkppk', 'kpppppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'],
  coin: ['..kkkk..', '.kyyYYk.', 'kywyyyYk', 'kywyyyYk', 'kyyyyYYk', 'kyyyyYYk', '.kYYYYk.', '..kkkk..'],
};

const cache = new Map();

export function iconSvg(rows) {
  if (cache.has(rows)) return cache.get(rows);
  let rects = '';
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (PALETTE[ch]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PALETTE[ch]}"/>`;
    });
  });
  const svg = `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  cache.set(rows, svg);
  return svg;
}
