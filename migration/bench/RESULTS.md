# Baseline: TS vs current Rust (task P5-04a)

Committed baseline for accordproject/concerto-rust#92 (task P5-04a, under
the migration plan accordproject/concerto-rust#29). Recorded from one run
of each harness, on the same machine, back to back. Detailed JSON is in
`results/` (TS) and `accordproject/concerto-rust`'s `benches/results/`
(Rust) - the timestamps below match the committed files there.

## Machine and toolchain

| | |
|---|---|
| CPU | Intel(R) Xeon(R) Processor @ 2.80GHz, 4 cores |
| Memory | 16 GiB |
| OS | Linux |
| Node | v22.22.2 |
| npm | 10.9.7 |
| rustc | 1.94.1 (e408947bf 2026-03-25) |
| cargo | 1.94.1 (29ea6fb6a 2026-03-24) |
| criterion | 0.5.1 |
| `concerto` commit | `b81adfad8c8d` (branch `claude/tender-pascal-ocwf9q`) |
| `concerto-rust` commit | `75615c461cf8` (branch `claude/tender-pascal-ocwf9q`) |
| TS run | `results/2026-09-24T16-46-49-815Z-ts.json` |
| Rust run | `concerto-rust`'s `benches/results/2026-09-24T17-01-44Z-rust.json` |

