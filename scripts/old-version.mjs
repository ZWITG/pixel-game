// Plays any kept version of the game, offline. Each one runs on its own port, because browsers
// keep saves per port: an old version can never touch the save of the current game.
import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(import.meta.dirname, '..');
const KEPT = join(ROOT, 'versions');
const FIRST_PORT = 5190;
const CONQUERORS_FROM = [0, 10]; // from this version on, the original hero can't be played
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const number = (v) => v.split('.').map(Number);
const older = (a, b) => number(a)[0] - number(b)[0] || number(a)[1] - number(b)[1] || (number(a)[2] ?? 0) - (number(b)[2] ?? 0);
const list = readdirSync(KEPT).filter((v) => existsSync(join(KEPT, v, 'world.html'))).sort(older);

list.forEach((v, i) => console.log(`  ${i + 1}. v${v}`));
const ask = createInterface({ input: process.stdin, output: process.stdout });
const pick = process.argv[2] ?? await ask.question('\nWhich version? Type its number: ');
ask.close();
const at = list.indexOf(pick) >= 0 ? list.indexOf(pick) : Number(pick) - 1, version = list[at];
if (!version) {
  console.error('There is no version with that number.');
  process.exit(1);
}

// Versions from before the Conquerors can start with the original hero, if there's no save yet.
function legendSave() {
  const [major, minor] = number(version);
  if (major > CONQUERORS_FROM[0] || minor >= CONQUERORS_FROM[1]) return null;
  const { skills, bag, sites } = JSON.parse(readFileSync(join(ROOT, 'docs', 'legend-hero.json'), 'utf8'));
  return JSON.stringify({ 'lumen.skills': JSON.stringify(skills), 'lumen.bag': JSON.stringify(bag), 'lumen.sites': JSON.stringify(sites) });
}

const GAME = join(KEPT, version), PORT = FIRST_PORT + at;
createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]), save = path === '/save-import.json' ? legendSave() : null;
  if (save) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(save);
    return;
  }
  const file = normalize(join(GAME, path === '/' ? 'world.html' : path));
  if (!file.startsWith(GAME) || !existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}/world.html`;
  if (process.argv[3] !== 'quiet') exec(process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`);
  console.log(`\nv${version} is running at ${url}\nKeep this window open while you play. Close it when you're done.`);
});
