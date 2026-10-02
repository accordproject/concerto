#!/usr/bin/env node
// P5-78 spike (accordproject/concerto-rust#420), item 10 (cheap): the time
// to validate a plain-JSON instance, on the three benchmark model sets
// (migration/bench/fixtures/p515: models and instances), for
//   ts      TS 5.0.0 (migration/oracle/reference): Serializer.fromJSON (populate + validate)
//   engine  R1 TS API over the WASM engine (this checkout's packages/concerto-core/dist): the same call
//   proto   the Concertino prototype: check(model, json) (populate + validate, no Resource)
//   proto-n the prototype's normalise(model, json) (adds the toJSON step)
// One process per side and round, 3 rounds, sides in a rotating order, each
// started behind the quiet gate of the bench scripts (1-minute load < 2,
// 5-minute < 3, no other bench, cargo or mocha process). Node only: no
// headless Chromium on this machine (no browser binary, and installing one
// is out of scope).
//
//   node migration/spikes/P5-78/bin/speed.mjs [--rounds 3] [--samples 30] [--out FILE]
//   node migration/spikes/P5-78/bin/speed.mjs --side ts|engine|proto   (one timed part; used internally)
import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { execFileSync, execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SPIKE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SPIKE, '..', '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const SAMPLES = Number(opt('--samples', 30));

function loadSet(set) {
    const d = JSON.parse(fs.readFileSync(path.join(REPO, 'migration', 'bench', 'fixtures', 'p515', `${set}.json`), 'utf8'));
    for (const m of d.models) {
        for (const decl of m.ast.declarations || []) {
            if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
                delete decl.isAbstract; // as p515-sweep.mjs (P5-56)
            }
        }
    }
    return d;
}

async function side(name) {
    const { timeit } = await import(path.join(REPO, 'migration', 'bench', 'lib', 'timeit.mjs'));
    const out = [];
    for (const set of SETS) {
        const d = loadSet(set);
        const items = d.instances.map((i) => i.json);
        let run;
        if (name === 'ts' || name === 'engine') {
            const dist = name === 'ts'
                ? path.join(REPO, 'migration', 'oracle', 'reference', 'node_modules', '@accordproject', 'concerto-core', 'dist')
                : path.join(REPO, 'packages', 'concerto-core', 'dist');
            const core = require(path.join(dist, 'index.js'));
            const mm = new core.ModelManager();
            for (const { name: n, ast } of d.models) {
                mm.addModelFile(new core.ModelFile(mm, ast, undefined, n));
            }
            const s = new core.Serializer(new core.Factory(mm), mm);
            run = () => { for (const j of items) { s.fromJSON(j); } };
        } else {
            const S = require(path.join(SPIKE, 'build', 'node-all.cjs'));
            const r = S.resolver.resolveModels(d.models.map((m) => m.ast));
            const m = S.query.load(S.convertToConcertino(r.models));
            if (name === 'proto') {
                run = () => {
                    for (const j of items) {
                        const c = S.validator.check(m, j);
                        if (!c.ok) {
                            throw c.error;
                        }
                    }
                };
            } else {
                run = () => { for (const j of items) { S.validator.normalise(m, j); } };
            }
        }
        run(); // must not throw: every benchmark instance is valid
        const st = timeit(run, { warmup: 5, samples: SAMPLES, n: items.length });
        out.push({ set, n: items.length, medianUs: st.median_ms * 1000, cv: st.cv });
    }
    return out;
}

if (opt('--side', null)) {
    console.log(JSON.stringify(await side(opt('--side'))));
    process.exit(0);
}

const ROUNDS = Number(opt('--rounds', 3));
const OUT = opt('--out', path.join(SPIKE, 'results', 'speed.json'));
const loads = () => os.loadavg().map((x) => Number(x.toFixed(2)));
function gate() {
    for (let waited = 0; ; waited += 30) {
        const [l1, l5] = os.loadavg();
        // Other benchmark, cargo, mocha or oracle-replay processes (read from /proc,
        // so this process and the shells it spawns never count themselves).
        const BUSY = /run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|change)|--bench|criterion|(^|\/)cargo( |$)|mocha|replay\.js|bin\/speed\.mjs --side/;
        let busy = 0;
        for (const pid of fs.readdirSync('/proc').filter((x) => /^\d+$/.test(x))) {
            if (Number(pid) === process.pid) {
                continue;
            }
            try {
                const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ');
                if (BUSY.test(cmd)) {
                    busy++;
                }
            } catch (e) {
                // gone
            }
        }
        if (l1 < 2 && l5 < 3 && busy === 0) {
            return { waited, loads: loads() };
        }
        if (waited > 7200) {
            throw new Error(`quiet gate: gave up after ${waited}s (load ${loads()})`);
        }
        execSync('sleep 30');
    }
}
const SIDES = ['ts', 'engine', 'proto', 'proto-n'];
const rounds = [];
for (let r = 0; r < ROUNDS; r++) {
    const order = SIDES.slice(r % SIDES.length).concat(SIDES.slice(0, r % SIDES.length));
    const parts = {};
    for (const s of order) {
        const g = gate();
        const res = JSON.parse(execFileSync(process.execPath, [url.fileURLToPath(import.meta.url), '--side', s, '--samples', String(SAMPLES)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
        parts[s] = { gate: g, results: res };
        console.error(`round ${r + 1} ${s} done (gate waited ${g.waited}s, load ${g.loads})`);
    }
    rounds.push({ order, parts });
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const table = [];
for (const set of SETS) {
    const row = { set };
    for (const s of SIDES) {
        row[s] = median(rounds.map((r) => r.parts[s].results.find((x) => x.set === set).medianUs));
        row[`${s}Rounds`] = rounds.map((r) => Number(r.parts[s].results.find((x) => x.set === set).medianUs.toFixed(2)));
    }
    row.n = rounds[0].parts.ts.results.find((x) => x.set === set).n;
    table.push(row);
}
let commit = null;
try {
    commit = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
} catch (e) {
    // not a checkout
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ tool: 'speed', commit, node: process.version, cpu: os.cpus()[0].model, samples: SAMPLES, rounds, table }, null, 1));
for (const r of table) {
    console.log(`${r.set.padEnd(24)} n=${r.n}  ts ${r.ts.toFixed(2)}  engine ${r.engine.toFixed(2)}  proto ${r.proto.toFixed(2)}  proto-n ${r['proto-n'].toFixed(2)}  us/item`);
}