Both TS and Rust raw JSON carry standard deviation and coefficient of
variation (CV) per entry (`stddev_ms`/`cv` on the TS side,
`stddev_ns_per_batch`/`cv` on the Rust side); the tables below report
median and CV per workload, per the issue ("Report medians and variance
per workload in a markdown table").

## Workload 1: load, then validate, a model set

All figures are medians, per model (µs/op). "Rust /TS" is Rust's time
divided by TS's (< 1 means Rust is faster) - a ratio is only given where
both sides currently succeed on the *same* set of models; see the notes.

| Model set | n | Phase | TS (µs) | TS CV | Rust (µs) | Rust CV | Rust /TS |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | 35 | load | 45.5 | 25.3% | 118.2 | 3.7% | 2.60× (slower) |
| concerto-core-test-data | 35 | validate | 105.0 | 23.5% | SKIPPED¹ | - | - |
| conformance | 41 | load | 21.6 | 31.5% | 41.4 | 3.1% | 1.92× (slower) |
| conformance | 41 | validate | 32.7 | 20.0% | 7.8 | 2.7% | **0.24× (4.2× faster)** |
| synthetic-large | 1 (300 decls) | load | 980.4 | 22.0% | 7111.8 | 1.8% | 7.25× (slower)² |
| synthetic-large | 1 (300 decls) | validate | 3902.7 | 29.2% | SKIPPED¹ | - | - |

CV (coefficient of variation, stddev/mean) is per-sample noise within
one run, not run-to-run drift - see "Reproducibility" below for that.
TS's CV is consistently higher than Rust's on this workload: these are
mostly sub-100µs-per-op operations in a shared, sandboxed environment,
where Node's JIT warm-up and GC pauses add more relative jitter than a
natively-compiled Rust binary sees for the same work.

¹ `validate_models` (Rust) does not yet accept these two sets: both
contain a relationship whose target's identifier is inherited from a
supertype rather than declared directly, which the trial port does not
yet resolve (plan §1.2: "explicit-over-explicit identity and inherited
identifier lookup"; see `concerto-rust`'s DIVERGENCES.md). This is a
real, current gap, not a benchmark artifact - it is exactly the kind of
thing this baseline exists to surface before later phases close it.

² `load` here is real, structural work only (no semantic validation) -
the current trial port's `from_json`/newtype construction is
meaningfully slower than TS's for one large model (300 declarations).
Worth a look before treating the 4.2× validate speed-up as
representative: the two model sets where Rust is currently *slower*
than TS (`load` on all three sets, `synthetic-large` end to end) are
just as real a baseline number as the sets where it is faster, and the
whole point of committing this table now is to have both, honestly,
before more of the port lands.

## Workload 2: validating the metamodel AST

TS's `validateAst` vs two independent Rust structural checks:
`concerto-core`'s `ModelFile::from_json` (deserialising into the typed
metamodel schema - the operation `add_model`'s `load` above already
performs; this workload isolates it on its own) and the separate
`concerto-validate-rs` crate's `validate_metamodel`.

| Model set | n (TS / core / validate-rs) | TS validateAst (µs) | TS CV | concerto-core from_json (µs) | core CV | core /TS | concerto-validate-rs (µs) | validate-rs CV | validate-rs /TS |
|---|---|---|---|---|---|---|---|---|---|
| concerto-core-test-data | 34 / 35 / 17³ | 871.2 | 5.6% | 100.8 | 0.05% | **0.116× (8.6× faster)** | 47.1 | 2.5% | **0.054× (18.5× faster)³** |
| conformance | 41 / 41 / 40 | 329.9 | 4.3% | 34.9 | 0.4% | **0.106× (9.5× faster)** | 39.2 | 3.5% | **0.119× (8.4× faster)** |
| synthetic-large | 0 / 1 / 0 | SKIPPED⁴ | - | 7033.9 | 0.5% | - | SKIPPED⁵ | - | - |

³ Different, overlapping subsets: TS's `validateAst` rejects one model
in this set that the normal load path accepts (a `DateTimeProperty`
with a `defaultValue` - an edge case in `validateAst` specifically, not
in the load path benchmarked in workload 1), leaving 34/35;
`concerto-validate-rs` currently accepts only 17/35 (see the plan's
§1.3 "confirmed bugs" - no Long, DateTime, relationship or enum
support, and only direct-supertype property merging). The `core /TS`
and `validate-rs /TS` ratios are still directly comparable *per model
they do handle*, since each side's own median is already per-operation,
but they are not the same 35 models - take the ratio as indicative, not
exact.

⁴ Every model in the one-model `synthetic-large` set hits a
`validateAst`-specific edge case (see the note above); `concerto-core`'s
plain structural check has no such issue with it.

⁵ `concerto-validate-rs` accepts none of `synthetic-large`'s constructs
yet (relationships and inheritance chains at this scale).

## Workload 3: instance validation (TS only)

Per the issue, the Rust side is filled in once instance validation lands
(task P3-01); `concerto-core` has no instance layer yet.

| Metric | n | TS (µs/op) | TS CV |
|---|---|---|---|
| `Serializer#fromJSON` (populate + validate) | 500 | 10.4 | 9.7% |
| `Resource#validate()` alone | 500 | 3.0 | 18.3% |

## Reproducibility

Two consecutive `run-ts.mjs` runs on this machine reproduced every
workload's median within about 10-15% (e.g. `concerto-core-test-data`
`load`: 44.9 µs then 48.2 µs; `synthetic-large` `load`: 1025.1 µs then
1012.2 µs; `validateAst` on `conformance`: 341.0 µs then 355.7 µs). The
Rust side's `--quick` and full runs agreed even more closely (e.g.
`load_validate/conformance/load`: 1.65 ms quick vs 1.68 ms full, for the
whole 41-model batch). Per-sample coefficient of variation is noisier for
the smallest, sub-100µs-per-op workloads in this shared, sandboxed
environment (GC pauses, scheduler jitter) - see `migration/bench/README.md`'s
"Variance" section - but the medians hold up across reruns, which is what
the exit condition asks for.

## Refreshing this table

```sh
# TS
cd concerto && node migration/bench/run-ts.mjs

# Rust (add --features validate-rs for the concerto-validate-rs half of
# workload 2 - see concerto-rust's benches/README.md for what that
# implies)
cd concerto-rust && cargo bench --manifest-path benches/Cargo.toml --features validate-rs && ./benches/extract-results.sh
```

Re-run after phases P2, P3 and P4 land, as the plan asks (§4, task P5-04),
and update the table above from the new `results/*.json` files.
