#!/usr/bin/env node
// P5-60 (accordproject/concerto-rust#392): web bundle size of the engine
// build against the v5.0.0 tree-shaken bundle, by the P5-39 method
// (accordproject/concerto-rust#349, issuecomment-5892061203). Size only.
//
//   node migration/bench/p560-bundle.mjs <out dir> [--engine-pkg DIR] [--v5-root DIR]
//
// Entry points (the same app code for both engines):
//   E1 introspect: new ModelManager(), addModelFile(new ModelFile(mm, ast))
//      from a JSON AST, then walk the declarations and properties;
//   E2 validate: E1's load, then Serializer.fromJSON(obj).validate() and toJSON;
//   E3 parse CTO and resolve: addCTOModel(cto), getType,
//      getAllSuperTypeDeclarations, getProperties.
// esbuild bundle, format esm, platform browser, minify, treeShaking,
// NODE_ENV=production, target es2022, with and without keepNames. v5 is
// bundled from its package `exports` (browser -> dist/esm-browser). The
// engine build is this checkout's dist/esm-browser plus a bundler stand-in:
// the synchronous-`require` registry of e2e/tests/support/engine-bundler.ts,
// built as a chain of modules so each registry entry is set after its
// module has evaluated, in the stand-in's order. Every bundle is run in
// Node and its output compared with v5's. Sizes: raw, gzip -9, brotli q11
// (KB = 1000 B); the `.wasm` inside the engine bundle is base64 inline
// (concerto-engine.mjs), and the parts are split out too.

import fs from 'fs';
import path from 'path';
import url from 'url';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const esbuild = require(path.join(REPO_ROOT, 'node_modules', 'esbuild'));

const argv = process.argv.slice(2);
const OUT = path.resolve(argv[0] || 'p560-bundle-out');
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? path.resolve(argv[i + 1]) : d; };
const ENGINE_PKG = opt('--engine-pkg', path.resolve(REPO_ROOT, '..', 'concerto-rust', 'concerto-wasm', 'pkg'));
const V5_ROOT = opt('--v5-root', path.join(REPO_ROOT, 'migration', 'oracle', 'reference'));
const CORE_BROWSER = path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist', 'esm-browser');
const ENGINE_DIR = path.join(CORE_BROWSER, 'engine');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// The P5-39 sample model: scalar with range, abstract identified base,
// extends, regex, length, DateTime, arrays, relationship, enum, decorator.
const CTO = `namespace org.example.p560@1.0.0

scalar Age extends Integer range=[0,150]

@Term("A party")
abstract participant Party identified by partyId {
  o String partyId
  o String name length=[1,100] regex=/^[A-Za-z ]+$/
}

enum Tier {
  o GOLD
  o SILVER
}

participant Customer extends Party {
  o Age age
  o DateTime since
  o String[] emails
  o Tier tier
  --> Customer[] referrals optional
}
`;
const cto = require(path.join(REPO_ROOT, 'packages', 'concerto-cto'));
const AST = cto.Parser.parse(CTO);
const INSTANCE = {
    $class: 'org.example.p560@1.0.0.Customer', partyId: 'c1', name: 'Ann Lee', age: 42,
    since: '2024-01-02T03:04:05.000Z', emails: ['a@example.com'], tier: 'GOLD', referrals: ['resource:org.example.p560@1.0.0.Customer#c2'],
};

const APP = {
    E1: `
const mm = new ModelManager();
mm.addModelFile(new ModelFile(mm, AST));
const out = [];
for (const mf of mm.getModelFiles()) {
  if (mf.isSystemModelFile && mf.isSystemModelFile()) continue;
  for (const d of mf.getAllDeclarations()) {
    out.push(d.getFullyQualifiedName());
    if (d.getProperties) for (const p of d.getProperties()) out.push('  ' + p.getName() + ':' + p.getType());
  }
}
console.log(JSON.stringify(out));`,
    E2: `
const mm = new ModelManager();
mm.addModelFile(new ModelFile(mm, AST));
const s = new Serializer(new Factory(mm), mm);
const r = s.fromJSON(INSTANCE);
r.validate();
console.log(JSON.stringify(s.toJSON(r)));`,
    E3: `
const mm = new ModelManager();
mm.addCTOModel(CTO);
const t = mm.getType('org.example.p560@1.0.0.Customer');
console.log(JSON.stringify([t.getAllSuperTypeDeclarations().map((x) => x.getName()), t.getProperties().map((p) => p.getName())]));`,
};
const IMPORTS = { E1: 'ModelManager, ModelFile', E2: 'ModelManager, ModelFile, Serializer, Factory', E3: 'ModelManager' };

