// Three IIFE bundles, because MV3 content scripts are not ES modules and a
// MAIN-world script must be a single self-contained file. esbuild rather than
// Vite for exactly that reason — see CLAUDE.md "Stack".
import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  format: 'iife',
  target: 'chrome111', // content_scripts[].world: "MAIN" needs 111+
  platform: 'browser',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
};

const entries = [
  { in: 'src/bridge/bridge.ts', out: 'dist/bridge.js' },
  { in: 'src/content/content.ts', out: 'dist/content.js' },
  { in: 'src/background/service-worker.ts', out: 'dist/background.js' },
  { in: 'src/options/options.ts', out: 'dist/options.js' },
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

for (const entry of entries) {
  const opts = { ...common, entryPoints: [entry.in], outfile: entry.out };
  if (watch) await (await context(opts)).watch();
  else await build(opts);
}

await cp('src/manifest.json', 'dist/manifest.json');
await cp('src/options/options.html', 'dist/options.html');
await cp('src/styles.css', 'dist/styles.css');

console.log(watch ? 'watching…' : 'built dist/');
