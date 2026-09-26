#!/usr/bin/env node
// The one documented TS benchmark command, originally for task P5-04a and
// extended by task P5-04 (accordproject/concerto-rust#75) to also drive the
// Rust-backed concerto-core through the same public API.
//
//   node migration/bench/run-ts.mjs [--samples N] [--warmup N] [--out FILE]
//
// Runs against the built `dist/` of packages/concerto-core (`npm run build
// -w packages/concerto-core`, after `npm ci` at the repo root - see
// migration/bench/README.md), using tinybench-style manual sampling (see
// lib/timeit.mjs; no new dependency is added, since this task's owned path
// is `migration/bench/` only).
//
// CONCERTO_ENGINE=rust (task P5-04): runs the exact same workloads through
// the WASM-backed Rust engine instead of the TS reference implementation -
// concerto-core's own engine shim (packages/concerto-core/src/engine/)
// reads this variable, so no code here changes; only the built dist/
// behaves differently. This is the "views" path (through concerto-core's
// public API, with the usual TS<->WASM boundary crossings per call), which
// is a different, and currently much less favourable, comparison than the
// Rust crate's own criterion benches (concerto-rust's benches/, which call
// concerto-core directly, no TS or WASM involved) - see this directory's
// README and RESULTS.md for both numbers and what each one means. Needs
// `@accordproject/concerto-engine` built and linked first -
// packages/concerto-engine/README.md.
//
// Workloads (see the plan, tasks P5-04a and P5-04):
//   1. load_validate  - load, then validate, each of three model sets.
//   2. validate_ast   - ModelManager#validateAst over the same model sets.
//   3. instance_validate - generates 500 instances of a small synthetic
//      concept and times Serializer#fromJSON (populate+validate) and
//      Resource#validate() on its own. Under CONCERTO_ENGINE=rust this
//      exercises concerto-core's instance validator (task P3-01) through
//      the same TS entry points; there is still no Rust JSONPopulator (see
//      concerto-rust's instance_validate.rs bench docs), so fromJSON's
//      populate step is TS-only work even in rust mode - only the combined
//      fromJSON number and validate_only are comparable to the ts-mode run
//      of this same script, not to the Rust crate's own criterion number.
//
// Prints a markdown table to stdout and writes the full JSON results to
// `--out` (default: migration/bench/results/<timestamp>-ts.json).

import fs from 'fs';
import path from 'path';
import os from 'os';
import url from 'url';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { timeit } from './lib/timeit.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CORE_DIST = path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist');
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'model-sets');
const RESULTS_DIR = path.join(__dirname, 'results');

function parseArgs(argv) {
    const args = { samples: 30, warmup: 5, out: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--samples') {
            args.samples = Number(argv[++i]);
        } else if (a === '--warmup') {
            args.warmup = Number(argv[++i]);
        } else if (a === '--out') {
            args.out = argv[++i];
        } else {
            throw new Error(`unknown argument: ${a}`);
        }
    }
    return args;
}

function requireDist(rel) {
    const p = path.join(CORE_DIST, rel);
    if (!fs.existsSync(p)) {
        throw new Error(
            `${rel} not found under ${CORE_DIST}. Build concerto-core first: ` +
            'npm ci && npm run build -w packages/concerto-core (from the repo root).',
        );
    }
    return require(p).default;
}

