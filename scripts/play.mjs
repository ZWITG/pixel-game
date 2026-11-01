// The offline game. Runs a finished build of the game from this PC, so it needs no internet.
// When GitHub can be reached it fetches the latest version first, and keeps checking while
// the game is open; a new version takes effect the next time the page is loaded.
import { spawnSync, exec } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const HOME = join(ROOT, '.play');        // not in git: the build you play, and your imported save
const GAME = join(HOME, 'game');
const NEXT = join(HOME, 'next');
const STAMP = join(HOME, 'version.txt');
const SAVE = join(HOME, 'save-import.json');
const PORT = Number(process.env.PLAY_PORT ?? 5181); // its own port: browsers keep saves per port, so this one never changes
const OPEN = !process.env.PLAY_NO_OPEN;
const CHECK_EVERY = 10 * 60 * 1000;      // ms between update checks while playing
const NET_TIMEOUT = 15000;               // ms before GitHub counts as unreachable
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
};
const ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };

function git(...args) {
  const r = spawnSync('git', args, { cwd: ROOT, env: ENV, encoding: 'utf8', timeout: NET_TIMEOUT });
  return r.status === 0 ? r.stdout.trim() : null;
}

function run(command) {
  return spawnSync(command, { cwd: ROOT, env: ENV, shell: true, stdio: 'inherit' }).status === 0;
}

// Windows and antivirus hold fresh folders for a moment, so a rename may need a few tries.
function swapIn() {
  rmSync(GAME, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  for (let i = 0; i < 10; i++) {
    try {
      renameSync(NEXT, GAME);
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    }
  }
  cpSync(NEXT, GAME, { recursive: true });
  rmSync(NEXT, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

// Builds beside the running copy and swaps it in, so a player never gets half a game.
function build() {
  console.log('Building the game...');
  rmSync(NEXT, { recursive: true, force: true });
  if (!run(`npx vite build --outDir "${NEXT}" --emptyOutDir`)) return false;
  swapIn();
  writeFileSync(STAMP, git('rev-parse', 'HEAD') ?? '');
  return true;
}

// Returns true if a newer version was fetched. Any failure just means playing what's here.
function update() {
  if (git('fetch', 'origin', 'main') === null) return false;
  const here = git('rev-parse', 'HEAD'), there = git('rev-parse', 'origin/main');
  if (!there || here === there) return false;
  if (git('merge-base', '--is-ancestor', here, 'origin/main') === null) return false; // local commits ahead
  if (git('status', '--porcelain')) {
    console.log('A new version is out, but this folder has unsaved edits, so it was left alone.');
    return false;
  }
  const before = git('rev-parse', 'HEAD:package-lock.json');
  if (git('merge', '--ff-only', 'origin/main') === null) return false;
  if (git('rev-parse', 'HEAD:package-lock.json') !== before) run('npm install');
  console.log('Updated to the latest version.');
  return true;
}

function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    if (path === '/save-import.json') {
      res.writeHead(existsSync(SAVE) ? 200 : 404, { 'content-type': 'application/json' });
      res.end(existsSync(SAVE) ? readFileSync(SAVE) : '');
      return;
    }
    const file = normalize(join(GAME, path === '/' ? 'world.html' : path));
    if (!file.startsWith(GAME) || !existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(readFileSync(file));
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(PORT, '127.0.0.1', () => done(server));
  });
}

const fresh = update();
let inUse = false;
const server = await serve().catch((e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  inUse = true;
  return null;
});
if (fresh || !existsSync(join(GAME, 'world.html')) || (existsSync(STAMP) && readFileSync(STAMP, 'utf8') !== git('rev-parse', 'HEAD'))) {
  if (!build() && !existsSync(join(GAME, 'world.html'))) {
    console.error('The game could not be built. Is Node installed, and has "npm install" been run?');
    process.exit(1);
  }
}

const url = `http://localhost:${PORT}/world.html`;
if (OPEN) exec(process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`);
if (inUse) {
  console.log(`The game is already running at ${url}`);
  process.exit(0);
}
console.log(`\nPixel RPG is running at ${url}\nKeep this window open while you play. Close it when you're done.`);
setInterval(() => {
  if (update()) {
    build();
    console.log('A new version is ready. Reload the game page to play it.');
  }
}, CHECK_EVERY);
export { server };
