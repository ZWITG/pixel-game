// Keeps a playable copy of a version, so no version of the game is ever lost. Run this on the
// last commit of a version before committing the next one:
//   node scripts/snapshot.mjs          the commit you're on
//   node scripts/snapshot.mjs abc1234  any older commit
// It builds that commit away from your work, puts it in versions/<number>/ and tags it.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ref = process.argv[2] ?? 'HEAD';

function run(command, args, cwd = ROOT) {
  const r = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${r.stderr}`);
  return r.stdout.trim();
}

const { version } = JSON.parse(run('git', ['show', `${ref}:package.json`]));
const out = join(ROOT, 'versions', version);
if (existsSync(out)) {
  console.log(`v${version} is already kept.`);
  process.exit(0);
}
const work = mkdtempSync(join(tmpdir(), 'snapshot-'));
try {
  run('git', ['archive', '--format=tar', '-o', join(work, 'code.tar'), ref]);
  run('tar', ['-xf', 'code.tar', '--force-local'], work);
  symlinkSync(join(ROOT, 'node_modules'), join(work, 'node_modules'), 'junction');
  run('node', [join('node_modules', 'vite', 'bin', 'vite.js'), 'build'], work);
  cpSync(join(work, 'dist'), out, { recursive: true });
  if (!run('git', ['tag', '--list', `v${version}`])) run('git', ['tag', `v${version}`, ref]);
  console.log(`Kept v${version} in versions/${version}.`);
} finally {
  rmSync(join(work, 'node_modules'), { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
}