function appSource(entry, from) {
    return `import { ${IMPORTS[entry]} } from ${JSON.stringify(from)};
const AST = ${JSON.stringify(AST)};
const CTO = ${JSON.stringify(CTO)};
const INSTANCE = ${JSON.stringify(INSTANCE)};
${APP[entry]}
`;
}

// The engine stand-in, as a chain of modules: setup (globalThis.module and
// require over a registry), then one module per registry entry, each
// importing the previous link and registering its own module after it has
// evaluated.
function writeStandIn(dir) {
    const engineModules = fs.readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.mjs') && !f.startsWith('chunk-')).map((f) => f.slice(0, -4));
    const ordered = ['index', 'views', ...engineModules.filter((n) => n !== 'index' && n !== 'views').sort()];
    const requires = new Set();
    for (const f of fs.readdirSync(ENGINE_DIR).filter((x) => x.endsWith('.mjs'))) {
        for (const m of fs.readFileSync(path.join(ENGINE_DIR, f), 'utf8').matchAll(/__require\("([^"]+)"\)/g)) {
            requires.add(m[1]);
        }
    }
    fs.writeFileSync(path.join(dir, 'setup.mjs'), `
const bundled = new Map();
const bundlerRequire = (specifier) => {
  const engine = /^\\.\\.?\\/engine(\\/.*)?$/.exec(specifier);
  const key = engine ? 'engine/' + (engine[1] ? engine[1].slice(1) : 'index') : specifier;
  if (!bundled.has(key)) throw new Error('Bundler stand-in: "' + specifier + '" is not in the bundle');
  return bundled.get(key);
};
globalThis.module = { require: bundlerRequire };
globalThis.require = bundlerRequire;
globalThis.__p560Bundled = bundled;
`);
    const links = [['@accordproject/concerto-engine', path.join(ENGINE_PKG, 'concerto-engine.mjs')]];
    for (const n of ordered) {
        links.push([`engine/${n}`, path.join(ENGINE_DIR, `${n}.mjs`)]);
    }
    for (const s of [...requires].sort()) {
        links.push([s, path.join(ENGINE_DIR, s)]);
    }
    let prev = './setup.mjs';
    links.forEach(([key, file], i) => {
        const name = `link-${i}.mjs`;
        fs.writeFileSync(path.join(dir, name), `import ${JSON.stringify(prev)};
import * as m from ${JSON.stringify(file)};
globalThis.__p560Bundled.set(${JSON.stringify(key)}, m);
`);
        prev = `./${name}`;
    });
    return prev;
}

const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
const br = (b) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } }).length;
const sizes = (b) => ({ raw: b.length, gzip: gz(b), brotli: br(b) });

