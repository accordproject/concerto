# Differential fuzzing (task P5-05)

Plan: accordproject/concerto-rust#29 §2.5 ("Differential fuzzing"), §4 (Phase 5).
Issue: accordproject/concerto-rust#76.

Mutates models and instances drawn from the oracle corpus (`migration/oracle/fixtures`,
read-only) with a deterministic, seeded generator, runs each mutated case through the
TS reference-mode engine and the Rust/WASM engine, and diffs the canonical outcome
(verdict, error class, message, location) the same way `migration/oracle/lib/judge.js`
does for the recorded corpus.

**Scope, per the coordinator's comment on accordproject/concerto-rust#76:** this task
owns the harness only. It never edits `migration/oracle/`, the canonical corpus or
`baseline.tsv`, and never edits `packages/concerto-core/test/**` or `src/`. Every
divergence it finds is reported (`results/divergences.jsonl`) with a minimised,
reproducible seed; turning it into a permanent oracle fixture and fixing the losing
side is a follow-up task, not this one.

## Layout

```
lib/
  mutate.js     deterministic JSON mutation: mutate(value, seed) -> mutated value.
                A 32-bit integer seed fully determines the edits (mulberry32 PRNG),
                so {seedFile, mutationSeed} is a complete, reproducible repro.
  seeds.js      loads real oracle fixtures for the 4 targeted ops as mutation seeds,
                and knows which part of each fixture's `inputs` is a plain
                model/instance document (as opposed to `@@oracle`-encoded recipe
                scaffolding, which mutate.js must not be pointed at — see its
                TARGETS comment). Filters out any seed whose blobs the corpus is
                missing (a pre-existing corpus gap, not a bug this harness can fix).
  worker.js     runs as its own process, one per engine (ENGINE=ts|rust): the engine
                choice is read from the environment once at module load, so a TS
                adapter and a Rust adapter can never coexist in one process. Reads
                newline-delimited {id, op, inputs} requests from stdin, replays each
                through migration/oracle/lib/adapter.js (ts) or rust-adapter.js
                (rust), canonicalises the outcome exactly as judge.js does, and
                writes one newline-delimited result per request to stdout. Batching
                many cases through one process amortises ts-node/wasm start-up.
  run-batch.js  spawns one worker.js per engine per batch and pairs up results by id.
bin/
  fuzz.js       the driver: fast-check picks (seedIndex, mutationSeed) pairs
                deterministically from --run-seed, lib/mutate.js applies them,
                both engines run, and canonical outcomes are diffed with
                migration/oracle/lib/canon.js's sortedStringify.
results/
  run-*.json          one run's summary (planned/ran/agree/divergences/harness errors,
                      broken down by op).
  divergences.jsonl   one line per unresolved divergence: {op, seedFile,
                      mutationSeed, ts: <canonical outcome>, rust: <canonical outcome>}.
                      Reproduce with the "Reproducing a divergence" recipe below.
```

## Targeted ops

`lib/seeds.js`'s `TARGETS` fuzzes 4 ops, chosen to cover both models and instances
per the issue: `ModelManager.fromAst`, `ModelManager.addModelFile` (models),
`Serializer.fromJSON`, `Resource.validate` (instances). Each op's seeds come from
real corpus fixtures (`fixtures/data`, `.../conformance`, `.../unit`, `.../gaps`,
`.../lifted`), up to `--seeds-per-op` (default 25) per op.

## Running

Needs a built Rust/WASM engine (`sh concerto-wasm/build.sh` in a concerto-rust
checkout — this repo's `packages/concerto-engine` links to it) and the canonical
oracle corpus.

```sh
node migration/fuzz/bin/fuzz.js \
  --count 1000000 \
  --batch-size 1000 \
  --run-seed <any integer, for a reproducible run> \
  --fixtures-dir <concerto checkout>/migration/oracle/fixtures \
  --engine-module <concerto-rust checkout>/concerto-wasm/pkg/concerto-engine.cjs \
  --out migration/fuzz/results/run.json \
  --divergences migration/fuzz/results/divergences.jsonl
```

`FIXTURES_DIR` and `CONCERTO_ENGINE_MODULE` env vars work in place of the flags.
Case throughput on one core was measured at roughly 65-70 cases/s (dominated by the
TS side's ts-node compile and the Rust WASM instantiation per batch, amortised across
the batch); see the run summary's `started`/`finished` for the actual rate of any
given run.

## Reproducing a divergence

Each line of `divergences.jsonl` is reproducible without re-running the whole batch:

```js
const { loadSeeds, withMutatedDoc, getAt } = require('./lib/seeds');
const { mutate } = require('./lib/mutate');
const seeds = loadSeeds(fixturesDir, 25 /* must match the run's --seeds-per-op */);
const seed = seeds.find((s) => s.file.endsWith(divergence.seedFile) && s.op === divergence.op);
const doc = getAt(seed.raw.inputs, seed.path);
const mutatedDoc = mutate(doc, divergence.mutationSeed);
const inputs = withMutatedDoc(seed, mutatedDoc);
// then adapter.run(seed.op, unpackedInputs) per engine, as lib/worker.js does.
```

## Why only these ops, and why lenses instead of hand-built cases

The corpus already records, for real models and real instances, the exact recipe
(`@@oracle`-encoded model-manager/serializer/factory construction) each op needs to
run for real through the public API — the same recipes `migration/oracle/lib/adapter.js`
decodes for the recorded corpus. Reusing them means every fuzzed case exercises real
machinery (a real `ModelManager`, a real `Serializer`) instead of a hand-built stand-in,
and it is why `lib/mutate.js` is generic JSON-shape mutation rather than a
grammar-aware model/instance generator: mutating the *document* inside a real recipe
gets structurally-plausible-but-wrong models and instances for free, without having to
re-implement Concerto's grammar in the fuzzer.

The corresponding risk is mutating the recipe's own scaffolding instead of the
document — collapsing a `ModelManager` step or a `typed` resource's `ctor` field is a
harness error, not a divergence. `lib/seeds.js`'s `TARGETS` lenses point only at the
plain sub-document for each op (e.g. `Resource.validate`'s lens is `target.fields`,
not the whole `target` recipe), and `lib/mutate.js` additionally refuses to recurse
*into* any node that itself carries an `@@oracle` marker, so at worst such a node is
replaced or duplicated whole, never corrupted piecemeal.