function loadModelSet(setName) {
    const dir = path.join(FIXTURES_DIR, setName);
    if (!fs.existsSync(dir)) {
        return null;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    return files.map((f) => ({
        name: f,
        ast: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')),
    }));
}

// ---------------------------------------------------------------------------
// Workload 1: load, then validate, a model set.
// ---------------------------------------------------------------------------

function benchLoadValidate(AstModelManager, set, sampleOpts) {
    function loadOnly() {
        const mm = new AstModelManager();
        for (const { name, ast } of set) {
            // disableValidation: per-file semantic checks run in the
            // `validate` phase below instead, via validateModelFiles(),
            // matching the Rust side's add_model (structural only) then
            // validate_models (semantic, whole-manager) split.
            mm.addModel(ast, undefined, name, true);
        }
        return mm;
    }

    const load = timeit(() => loadOnly(), { ...sampleOpts, n: set.length });

    let validate = null;
    let validateError = null;
    try {
        loadOnly().validateModelFiles();
        validate = timeit(
            () => {
                const mm = loadOnly();
                mm.validateModelFiles();
            },
            { ...sampleOpts, n: set.length },
        );
    } catch (e) {
        validateError = e.message;
    }

    return { load, validate, validateError, n: set.length };
}

// ---------------------------------------------------------------------------
// Workload 2: validateAst.
// ---------------------------------------------------------------------------

function benchValidateAst(ModelManager, set, sampleOpts) {
    const mm = new ModelManager({ metamodelValidation: true });
    // validateAst adds/removes the metamodel model file itself when it is
    // not already present (see basemodelmanager.ts); the system model is
    // always present on a fresh manager, so this is a pure structural
    // check with no other side effects between calls.
    //
    // validateAst runs the AST through the serializer's own strict schema
    // check, which is pickier about a few constructs (observed:
    // `defaultValue` on a DateTimeProperty) than the normal load path is.
    // We check each file once outside the timed section and only benchmark
    // the subset that currently passes, same as the Rust harness does for
    // concerto-validate-rs, rather than let one file's edge case sink the
    // whole model set's timing.
    //
    // CONCERTO_ENGINE=rust (task P5-04, accordproject/concerto-rust#75):
    // `BaseModelManager#validateAst`'s rust-delegating branch also calls
    // `modelFile.getName()` (see basemodelmanager.ts), which the TS branch
    // this fake stood in for never needed - the stub gets a `getName` too,
    // so the same call works under either engine.
    const supported = set.filter(({ name, ast }) => {
        try {
            mm.validateAst({ getAst: () => ast, getName: () => name });
            return true;
        } catch {
            return false;
        }
    });

    if (supported.length === 0) {
        return { validateAst: null, n: set.length, error: 'validateAst rejects every model in this set' };
    }
    if (supported.length < set.length) {
        console.error(
            `validate_ast: benchmarking ${supported.length}/${set.length} models in this ` +
            'set - the rest hit edge cases validateAst does not accept',
        );
    }

    const result = timeit(
        () => {
            for (const { name, ast } of supported) {
                mm.validateAst({ getAst: () => ast, getName: () => name });
            }
        },
        { ...sampleOpts, n: supported.length },
    );
    return { validateAst: result, n: supported.length, totalInSet: set.length };
}

// ---------------------------------------------------------------------------
// Workload 3: instance validation (TS only).
// ---------------------------------------------------------------------------

function buildInstanceWorkload(ModelManager) {
    const cto = `
namespace org.accordproject.bench.instance@1.0.0

concept Item identified by id {
  o String id
  o Integer sequence
  o Double weight optional
  o Boolean active
  o String[] labels optional
}
`;
    const mm = new ModelManager();
    mm.addCTOModel(cto, 'bench-instance.cto', true);
    mm.validateModelFiles();

    const NUM_INSTANCES = 500;
    const instances = [];
    for (let i = 0; i < NUM_INSTANCES; i++) {
        instances.push({
            $class: 'org.accordproject.bench.instance@1.0.0.Item',
            id: `item-${i}`,
            sequence: i,
            weight: i * 1.5,
            active: i % 2 === 0,
            labels: [`label-${i % 7}`, `tag-${i % 3}`],
        });
    }
    return { mm, instances };
}

function benchInstanceValidate(ModelManager, sampleOpts) {
    const { mm, instances } = buildInstanceWorkload(ModelManager);
    const serializer = mm.getSerializer();

    const populate = timeit(
        () => {
            for (const json of instances) {
                serializer.fromJSON(json);
            }
        },
        { ...sampleOpts, n: instances.length },
    );

    const resources = instances.map((json) => serializer.fromJSON(json));
    const validateOnly = timeit(
        () => {
            for (const r of resources) {
                r.validate();
            }
        },
        { ...sampleOpts, n: resources.length },
    );

    return { populate_and_validate: populate, validate_only: validateOnly, n: instances.length };
}

// ---------------------------------------------------------------------------

function gitCommit(dir) {
    try {
        return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const AstModelManager = requireDist('astmodelmanager.js');
    const ModelManager = requireDist('modelmanager.js');

    const sampleOpts = { warmup: args.warmup, samples: args.samples };
    const setNames = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
    const results = {
        harness: 'run-ts.mjs',
        recorded_at: new Date().toISOString(),
        machine: {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus()?.[0]?.model,
            cpu_count: os.cpus()?.length,
            total_mem_gb: Math.round(os.totalmem() / 1e9),
            node: process.version,
        },
        concerto_commit: gitCommit(REPO_ROOT),
        // task P5-04 (accordproject/concerto-rust#75): which engine served
        // concerto-core's public API for this run - 'ts' (the default) or
        // 'rust' (CONCERTO_ENGINE=rust, the WASM-backed engine, see
        // packages/concerto-core/src/engine/). Recorded so a results file
        // is self-describing without cross-checking how it was invoked.
        concerto_engine: process.env.CONCERTO_ENGINE === 'rust' ? 'rust' : 'ts',
        sample_opts: sampleOpts,
        workloads: {},
    };

    results.workloads.load_validate = {};
    results.workloads.validate_ast = {};
    for (const setName of setNames) {
        const set = loadModelSet(setName);
        if (!set) {
            results.workloads.load_validate[setName] = { error: 'fixture set missing' };
            results.workloads.validate_ast[setName] = { error: 'fixture set missing' };
            continue;
        }
        results.workloads.load_validate[setName] = benchLoadValidate(AstModelManager, set, sampleOpts);
        results.workloads.validate_ast[setName] = benchValidateAst(ModelManager, set, sampleOpts);
    }

    results.workloads.instance_validate = benchInstanceValidate(ModelManager, sampleOpts);

    // --- report ---
    const lines = [];
    lines.push('| Workload | Model set | n | Metric | Median (per op) | CV |');
    lines.push('|---|---|---|---|---|---|');
    for (const setName of setNames) {
        const lv = results.workloads.load_validate[setName];
        if (lv?.error) {
            lines.push(`| load_validate | ${setName} | - | - | ${lv.error} | - |`);
            continue;
        }
        lines.push(`| load_validate | ${setName} | ${lv.n} | load | ${(lv.load.median_ms * 1000).toFixed(1)} µs | ${(lv.load.cv * 100).toFixed(1)}% |`);
        if (lv.validate) {
            lines.push(`| load_validate | ${setName} | ${lv.n} | validate | ${(lv.validate.median_ms * 1000).toFixed(1)} µs | ${(lv.validate.cv * 100).toFixed(1)}% |`);
        } else {
            lines.push(`| load_validate | ${setName} | ${lv.n} | validate | SKIPPED: ${lv.validateError} | - |`);
        }
        const va = results.workloads.validate_ast[setName];
        if (va.validateAst) {
            lines.push(`| validate_ast | ${setName} | ${va.n} | validateAst | ${(va.validateAst.median_ms * 1000).toFixed(1)} µs | ${(va.validateAst.cv * 100).toFixed(1)}% |`);
        } else {
            lines.push(`| validate_ast | ${setName} | ${va.n} | validateAst | SKIPPED: ${va.error} | - |`);
        }
    }
    const iv = results.workloads.instance_validate;
    lines.push(`| instance_validate | (synthetic) | ${iv.n} | fromJSON (populate+validate) | ${(iv.populate_and_validate.median_ms * 1000).toFixed(1)} µs | ${(iv.populate_and_validate.cv * 100).toFixed(1)}% |`);
    lines.push(`| instance_validate | (synthetic) | ${iv.n} | resource.validate() | ${(iv.validate_only.median_ms * 1000).toFixed(1)} µs | ${(iv.validate_only.cv * 100).toFixed(1)}% |`);

    console.log(`# TS benchmark results (${results.recorded_at}), engine=${results.concerto_engine}\n`);
    console.log(`Node ${results.machine.node} on ${results.machine.cpus} (${results.machine.cpu_count} cpus), concerto@${results.concerto_commit?.slice(0, 12)}\n`);
    console.log(lines.join('\n'));

    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const outFile = args.out
        ? path.resolve(args.out)
        : path.join(RESULTS_DIR, `${results.recorded_at.replace(/[:.]/g, '-')}-ts.json`);
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2) + '\n', 'utf8');
    console.error(`\nFull results written to ${path.relative(REPO_ROOT, outFile)}`);
}

main();
