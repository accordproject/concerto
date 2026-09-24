# Plan: Run concerto-core on a Rust engine

**Status:** v2.3: all decisions (D1–D11) accepted; Phase 0 done except the P0-04 split; the tracker is live in accordproject/concerto-rust (#29–#85). (v2.3 adds D11 and Phase 6, splits P0-04 into P0-04a/b, adds P2-12, and records the merge policy.)
**Repos:** `accordproject/concerto`, `accordproject/concerto-rust`, `accordproject/concerto-validate-rs`. Each has a branch named `claude/tender-pascal-ocwf9q`.

**v2 changes:**
- The unit tests are now used as an *oracle* rather than a constraint on design (§2).
- The Rust engine owns the model graph.
- The done criteria have been rewritten (§0).
- The blog post's "what lies ahead" items are folded in.
- Decisions D1–D5 and D8 are recorded as accepted.

---

## 0. Done criteria
1. **Behavioural unit tests pass unchanged against the Rust-backed concerto-core.** These are tests that drive concerto-core only through its public API and fixtures, not through stubs of concerto-core classes. Behavioural tests are expected to be the large majority (§2.1). Each test is classified by the tagging task P0-02.
2. **White-box tests also pass unchanged in the same run.** These are tests that stub or spy on concerto-core internals: mainly `jsonpopulator.js`, `modelmanager.js`, `resourcevalidator.js`, `modelfile.js` and `assetdeclaration.js`.
   - Where that turns out to be impossible, the test is covered instead by *lifted* black-box fixtures (§2.2) that exercise the same behaviour.
   - Each such exception is listed with its lifted replacement and signed off in review.
   - Test files are never edited.
3. **A behavioural oracle corpus** is recorded from the TS reference (§2.2). It must:
   - reach **at least the unit suite's own coverage of the TS reference**, which is 99% statements and lines and 94.8% branches (nyc);
   - pass **100%** on Rust natively (`cargo test`) and through the JS binding.
4. **At least 70% of concerto-core logic, by weight, runs in Rust** (D1).
5. **The public TS API is unchanged:** exports, deep `src/...` paths and the `.d.ts` snapshot.
6. **Rust test strength:** llvm-cov ≥ 90% lines on `concerto-core`, and a `cargo-mutants` catch rate ≥ 85% on the validation modules.
7. **Upstream conformance:** the `concerto-conformance` Rust harness is updated to the current API, and the conformance CI job is green.

---

## 1. Starting point

### 1.1 TypeScript concerto-core (v5.0.0)
- 59 source files, about 12.4k lines, 43 exports.
- About 1,120 `it()` tests, outside `test/scripts`.
- Coverage gate: `nyc all:true`, requiring 99% statements, 94.8% branches, 99% functions, 99% lines.
- Builds: CJS, ESM, and an ESM browser bundle, plus a Playwright e2e test.
- CTO parsing is in `concerto-cto`, which is out of scope.

**Where the white-box coupling is.** It is concentrated in a few files:

| File | Tests | `createStubInstance` calls | Nature |
|---|---|---|---|
| `serializer/jsonpopulator.js` | 65 | 57 | visitor over stub Resource and Field objects |
| `modelmanager.js` | 105 | 36 | stubs the CTO `Parser` and `FileDownloader`; also touches `modelFiles[ns]` |
| `serializer/resourcevalidator.js` | 45 | 8 | visitor over stubs |
| `introspect/assetdeclaration.js`, `scalars.js`, `field.js`, `property.js`, `modelutil.js`, `serializer.js`, `validator.js` | – | 1–6 each | local |

- **388 tests in 33 files use no stubs, spies or internal fields at all.** Most other files stub in only one or two tests (for example `mapdeclaration.js`: 72 tests, 1 stub).
- About 320 assertions check exact error message text, and about 81 check the exception class. So compatibility means *same verdict, same message, same exception class and same location*.

### 1.2 concerto-rust, after GSoC 2026
The blog post and the repo agree on what exists:
- `concerto-metamodel`: generated code, with regeneration pinned to concerto-cli 4.0.2 (offline unless the pin is bumped). The crate is version 3.13.1, but TS uses `^3.17`.
- `concerto-core`: declarations as sum types (`Declaration`, `ClassDeclaration` plus `ClassKind`, a 9-variant `Property`); `ModelManager`; two-phase validation (load-time checks, then `validate_models`); first-error reporting in a stable order; `IllegalModel` vs `ValidationFailed` errors.
- **All 30 specification rules are implemented.** Against `concerto-conformance`, the result is **62/65 scenarios** that have AST fixtures:
  - 10 of the 75 scenarios have no usable fixture;
  - 2 expect errors the reference runtime never raises;
  - 1 is a pre-v4 AST.
- 90 unit tests plus 7 doctests pass here.
- **The conformance CI job is red**, because the upstream Rust harness targets an API that was never built.
- **Gaps against TS** (from this analysis):
  - super-type kind compatibility;
  - explicit-over-explicit identity and inherited identifier lookup;
  - implicit `Concept` super type and the `$identifier`/`$timestamp` fields;
  - enum duplicate and reserved values;
  - scalar-named-like-a-primitive;
  - `defaultValue` checks;
  - JS regex dialect and flags;
  - `Decorator.validate` (argument count and types, type references);
  - duplicate decorators on every node type;
  - map values: Rust wrongly rejects relationship and enum values;
  - semver and `concertoVersion` checks;
  - the exact `ID_REGEX`;
  - error locations.
- Hand-built structs sit next to the `mm::*` types, and the root model is read into a `serde_json::Value`.
- Repetition: `name()` ×5, nine-arm `Property` matches ×6, `IllegalModel{..}` built by hand ×32.
- There is no proc-macro crate and no instance layer, and `concerto-vocabulary` is a stub.

### 1.3 concerto-validate-rs
- Provides structural metamodel validation, and is about 10× faster than TS according to the blog.
- `build.rs` downloads `metamodel.json` from GitHub raw, but tracks unpinned `main` and writes into the source tree.
- **Confirmed bugs:**
  - only the direct super type's properties are merged, so a valid `StringScalar` is rejected;
  - abstract and nested `$class` values are not checked;
  - no support for Long, DateTime, relationships or enums;
  - errors are stringly typed.

### 1.4 Inputs this plan folds in
| Source | Item | Task |
|---|---|---|
| concerto-rust #28 | NAPI/WASM packaging, running concerto tests against it | P4-01, P4-02 |
| concerto-rust #26 | Relax import order | P1-06 |
| concerto-rust #25 | Map key/value types aligned with TS | P2-06 |
| concerto-rust #24 | Debug reflection | P1-01 |
| concerto-rust #27 | crates.io publish | out of scope (D9) |
| Blog, "what lies ahead" | Instance validation | P3-01 … P3-04 |
| Blog | Update the concerto-conformance Rust harness; get CI green | P0-07 |
| Blog | Criterion benchmark against TS on the same models | P5-04 |
| Blog | WASM, NAPI and C# bindings | P4-01 (WASM), P4-12 (NAPI); C# is out of scope |
| Blog lesson | "A test suite is evidence, not truth": the fixture-missing false passes, and the check that never ran | mutation testing (§0.6), judge self-check (P0-05) |
| Maintainer pointers | Test parity, validation gaps, traits and derives, #1273, metamodel via serde, build-time download | P2-x, P2-09, P1-03, P3-02, P1-02, P1-01 |

---

## 2. Compatibility strategy: from unit tests to an oracle

Stubbed tests pin down *how* the TS code is structured, not *what* it does. So the plan stops treating the unit suite as the only judge and pulls out of it the behaviour it asserts.

### 2.1 Tag every test (P0-02)
Each `it()` gets one of three tags, stored in `migration/test-tags.tsv`:
- **B (behavioural):** drives concerto-core only through the public API and fixtures. Stubbing *external* collaborators (the CTO `Parser`, `FileDownloader`, `uuid`, `dayjs`) is still B.
- **W (white-box):** stubs, spies on or reads concerto-core internals such as `visitX` methods, `_resolveSuperType`, or a `ModelFile` built from stubs.
- **M (message/unit):** pure-function tests, for example `Globalize` and exceptions.

Tagging is automated from the AST (acorn) plus a sinon trace, then reviewed. The report is B/W/M counts, with pass rates tracked separately.

### 2.2 Record a golden oracle from the reference (P0-05)
- Instrument the **TS reference** (the published `@accordproject/concerto-core@5.0.0`, so the oracle stays frozen after concerto-core switches over).
- Run the **whole unit suite**, and every model in `test/data`, `test/1.0.0` and `concerto-conformance`.
- Record each call at the *public semantic boundary* as a language-neutral fixture: `{op, inputs (AST/JSON/options), outcome: ok(result JSON) | error(class, message, location, component)}`.
  - Ops covered: `addModel(s)`, `validate`, `getType`, `resolveType`, `isAssignableTo`, `Serializer.fromJSON`/`toJSON`, `Resource.validate`, `validateAst`, the DCS operations, and so on.
  - Results are canonicalised: sorted keys, ids and timestamps normalised.
- Behavioural tests yield fixtures directly. White-box tests yield fixtures wherever their data reaches real logic.

### 2.3 Lift the white-box tests (P2-10)
- For each W test, an agent writes a **black-box fixture that exercises the same rule**. Example: *"ModelFile built from a stub whose `getType` returns an abstract class"* becomes *"a model with an abstract super type"*.
- The fixture is **checked against the reference** first, so the oracle defines the expected outcome, not the agent.
- Test files stay untouched. Lifted fixtures live in `migration/oracle/lifted/`.

### 2.4 Measure the oracle's coverage of the reference (P0-05, P5-01)
- Run nyc on the TS reference with **only the oracle corpus** as the driver.
- Coverage below the unit suite's own coverage means the corpus is missing behaviour. The uncovered branches become lifting tasks automatically.
- This is the "coverage without the restriction" metric: behavioural coverage of the reference that does not depend on any internal structure.

### 2.5 Run everything against Rust
The oracle runs in three places:
- `cargo test`: a native harness reads the fixtures.
- **Differential mode:** the same op goes through the TS reference and through the Rust engine via WASM, and the results are diffed.
- **Differential fuzzing (P5-05):** models and instances are mutated from the corpus with `fast-check`, and the verdict, message and class are compared.

The unchanged unit suite still runs against the Rust-backed concerto-core as the final gate.

### 2.6 Keep the checks honest
Following the blog's lesson that a test suite is evidence, not truth:
- The judge must **fail a set of known mutants** of the Rust engine.
- A fixture whose input is missing is a *harness error*, never an "expected error".
- `cargo-mutants` runs on the validation modules, and the survivors become test tasks.

---

## 3. Target architecture (revised: Rust owns the graph)

Because behaviour is judged by the oracle, the TS classes no longer need to hold their own logic:

```
concerto-core (TS, public API unchanged)
  src/**/*.ts            ← thin views: each ModelManager / ModelFile / Declaration / Property holds a Rust handle;
                           getters and validate() delegate; `.ast` and the other public fields become live getters
  src/engine/ (NEW)      ← loader, handle registry, error → TS exception mapper (exact class, message, location)
  kept in TS (ledger-justified): Resource/Typed dynamic objects, Factory (uuid/dayjs), visitor dispatch,
                           pluggable options.regExp, CTO parsing (concerto-cto)
        ▼
@accordproject/concerto-engine (NEW, concerto-rust/concerto-wasm, wasm-bindgen, sync instantiation)
        ▼
concerto-rust: concerto-metamodel (build-time download + native codegen)
             · concerto-macros (derives, re-exported as concerto_core::derive)
             · concerto-core (introspection, semantic + instance validation, #1273/#1239 API, message catalogue)
             · concerto-wasm
```

- **Visitors and instances.** `JSONPopulator`, `JSONGenerator` and `ResourceValidator` keep their TS visitor shells, because tests spy on `visitX`. The per-field checks and coercions they call go to Rust. `Serializer.fromJSON` and `toJSON` get a fast path that calls Rust once for the whole document; the visitor path is still available.
- **White-box tests on views.** Where a W test builds an introspect object on a stubbed collaborator, the view handles it: without a real Rust-backed parent, it falls back to calling the collaborator through a small context interface. **The fallback is kept only where a W test needs it**, and the ledger records each one.
- **Seam ledger (P0-03).** Every method is classified RUST, HYBRID or TS, with a weight. It measures the D1 ≥ 70% target and justifies everything left in TS.
- **Error contract.** Rust returns `{kind, code, params, location}`. **Rust owns the message templates**, ported verbatim from `messages/en.json` and the inline templates. The shim maps `kind` to the TS exception class.
- **Semantics to handle carefully** (PORTING.md):
  - numbers: 53-bit JS numbers, `-0`;
  - regex: the `regress` crate for ECMAScript semantics; `options.regExp` stays in JS;
  - dates: dayjs with `TZ=UTC`;
  - identifiers: the exact `ID_REGEX`;
  - ordering: first-error order must match TS;
  - faithful port: no "improvements".

---

## 4. Work queue

**Legend.** *Pri*: P0 is blocking. *Model*: **O** = Opus, **S** = Sonnet, **H** = Haiku. Each task has a checkable exit condition.

### Phase 0: Harness, oracle and rulebook (gate)
| ID | Task | Deps | Pri | Agent / Model | Exit condition |
|---|---|---|---|---|---|
| P0-01 | Baseline: build; TS suite and nyc; `cargo test` and llvm-cov in both Rust repos → `migration/baseline.json` | – | P0 | runner / H | committed; TS suite green |
| P0-02 | Test tagging B/W/M (§2.1), plus guardrails: a CI step and hook that fail on changes to `test/**`, the nyc thresholds or the `.d.ts`/API snapshot | P0-01 | P0 | harness / S | tags cover all `it()`; a deliberately bad edit is caught |
| P0-03 | Seam ledger (RUST/HYBRID/TS, weights, reasons) | P0-01 | P0 | architect / O | every method classified; human review |
| P0-04a | PORTING.md rulebook: TS-to-Rust mapping, error and message contract, semantics, ledger defaults (#32), module layout (WASM-facing types stay out of core's public API), testing, porting discipline, review checklist, and a worked example (`ModelUtil.getShortName`) | P0-03 | P0 | architect / O | merged; reviewed as actionable |
| P0-04b | Trial port of `ModelUtil`, `NumberValidator` and `ScalarDeclaration` end to end (Rust, WASM, view, oracle); fold the lessons back into PORTING.md | P0-04a, P1-02 | P0 | architect / O | trial units pass their oracle fixtures (native and WASM) and unit test files |
| P0-05 | **Oracle recorder and judge** (§2.2, §2.4, §2.6): instrument the reference; record from the unit suite, the fixtures and conformance; canonicalise; measure the corpus's nyc coverage of the reference; judge self-check against mutants | P0-01 | P0 | harness / O (design) → S | corpus plus a coverage report; the judge rejects every seeded mutant |
| P0-06 | Status reporter and snapshot writer `migration/status.mjs [--at <sha>]`: queue state, B/W pass rates in rust mode, oracle pass % (native and WASM), oracle coverage of the reference, nyc, Rust tests, llvm-cov, mutants, ledger %, conformance. Appends a row to `metrics.jsonl` (§5.1). | P0-01 | P0 | harness / H | `status.json` in under 10 minutes; `--at` reproduces a past row |
| P0-08 | **Telemetry, stuck detection and dashboard** (§5.1): the event log and the `emit` script, test-run records with failure signatures, stuck rules plus a thresholds config, the `migration-telemetry` branch, the dashboard generator | P0-06 | P0 | harness / S, review O | a replayed synthetic run fires every stuck rule once; the dashboard renders from the logs |
| P0-07 | Update the concerto-conformance Rust harness to the current concerto-rust API (blog priority), so the conformance CI goes green on 62/65 | P0-01 | P1 | rust-core / S | conformance job green |

### Phase 1: Rust foundations
| ID | Task | Deps | Pri | Agent / Model | Exit condition |
|---|---|---|---|---|---|
| P1-01 | **Metamodel crate:**<br>• `build.rs` downloads the concerto, decorator and vocab metamodels and `concerto@1.0.0` from `concerto-metamodel` raw at a **pinned tag plus SHA-256** (D4), into `OUT_DIR`, with a vendored offline fallback.<br>• **Rust-native codegen** replaces `npx`; abstract types become `$class`-tagged serde enums; `Debug` is derived (#24).<br>• Align with TS `^3.17`. | P0-04 | P0 | rust-infra / O | offline build works; the corpus ASTs round-trip; #24 test passes |
| P1-02 | Core on top of the metamodel crate: newtypes over `mm::*`; the root and decorator models deserialise into `mm::Model`; hand-built structs deleted; serde for serialisation | P1-01 | P0 | rust-core / S | existing tests green; no hand-built metamodel structs (grep) |
| P1-03 | Traits and derives: a `concerto-macros` proc-macro crate re-exported as `concerto_core::derive` (D5). More than 2 impls, or a fundamental method, becomes a trait; more than 3 impls gets a derive. Traits: `Named`, `FullyQualified`, `Decorated`, `HasValidators`, `Typed`, `Validate`, `DeclarationKind`. Add an error-builder macro. | P1-02 | P0 | rust-core / O | the dup-impl script shows nothing over the thresholds |
| P1-04 | Graph and handle model for bindings: a stable `DeclId`/`PropId` arena in `ModelManager`; a context trait for the collaborator fallback | P1-03 | P0 | architect / O | existing tests green |
| P1-05 | Error contract and message catalogue: golden test per TS message; error locations carried from the AST | P1-02 | P0 | rust-core / S | every TS template has a golden test |
| P1-06 | Relax import order (#26): add all files, validate, roll back on error | P1-04 | P2 | rust-core / S | tests pass |
| P1-07 | Native oracle harness: `cargo test` runs `migration/oracle/**` fixtures | P0-05, P1-05 | P0 | harness / S | runs; failures reported per rule |

### Phase 2: Introspection parity
For each task: first port the TS introspect tests (Concerto v4), then fill the validation gaps until the ported tests *and* the matching oracle fixtures pass. A separate Opus reviewer checks the work against the TS source. Tasks P2-01 to P2-08 run in parallel; all depend on P1-04, P1-05 and P1-07.

| ID | Scope | Model (impl / review) |
|---|---|---|
| P2-01 | ModelUtil, `ID_REGEX`, namespace and semver | S / O |
| P2-02 | Number, String (`regress`, flags, defaults) and CollectionSize validators, `compatibleWith` | S / O |
| P2-03 | ClassDeclaration family: kind compatibility, identity rules, implicit Concept, system fields, getters | S / O |
| P2-04 | Property, Field, Relationship, Enum and EnumValue | S / O |
| P2-05 | ScalarDeclaration | S / O |
| P2-06 | MapDeclaration, MapKeyType, MapValueType (#25) | S / O |
| P2-07 | Decorator, Decorated, DecoratorFactory: validate arguments and type references, duplicates everywhere, log vs throw | S / O |
| P2-08 | ModelFile and Introspector: imports, `concertoVersion`, `filter()`, `dangerouslyAllow…`, getters | S / O |
| P2-09 | Gap audit: every TS `validate()` and validation-style method maps to Rust plus a test, or has a written reason | O |
| P2-10 | **Lift W tests** (§2.3). Batched by test file, starting with `jsonpopulator`, `modelmanager`, `resourcevalidator`, `modelfile`. The reference confirms each fixture. | S (lift) / O (review) |
| P2-11 | Oracle coverage top-up: turn uncovered reference branches into fixtures until coverage ≥ the suite's own | S |
| P2-12 | DCS (decorator command sets) in Rust: apply, validate, migrate, converter, extractor (with a Rust port of YAML plain-scalar quoting) | S / O |

### Phase 3: Instance validation and the modern API (the blog's next phase)
| ID | Task | Deps | Pri | Agent / Model | Exit condition |
|---|---|---|---|---|---|
| P3-01 | Instance validator in `concerto-core::instance`: fold in concerto-validate-rs (D3), fix its bugs, full type support (Long, DateTime, relationships, enums, maps, scalars), matching TS `ResourceValidator`/`JSONPopulator` checks and messages | P2-03, P2-04 | P0 | rust-core / S | instance oracle fixtures pass |
| P3-02 | #1273: `DeserializeOptions` (`reject_unknown_keys`, `reject_required_null`), the `STRICT_VALIDATE_OPTIONS` preset, structured `details` | P3-01 | P1 | architect / O → S | the #1273 scenario table is covered |
| P3-03 | #1239 foundation (Rust-only): `Diagnostic` (JSON pointer, code, severity), `ValidationResult`, collect-all, `validate_instance(_or_throw)` on ClassDeclaration and ModelManager | P3-02 | P2 | rust-core / S | a test per diagnostic code |
| P3-04 | `validate_metamodel`/`validateAst` rebuilt on P3-01 with the strict preset; concerto-validate-rs becomes a thin CLI over concerto-rust (D3) | P3-02 | P1 | rust-core / S | validate-rs tests pass on the new core |

### Phase 4: Bindings and TS views
| ID | Task | Deps | Pri | Agent / Model | Exit condition |
|---|---|---|---|---|---|
| P4-01 | `concerto-wasm` (#28): wasm-bindgen, synchronous instantiation from inlined bytes, handle API, npm `@accordproject/concerto-engine` via a local workspace link. Spike: browser sync-compile limits and boundary cost. | P1-04 | P0 | bindings / O | Node and headless-Chromium smoke pass; spike report |
| P4-02 | `src/engine/` in concerto-core: loader, handle registry, error mapper; `CONCERTO_ENGINE=ts\|rust` flag during migration | P4-01, P1-05 | P0 | shim / S | P0-04 trial units green in rust mode |
| P4-03 … P4-10 | Convert to views, one ledger group each: ModelUtil and ResourceId · validators · Declaration, Decorated and Decorator · ClassDeclaration family · Property, Map and Scalar · ModelFile and BaseModelManager (addModel(s), validate, `validateAst`) · DecoratorManager, DCS converter and extractor · Serializer fast path plus the populator, generator and validator checks | the matching P2/P3 task | P1 | shim / S, review O | the group's B tests and oracle fixtures pass in rust mode; the group's W tests pass, or each has a lifted replacement signed off |
| P4-11 | Build pipeline: `tsc`, ESM, the browser bundle, `smoke-esm`, Playwright e2e with WASM | P4-02 | P1 | bindings / S | build and e2e green |
| P4-12 | NAPI addon (only if WASM is too slow) | P4-01 | P3 | bindings / S | – |

### Phase 5: Hardening and done
| ID | Task | Deps | Pri | Agent / Model | Exit condition |
|---|---|---|---|---|---|
| P5-01 | Full gate against every §0 criterion | all P4 | P0 | runner / H → fixer / S | all green |
| P5-02 | Delete the TS logic Rust now serves; remove the engine flag; nyc thresholds still met | P5-01 | P0 | shim / S | green; ledger ≥ 70% |
| P5-03 | Final adversarial review across the three repos; PR write-ups; follow-up issues for the TS-only remainder | P5-02 | P0 | reviewer / O | findings fixed or ticketed |
| P5-04 | Criterion benchmark of Rust vs TS on the same models (blog): model load and validate, instance validate | P5-01 | P2 | runner / S | report in the PR |
| P5-05 | Differential fuzzing with fast-check (models and instances); every divergence becomes a fixture plus a fix | P4-10 | P1 | harness / S | 1M cases with no divergence |
| P5-06 | `cargo-mutants` on validation; surviving mutants become tests | P2-09 | P1 | rust-core / S | catch rate ≥ 85% |

### Phase 6: Standalone Rust interface (after the TS migration; D11)
| ID | Task | Deps | Pri | Agent / Model | Exit condition |
|---|---|---|---|---|---|
| P6-01 | Rust public API design: audit core's public items, keep WASM and JS-facing types in `concerto-wasm`, idiomatic naming and errors, design note | P5-03 | P2 | architect / O | design note merged; no missing docs on public items |
| P6-02 | Native acceptance example and usage guide; feature-parity table (native vs TS-only) in the final report | P6-01 | P2 | rust-core / S | example runs in CI; guide covers the D11 scope |
| P6-03 | `cargo public-api` snapshot and `cargo semver-checks` in CI | P6-01 | P2 | harness / S | CI green; a deliberate API change fails it |

**Critical path:** P0-01 → P0-03/P0-05/P0-08 → P0-04 → P1-01 → P1-02 → P1-03 → P1-04 → (P2-x ∥ P4-01 → P4-02) → P4-03…10 → P5-01 → P5-02 → P5-03.
**Size:** about 51 tasks. About 14 are Opus (design and review), most are Sonnet, and running and reporting is Haiku.

---

## 5. Orchestration (D8: Workflow script)
- **Agents.** Each has a standing brief in `migration/agents/*.md` and reads PORTING.md, the ledger and the relevant test tags first.
  - architect (O);
  - rust-infra (O) and rust-core (S);
  - bindings (O for the spike, S after);
  - shim (S);
  - harness (O to design the oracle, S after);
  - reviewer (O; runs adversarially from a fresh context; a disagreement goes to a third reviewer; repeated findings become PORTING.md rules);
  - runner (H: suites, triage, the hourly report).
- **Queue.** `migration/queue.yaml` is committed on the concerto branch, so state lives in git and can be resumed. A Workflow script dispatches ready tasks in priority order, **at most 5–6 in parallel**, each in its own git worktree. A task is merged into `claude/tender-pascal-ocwf9q` only when both its exit condition and its review pass. Failures found by the runner are added back to the queue.
- **Guardrails, drawn from other large Claude migrations** (Bun Zig→Rust, vjeux TS→Rust, Anthropic's C compiler and migration guide):
  - rulebook plus a 3-unit trial before bulk work;
  - a trusted judge that is itself checked;
  - no edits to `test/**` (enforced by hook);
  - faithful porting;
  - machine-checkable exit conditions;
  - test output goes to log files with `ERROR`-prefixed summary lines;
  - quick per-file test runs for agents, with full suites only in runner and gate tasks;
  - progress files and frequent pushes;
  - cheaper models implement, stronger models write rules and review;
  - DCO sign-off in concerto-rust;
  - no model identifiers in commits or PRs.
- **Hourly report.** A self-scheduled check-in posts:
  - queue progress and the critical-path position;
  - B/W unit tests passing in rust mode;
  - oracle pass % (native and WASM);
  - oracle coverage of the reference;
  - nyc against thresholds;
  - Rust tests, llvm-cov and mutants;
  - ledger %;
  - conformance;
  - blockers, and stuck events since the last report.

  It also rebuilds the dashboard (§5.1).
- **PRs.** One draft PR per repo, subscribed for CI and review events.

### 5.1 Instrumentation: debugging the run and reporting on it (P0-08)
Everything is recorded in two append-only logs committed to git. Stuck detection, charts and the final report are all queries over them.

**Event log: `migration/telemetry/events.jsonl`**
- One line per task lifecycle event: `queued`, `started`, `heartbeat`, `test_run`, `commit`, `review_verdict`, `merged`, `failed`, `retried`, `stuck`, `escalated`, `blocked`.
- Fields: timestamp, task ID, attempt, agent role, model, branch/worktree, commit SHA, duration, tokens, reason.
- **The dispatcher writes these around every agent call**, so timestamps are reliable even though agents have no sense of elapsed time. Token, tool-call and duration figures come from each agent's completion result.
- Agents add `heartbeat` and `test_run` events at checkpoints through `migration/bin/emit`. The first error line goes in the event; full output goes to a log file.
- Every event links to the agent transcript and the workflow run ID.

**Metric snapshots: `migration/telemetry/metrics.jsonl`**
- One row per merge into the integration branch, plus one per hour, keyed by commit SHA.
- Each row holds every §0 number, plus per-file coverage summaries so you can see which files moved.
- `status.mjs --at <sha>` recomputes any past row, so curves can be backfilled if a metric definition changes.

**Test run records: `migration/telemetry/runs/<task>/<attempt>/`**
- mocha JSON and cargo-nextest JUnit output.
- A failure *signature* (hash of the test name plus the first error line) makes repeats and regressions detectable by machine.

**Stuck rules.** The dispatcher evaluates these every cycle and logs a `stuck` event with its cause. The thresholds live in `migration/telemetry/thresholds.yaml` and get tuned after day one.

| Signal | Rule (starting threshold) | Automatic response |
|---|---|---|
| Silent | No heartbeat for 20 minutes | Restart from the last commit |
| Looping | The same failure signature on 3 consecutive attempts | Switch Sonnet to Opus, or split the task |
| Plateau | The task's metric hasn't improved in 3 attempts | Opus reviewer diagnoses |
| Burning | Over 1M tokens used without a commit | Stop it and ask the human |
| Regression | A test that passed at the previous merge fails now | Fix task against the merge that caused it |
| Deadlock | Nothing ready, nothing running, queue not finished | Report the dependency chain; ask the human |
| Global stall | No §0 metric has moved in 2 hours of merges | Flag it in the hourly report |
| Review churn | The same task is rejected twice | Treat PORTING.md as the likely gap and update it |
| External | Network, permission or tool failure | Mark blocked and notify immediately |

**Dashboard.** A private page rebuilt hourly from the logs:
- metric curves over time with merge markers;
- a task timeline with stuck periods shaded by cause;
- a task burn-up chart;
- cost by model and by phase;
- the top 10 failure signatures.

**Final report.** Generated from the logs, published as a page and linked from this issue:
- the actual critical path against the planned one;
- time lost to stuck periods, by cause;
- how the stuck rules and model escalations performed;
- the coverage curves;
- rework: review rejections and regressions per phase;
- cost per task, phase and model;
- lessons learned.

**Durability.** Telemetry lives on a separate `migration-telemetry` branch of the concerto repo, so it stays out of the PRs. It is pushed after every snapshot, because containers are ephemeral.

### 5.2 Merge policy
Worker PRs whose base is `claude/tender-pascal-ocwf9q`, in any repo, are merged without human review once they pass adversarial review and CI is green. The coordinator re-runs the repo's fast checks on the merged tree first. Stacked PRs are merged with a signed-off `git merge --no-ff` and push. The integration PRs into `main` still need human review.

## 6. Decisions
| # | Decision | Status |
|---|---|---|
| D1 | ≥ 70% of logic by weight in Rust | **Accepted** |
| D2 | WASM (wasm-bindgen) first; NAPI only if needed | **Accepted** |
| D3 | Fold concerto-validate-rs into concerto-rust; keep it as a thin CLI | **Accepted** |
| D4 | Metamodel pinned to a tag plus SHA-256 | **Accepted** |
| D5 | `concerto-macros` proc-macro crate, re-exported as `concerto_core::derive` | **Accepted** |
| D6 | Where TS v5.0.0 differs from Concerto v4, match TS (the oracle) and record the divergence | **Accepted** |
| D7 | Scope of DCS, Factory and Serializer: ledger decides; Factory and the instance objects stay TS | **Accepted** |
| D8 | Workflow-script orchestration | **Accepted** |
| D9 | Publishing (#27, npm) out of scope; local linking during development | **Accepted** |
| D10 | The oracle is the published `@accordproject/concerto-core@5.0.0` (frozen), and white-box tests may be satisfied by signed-off lifted fixtures if they cannot pass on views | **Accepted** |
| D11 | Standalone Rust interface, after the TS migration. In scope: JSON AST loading, introspection, semantic validation, instance validation with diagnostics. Out (named follow-ups): CTO parsing, typed instances and JSON generation, sample generation | **Accepted** |

## 7. Risks
- **Views vs W tests.** Some W tests may not pass on handle-backed views. Mitigation: a context fallback where cheap; otherwise a lifted fixture signed off under D10.
- **The nyc 99% gate on thin views.** Keep the views branch-free; put error mapping behind a table.
- **Number, regex, date and error-order semantics.** Mitigation: golden tests, the oracle and fuzzing.
- **WASM boundary cost and browser sync-compile limits.** Mitigation: the P4-01 spike, document-level fast paths, NAPI as a fallback.
- **Metamodel version drift** (3.13 against ^3.17). P1-01 aligns them.
- **Cost:** multi-day, about 50 tasks each with a review. The hourly report tracks spend; parallelism can be reduced.

## 8. Sources
- GSoC 2026 blog post, "A Concerto runtime in Rust" (content supplied by the user).
- Issues concerto#1273 and #1239; concerto-rust #24–#28.
- [Anthropic – large-scale migrations](https://claude.com/blog/ai-code-migration)
- [Anthropic – C compiler with parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)
- [vjeux – 100k lines TS→Rust](https://blog.vjeux.com/2026/analysis/porting-100k-lines-from-typescript-to-rust-using-claude-code-in-a-month.html)
- [Bun – Rewriting Bun in Rust](https://bun.com/blog/bun-in-rust)
