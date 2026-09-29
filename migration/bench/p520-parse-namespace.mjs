#!/usr/bin/env node
// P5-20 (F4, accordproject/concerto-rust#318): times ModelUtil.parseNamespace
// through the public TS API, and re-measures `new ModelManager()` and
// `addModelFile`, against any concerto-core dist. Measure only.
//
//   node migration/bench/p520-parse-namespace.mjs [--core-dist DIR]
//       [--samples N] [--warmup N] [--out FILE]
//
// --core-dist  a concerto-core dist/ (default: this checkout's, i.e. the
//              Rust engine through the TS API). The TS reference is
//              migration/oracle/reference/node_modules/@accordproject/concerto-core/dist.
//              Set CONCERTO_ENGINE_MODULE to choose the engine build.
//
// Ops, each over the namespaces or model files of fixtures/model-sets/<set>:
// - parse_namespace: `ModelUtil.parseNamespace(ns)` for every namespace a
//   model file declares or imports, without reading `versionParsed`;
// - parse_namespace_read: the same, reading `versionParsed.major` (on the
//   Rust engine after P5-20 this builds the SemVer on first read);
// - mm_new: `new ModelManager()` (set-independent, run once);
// - add_model_file: a fresh manager, then `addModelFile(new ModelFile(...))`
//   for every model file of the set, in file-name order.

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { timeit } from './lib/timeit.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];

const args = { coreDist: path.join(REPO_ROOT, 'packages/concerto-core/dist'), samples: 30, warmup: 5, out: null };
for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    const v = () => process.argv[++i];
    if (k === '--core-dist') { args.coreDist = path.resolve(v()); }
    else if (k === '--samples') { args.samples = Number(v()); }
    else if (k === '--warmup') { args.warmup = Number(v()); }
    else if (k === '--out') { args.out = v(); }
    else { throw new Error(`unknown argument ${k}`); }
}

const { ModelManager, ModelFile, ModelUtil } = require(path.join(args.coreDist, 'index.js'));
const coreVersion = require(path.join(args.coreDist, '..', 'package.json')).version;

function loadSet(set) {
    const dir = path.join(__dirname, 'fixtures', 'model-sets', set);
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
        .map((f) => ({ name: f, ast: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

function namespacesOf(models) {
    const out = [];
    for (const { ast } of models) {
        out.push(ast.namespace);
        for (const imp of ast.imports || []) {
            out.push(imp.namespace);
        }
    }
    return out;
}

const results = [];
function record(op, set, n, fn) {
    const stats = timeit(fn, { warmup: args.warmup, samples: args.samples, n });
    results.push({ op, set, n, ...stats });
    const us = stats.median_ms * 1000;
    console.log(`${op.padEnd(22)} ${set.padEnd(24)} n=${String(n).padStart(4)} ${us.toFixed(2).padStart(10)} us/item cv ${(stats.cv * 100).toFixed(1)}%`);
}

record('mm_new', 'conformance', 1, () => new ModelManager());
for (const set of SETS) {
    const models = loadSet(set);
    const namespaces = namespacesOf(models);
    record('parse_namespace', set, namespaces.length, () => {
        for (const ns of namespaces) {
            ModelUtil.parseNamespace(ns);
        }
    });
    record('parse_namespace_read', set, namespaces.length, () => {
        let sum = 0;
        for (const ns of namespaces) {
            const { versionParsed } = ModelUtil.parseNamespace(ns);
            sum += versionParsed ? versionParsed.major : 0;
        }
        return sum;
    });
    record('add_model_file', set, models.length, () => {
        const mm = new ModelManager();
        for (const { name, ast } of models) {
            mm.addModelFile(new ModelFile(mm, ast, undefined, name));
        }
        return mm;
    });
}

if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify({
        tool: 'p520-parse-namespace',
        coreDist: args.coreDist,
        coreVersion,
        engine: process.env.CONCERTO_ENGINE_MODULE || null,
        node: process.version,
        cpu: os.cpus()[0].model,
        loadavgEnd: os.loadavg().map((x) => Number(x.toFixed(2))),
        samples: args.samples,
        warmup: args.warmup,
        results,
    }, null, 2) + '\n');
}
