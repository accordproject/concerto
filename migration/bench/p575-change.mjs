#!/usr/bin/env node
// P5-75 (accordproject/concerto-rust#417): the first getNamespaces() after a
// real model change of the same manager. Measure only.
//
//   node migration/bench/p575-change.mjs [--core-dist DIR] [--sets a,b]
//       [--samples N] [--warmup N] [--out FILE]
//
// p515-sweep.mjs's `get_namespaces_first` moves the model epoch before each
// read (as a change to any manager does) without changing the manager it
// reads. This times the read itself just after the manager's own models
// changed: each sample deletes the set's last model file and adds it again
// (untimed, so the list is the same each time), then times one
// `getNamespaces()`. The result is the median read in microseconds, so it
// compares with p515-sweep's `get_namespaces_first` (n = 1). Inputs:
// fixtures/p515/<set>.json, as p515-sweep.mjs.

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];

const args = { coreDist: path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'), sets: SETS, samples: 30, warmup: 5, out: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--core-dist') { args.coreDist = path.resolve(v()); }
    else if (k === '--sets') { args.sets = v().split(','); }
    else if (k === '--samples') { args.samples = Number(v()); }
    else if (k === '--warmup') { args.warmup = Number(v()); }
    else if (k === '--out') { args.out = v(); }
    else { throw new Error(`unknown argument: ${k}`); }
}

const { ModelManager, ModelFile } = require(path.join(args.coreDist, 'index.js'));
const coreVersion = require(path.join(args.coreDist, '..', 'package.json')).version;

// As p515-sweep.mjs `withoutEnumIsAbstract` (P5-56), for every engine alike.
function loadSet(set) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${set}.json`), 'utf8'));
    for (const model of data.models || []) {
        for (const decl of model.ast.declarations || []) {
            if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
                delete decl.isAbstract;
            }
        }
    }
    return data;
}

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const results = [];
for (const set of args.sets) {
    const { models } = loadSet(set);
    const mm = new ModelManager();
    for (const { name, ast } of models) {
        mm.addModelFile(new ModelFile(mm, ast, undefined, name));
    }
    const last = models[models.length - 1];
    const namespace = mm.getModelFile(last.ast.namespace) ? last.ast.namespace : mm.getNamespaces().slice(-1)[0];
    const change = () => {
        mm.deleteModelFile(namespace);
        mm.addModelFile(new ModelFile(mm, last.ast, undefined, last.name));
    };
    const times = [];
    let expected;
    for (let i = 0; i < args.warmup + args.samples; i++) {
        change();
        const t0 = process.hrtime.bigint();
        const list = mm.getNamespaces();
        const t1 = process.hrtime.bigint();
        expected = expected ?? JSON.stringify(list);
        if (JSON.stringify(list) !== expected) {
            throw new Error(`${set}: getNamespaces changed across samples`);
        }
        if (i >= args.warmup) {
            times.push(Number(t1 - t0) / 1000);
        }
    }
    const medianUs = median(times);
    results.push({ op: 'get_namespaces_after_change', set, n: 1, namespaces: JSON.parse(expected).length, medianUs, samples: times.length });
    console.log(`get_namespaces_after_change ${set.padEnd(24)} ${String(JSON.parse(expected).length).padStart(4)} namespaces ${medianUs.toFixed(2).padStart(9)} us`);
}

const out = { tool: 'p575-change', coreDist: args.coreDist, coreVersion, node: process.version, cpu: os.cpus()[0].model,
    loadavgEnd: os.loadavg().map((x) => Number(x.toFixed(2))), samples: args.samples, warmup: args.warmup, results };
if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
}
