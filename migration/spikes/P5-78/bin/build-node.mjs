#!/usr/bin/env node
// P5-78 spike: bundle src/node-all.ts to build/node-all.cjs for the Node runners.
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const SPIKE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const esbuild = require(path.resolve(SPIKE, '..', '..', '..', 'node_modules', 'esbuild'));
await esbuild.build({
    entryPoints: [path.join(SPIKE, 'src', 'node-all.ts')], bundle: true, platform: 'node', format: 'cjs', target: 'node20',
    outfile: path.join(SPIKE, 'build', 'node-all.cjs'), sourcemap: true, logLevel: 'warning',
});
console.log('built build/node-all.cjs');
