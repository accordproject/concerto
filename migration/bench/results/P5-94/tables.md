# P5-94: JS-side garbage of addModelFile and extract_cold

accordproject/concerto-rust#444, from P5-90 (#436). Local runs, Node 22.23.2, Intel i7-7820HQ, on a machine with other load (1-minute load 4-6 during the runs), so the per-call times are indicative only. "before" is concerto-core built from the integration head (f5f680a2c); "after" is this change. Both use the same engine build (concerto-wasm with this change's additive `...CompactFlat` bindings, which "before" never calls).

## JS allocation per call (V8 sampling heap profile, garbage included)

`p594-alloc.mjs` (`alloc-before.jsonl`, `alloc-after.jsonl`). `add_model_file` is `new ModelManager()` and one `addModelFile(new ModelFile(...))` per model of the set; `mm_new` is `new ModelManager()` alone.

| op | set | before KiB/call | after KiB/call | change |
|---|---|---:|---:|---:|
| mm_new | conformance | 77.9 | 14.2 | -82% |
| add_model_file | concerto-core-test-data | 363.5 | 116.6 | -68% |
| add_model_file | conformance | 345.8 | 123.8 | -64% |
| add_model_file | synthetic-large | 263.8 | 19.1 | -93% |
| extract_cold | concerto-core-test-data | 1120.4 | 1000.6 | -11% |
| extract_cold | conformance | 585.4 | 457.6 | -22% |
| extract_cold | synthetic-large | 1550.3 | 1478.3 | -5% |

What went, by source (concerto-core-test-data `add_model_file`, before):

- `Object.keys` per AST object in `encodeAst` (ast-codec.ts): 88 KiB (24%). Now `for...in` with an own-key check.
- The metamodel copy's `JSON.stringify` and its `JSON.stringify([text, ...])` memo key, and the two system models' `JSON.stringify`, on every `new ModelManager()`: about 55 KiB per manager. Now each AST's text is remembered with its compact bytes (`stableAstText`) and reused while the bytes are equal; the memo compares fields instead of a key string; the engine's system-model header is remembered for its text, and its parse shared.
- The `{"id", "header"}` staging result's parse (two objects and an array per short name) and text: about 50 KiB. Now `stageModelFileCheckedCompactFlat`/`...WithHeaderCompactFlat` return one flat array, without the implicit system import's five pairs, which the TS side appends from constants.
- Each lazily built `ModelFile` turned into a dictionary-mode object when its `declarations`/`localTypes` data properties were redefined as accessors: about 1 KiB a file (35 KiB). They are now defined as the accessors in the constructor, in the same place among its own keys, so the file keeps a fast shape.
- `modelFileIsCompatibleVersion`'s three crossings and key strings for an AST without `concertoVersion`: 10 KiB. Now skipped in JS for that case.
- `for...of` destructuring over the header pairs: iterator garbage; now indexed loops.

`extract_cold` keeps most of its allocation: it is the result itself (the result AST and command sets, `JSON.parse`d from the engine's text: 470 KiB of 1000 on concerto-core-test-data) and that text as a JS string (320 KiB, ASCII), which `JSON.parse` needs.

## GC share

### V8 CPU profile (the P5-90 method)

`p590-profile.mjs` then `p590-split.mjs`, 8 s per op and set, the shipped engine (`cpuprof/`). Share of profiled wall time in the garbage collector; us/call includes the profiler's overhead.

| op | set | before GC | after GC | before us/call | after us/call |
|---|---|---:|---:|---:|---:|
| add_model_file | concerto-core-test-data | 23.8% | 24.9% | 26391 | 15990 |
| add_model_file | conformance | 21.2% | 24.4% | 11957 | 6959 |
| add_model_file | synthetic-large | 20.8% | 19.1% | 25642 | 15195 |
| extract_cold | concerto-core-test-data | 32.9% | 33.0% | 44989 | 24851 |
| extract_cold | conformance | 25.8% | 25.0% | 15404 | 10553 |
| extract_cold | synthetic-large | 33.3% | 32.7% | 40115 | 38095 |

The GC share does not move. The time per call drops, but the machine was loaded, so take the times with care.

### Why: major collections for external memory, not JS garbage

`p594-gc.mjs` (`gc-before.jsonl`, `gc-after.jsonl`) counts the collections of the same loops. Run as one synchronous loop (as the sweep and the profile run them), nearly every collection is a major one (mark-compact), about 100 a second. `--trace-incremental-marking` gives "external memory pressure" as the reason for nearly all of them, with the JS heap steady at about 17 MB. Each dropped manager's engine handle holds its model files in WASM linear memory (about 185 KiB per conformance manager, `process.memoryUsage().external`) until wasm-bindgen's FinalizationRegistry callback frees it, and those callbacks cannot run until the loop yields to the event loop. So the WASM memory grows, and V8 starts a major collection for the external memory, again and again, which frees almost nothing.

With an event-loop turn every 10 calls (`--yield 10`; every batch for `extract_cold`), the callbacks run, and the GC share falls to 2-4% (16% for synthetic-large extract), before and after alike:

| op | set | event-loop turns | before us/call | after us/call | before GC share | after GC share | before GCs (minor/major) | after GCs (minor/major) |
|---|---|---|---:|---:|---:|---:|---|---|
| add_model_file | concerto-core-test-data | none | 11439.5 | 10755.5 | 20.2% | 21.1% | 5/475 | 2/484 |
| add_model_file | conformance | none | 5221.6 | 4551.9 | 18.6% | 17.7% | 8/405 | 4/420 |
| add_model_file | synthetic-large | none | 11879.8 | 11632.7 | 19.4% | 17.9% | 2/488 | 1/469 |
| add_model_file | concerto-core-test-data | every 10 | 4525.1 | 4112.7 | 2.3% | 1.9% | 20/21 | 3/28 |
| add_model_file | conformance | every 10 | 2763.3 | 2210 | 3.2% | 3.1% | 33/8 | 17/11 |
| add_model_file | synthetic-large | every 10 | 5168.2 | 5134.4 | 2.1% | 2.0% | 16/39 | 1/39 |
| extract_cold | concerto-core-test-data | none | 15061.1 | 14367.7 | 27.0% | 27.9% | 3/373 | 3/389 |
| extract_cold | conformance | none | 6418.7 | 6272.9 | 23.7% | 22.9% | 4/446 | 3/445 |
| extract_cold | synthetic-large | none | 23122 | 22084.4 | 37.7% | 34.5% | 6/478 | 4/513 |
| extract_cold | concerto-core-test-data | every 1 | 10195 | 10697.4 | 2.9% | 2.5% | 13/16 | 3/15 |
| extract_cold | conformance | every 1 | 4747.2 | 4401.7 | 3.4% | 3.5% | 4/22 | 4/25 |
| extract_cold | synthetic-large | every 1 | 17053.4 | 16689.3 | 15.8% | 14.0% | 12/109 | 10/109 |

The cut JS garbage shows as fewer minor collections (concerto-core-test-data `add_model_file`: 20 to 3) and lower times per call, but the 21-37% GC share P5-90 measured is the WASM memory of engine handles the synchronous loops cannot release, which this task's JS-side changes do not touch.