async function bundle(label, entryFile, keepNames, nodePaths) {
    const outfile = path.join(OUT, `${label}${keepNames ? '-keepnames' : ''}.mjs`);
    const r = await esbuild.build({
        entryPoints: [entryFile], bundle: true, format: 'esm', platform: 'browser', minify: true, treeShaking: true,
        keepNames, target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, outfile, metafile: true,
        logLevel: 'error', nodePaths,
    });
    fs.writeFileSync(`${outfile}.meta.json`, JSON.stringify(r.metafile));
    const bytes = fs.readFileSync(outfile);
    let output;
    let error = null;
    try {
        output = execFileSync(process.execPath, [outfile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (e) {
        error = (e.stderr || e.message).toString().split('\n').filter(Boolean).slice(0, 3).join(' | ');
    }
    // Split out the engine package (the base64 wasm and the glue).
    let enginePkgBytes = 0;
    for (const [f, info] of Object.entries(r.metafile.outputs[path.relative(process.cwd(), outfile)]?.inputs || {})) {
        if (f.includes('concerto-engine.mjs')) {
            enginePkgBytes += info.bytesInOutput;
        }
    }
    return { label, keepNames, file: path.relative(OUT, outfile), ...sizes(bytes), enginePkgBytesInOutput: enginePkgBytes, output, error };
}

const results = [];
const wasm = fs.readFileSync(path.join(ENGINE_PKG, 'concerto_wasm.wasm'));
const engineMjs = fs.readFileSync(path.join(ENGINE_PKG, 'concerto-engine.mjs'));
const b64 = Buffer.from(wasm.toString('base64'));
for (const entry of ['E1', 'E2', 'E3']) {
    const d = path.join(OUT, 'src', entry);
    fs.mkdirSync(path.join(d, 'v5'), { recursive: true });
    fs.mkdirSync(path.join(d, 'engine'), { recursive: true });
    fs.writeFileSync(path.join(d, 'v5', 'app.mjs'), appSource(entry, '@accordproject/concerto-core'));
    const last = writeStandIn(path.join(d, 'engine'));
    fs.writeFileSync(path.join(d, 'engine', 'app.mjs'), `import ${JSON.stringify(last)};\n${appSource(entry, path.join(CORE_BROWSER, 'index.mjs'))}`);
    for (const keepNames of [true, false]) {
        results.push({ entry, engine: 'v5.0.0', ...(await bundle(`${entry}-v5`, path.join(d, 'v5', 'app.mjs'), keepNames, [path.join(V5_ROOT, 'node_modules')])) });
        results.push({ entry, engine: 'rust', ...(await bundle(`${entry}-engine`, path.join(d, 'engine', 'app.mjs'), keepNames, [path.join(REPO_ROOT, 'node_modules')])) });
    }
}
// The engine bundle's JS alone: the same bundle with the engine package
// (the wasm-bindgen glue and the base64 .wasm) left external.
const jsPart = {};
for (const entry of ['E1', 'E2', 'E3']) {
    for (const keepNames of [true, false]) {
        const r = await esbuild.build({
            entryPoints: [path.join(OUT, 'src', entry, 'engine', 'app.mjs')], bundle: true, format: 'esm', platform: 'browser', minify: true,
            treeShaking: true, keepNames, target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, write: false, logLevel: 'error',
            nodePaths: [path.join(REPO_ROOT, 'node_modules')],
            plugins: [{ name: 'engine-external', setup(b) { b.onResolve({ filter: /concerto-engine\.mjs$/ }, (a) => ({ path: a.path, external: true })); } }],
        });
        jsPart[`${entry}${keepNames ? '-keepnames' : ''}`] = sizes(Buffer.from(r.outputFiles[0].contents));
    }
}
const parts = {
    jsWithoutEnginePkg: jsPart,
    wasm: sizes(wasm), wasmBase64: sizes(b64), engineMjs: sizes(engineMjs),
    engineCjsRaw: fs.statSync(path.join(ENGINE_PKG, 'concerto-engine.cjs')).size,
};
const v5Version = JSON.parse(fs.readFileSync(path.join(V5_ROOT, 'node_modules', '@accordproject', 'concerto-core', 'package.json'), 'utf8')).version;
const summary = { tool: 'p560-bundle', esbuild: esbuild.version, node: process.version, v5Version, enginePkg: ENGINE_PKG, parts, results };
fs.writeFileSync(path.join(OUT, 'bundle-sizes.json'), JSON.stringify(summary, null, 2));
const kb = (x) => (x / 1000).toFixed(1);
console.log(`esbuild ${esbuild.version}; KB = 1000 B`);
console.log('| entry | engine | keepNames | raw | gzip | brotli | runs | same output as v5 |');
console.log('|---|---|---|---:|---:|---:|---|---|');
for (const r of results) {
    const v5 = results.find((x) => x.entry === r.entry && x.engine === 'v5.0.0' && x.keepNames === r.keepNames);
    const same = r.engine === 'v5.0.0' ? '-' : (r.output !== undefined && r.output === v5.output ? 'yes' : 'NO');
    console.log(`| ${r.entry} | ${r.engine} | ${r.keepNames ? 'on' : 'off'} | ${kb(r.raw)} | ${kb(r.gzip)} | ${kb(r.brotli)} | ${r.error ? `error: ${r.error}` : 'ok'} | ${same} |`);
}
console.log(`\nJS without the engine package (E1, keepNames): ${kb(jsPart['E1-keepnames'].raw)} / ${kb(jsPart['E1-keepnames'].gzip)} / ${kb(jsPart['E1-keepnames'].brotli)}; without keepNames ${kb(jsPart.E1.raw)} / ${kb(jsPart.E1.gzip)} / ${kb(jsPart.E1.brotli)}`);
console.log(`.wasm ${kb(parts.wasm.raw)} / ${kb(parts.wasm.gzip)} / ${kb(parts.wasm.brotli)}; base64 ${kb(parts.wasmBase64.raw)} / ${kb(parts.wasmBase64.gzip)} / ${kb(parts.wasmBase64.brotli)}; concerto-engine.mjs ${kb(parts.engineMjs.raw)} / ${kb(parts.engineMjs.gzip)} / ${kb(parts.engineMjs.brotli)}; concerto-engine.cjs raw ${kb(parts.engineCjsRaw)}`);
