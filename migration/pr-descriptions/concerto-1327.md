<!-- Final PR description for accordproject/concerto#1327, written by P5-03 (accordproject/concerto-rust#74). -->
# Tracks accordproject/concerto-rust#29
This is the integration PR for the concerto side of the migration that makes `@accordproject/concerto-core` run on a Rust engine. The plan is accordproject/concerto-rust#29. Each task was reviewed on its own draft PR against `claude/tender-pascal-ocwf9q` and merged into it; this PR takes the finished branch into `main`. The Rust engine itself is in accordproject/concerto-rust#78.

**In short:** the introspection, model validation, decorator and serializer logic in `packages/concerto-core/src` is now a set of thin TypeScript views. They hold a handle into the Rust engine (concerto-rust `concerto-core`, exposed to JS through `concerto-wasm` as `@accordproject/concerto-engine`) and delegate to it. The public API, the exported names, the deep `src/...` paths and the `.d.ts` snapshot are unchanged, apart from the maintainer-accepted removals in BC-37 (below). The frozen concerto-core unit suite passes on the engine, and a recorded oracle of 16,242 behaviours of `@accordproject/concerto-core@5.0.0` shows 0 failures natively and 100% agreement through the JS binding.

### Changes

**Runtime (`packages/concerto-core/src`, 49 files, about +3.5k / -2.3k lines)**
- **`src/engine/` (new): the engine shim.**
  - `rust.ts` / `index.ts` load `@accordproject/concerto-engine` synchronously.
  - `handles.ts` is the handle registry.
  - `views.ts` materialises the JSON snapshots that engine calls return into view fields (PORTING.md 1.5), so getters read cached values without crossing the boundary on each call.
  - `errors.ts` maps the engine's `{kind, code, params, location}` errors to the TS exception classes: `IllegalModelException`, `ValidationException`, `TypeNotFoundException`, `MetamodelException` and the rest.
  - `serializer.ts` / `serializer-codec.ts` are the one-call `Serializer.fromJSON` / `toJSON` fast path and its wire codec.
- **Introspect views.** `ModelUtil`, `ResourceId`, the number, string and collection-size validators, `Declaration` / `Decorated` / `Decorator`, the `ClassDeclaration` family (asset, concept, event, participant, transaction, enum, scalar and map declarations), `Property` / `Field` / `RelationshipDeclaration` / `MapKeyType` / `MapValueType`, and `ModelFile` all delegate their getters, `validate()` and type resolution to the engine.
- **`BaseModelManager`.** Model files are mirrored into an engine `ModelManagerHandle` (`rustHandle`). `addModel(s)`, `updateModelFile`, `deleteModelFile`, `validateModelFiles`, `resolveType`, `derivesFrom`, `isAssignableTo`, `getNamespaces`, `getModelFileByFileName` and `validateAst` are answered by it.
- **`DecoratorManager`.** `validate`, `migrateTo`, `decorateModels` and the `extract*` methods run in the engine. `decoratorextractor.ts` is deleted (BC-37).
- **Serializer.** `JSONPopulator`, `JSONGenerator` and `ResourceValidator` keep their TS visitor shells, because tests spy on the `visitX` methods. Their per-field checks and coercions call the engine. `Serializer.fromJSON` / `toJSON` take the fast path and fall back to the visitors only on `EngineFastPathUnsupported`.
- **Kept in TS on purpose** (the seam ledger gives the reason for each): `Resource` / `Typed` instance objects and `Factory` (uuid and dayjs, decision D7); visitor dispatch; the caller-supplied `options.regExp` in `StringValidator`; CTO parsing (concerto-cto, out of scope); `Globalize` and the message plumbing TS still owns.
- **Removed:** the migration-time `CONCERTO_ENGINE=ts|rust` flag and the TS bodies it guarded (P5-02). The engine is the only path.

**Packaging and build**
- `packages/concerto-engine/` (new workspace package): re-exports the CommonJS/ESM loader that concerto-rust's `concerto-wasm/build.sh` writes, from a concerto-rust checkout next to this one. Per D9 it is linked locally and not published.
- `scripts/build-esm.js` and `scripts/browser-module-shim.js`: the ESM and browser bundles inline the WASM engine.
- `packages/concerto-core/tsconfig.build.internal.json`: a second `tsc` pass for the internal engine types.
- `packages/concerto-core` `test` script: it now also runs `migration/oracle/lifted/fallbacks.spec.js` (146 lifted checks for the fallbacks that remain). The root `pretest` installs the frozen v5.0.0 reference those checks compare against.

**Guardrails and CI**
- `.github/workflows/migration-guardrails.yml` and `migration/bin/check-guardrails.mjs` fail on:
  - any change to `packages/concerto-core/test/**`;
  - any change to the nyc thresholds;
  - drift from the API snapshot (`migration/api-snapshot/full-api.d.ts`).
- `migration/guardrails/test-message-relaxations.tsv` is the allow-list for the one permitted kind of test edit: relaxing an exact-message assertion to a class check, under the P5-09 error-parity policy. It has **no rows**, so no test was edited.
- `migration/bin/guard-tests-hook.sh`: the same check as a local hook.

**Migration scaffolding (`migration/`, to be removed or slimmed before this merges; see Flags)**
- `PLAN.md`, `queue.yaml`, `COORDINATOR.md`, `worker/`: the plan, the task queue and the orchestration scripts.
- `baseline.json`, `tags/`: the pre-migration baseline and the B/W/M tagging of every `it()`.
- `ledger/`: the seam ledger, which classifies every `src/**` member as RUST, HYBRID or TS with a weight and a reason. This drives the §0.4 figure.
- `oracle/`: the recorder and judge for the behavioural oracle, the WASM replay (`replay.js`), lifted white-box fixtures (`lifted/`), coverage-gap reports and results. The corpus is **not** committed. It is the draft release `oracle-corpus-p107-06aa375` plus the supplement `oracle-corpus-supplement-d842c0ab7` in accordproject/concerto-rust.
- `gate/`: the §0 gate runner and its reports. `fuzz/`: differential fuzzing (P5-05). `bench/`: the TS-vs-Rust benchmarks (P5-04, P5-06x).
- `status/`, `telemetry/`, `dashboard/`: status snapshots and run telemetry.
- `BREAKING-CHANGES-PLAN.md`: the catalogue of intentional breaks and the release plan (R1, R2, R3, RB). `CONFORMANCE-PROMOTION-PLAN.md`, `gap-audit.md`.
- `api-snapshot/`: the generated `.d.ts` snapshot the guardrail compares against.

### Evidence (P5-03 final review, concerto `e95bd87b4` with concerto-rust `e50f0e3`)
- **concerto-core suite on the engine** (nyc and mocha, `test/**` unchanged): 1,591 passing, 8 pending (the same as upstream), 1 failing. The failure is `ModelLoader #loadModelFromUrl`, an HTTP 403 in the sandbox; it needs network access. nyc: statements 99.35%, branches 96.29%, functions 99.81%, lines 99.34%, against the unchanged 99 / 94.8 / 99 / 99 gate.
- **Oracle:** canonical corpus plus supplement, 16,242 fixtures. Natively: 13,921 pass, 0 fail, 2,321 unsupported (mostly ops that stay in TS), 0 unowned, 0 regressions against `baseline.tsv`. The WASM/JS binding leg agrees on 16,242/16,242 (P5-01 gate).
- **Oracle coverage of the v5.0.0 reference:** statements 99.21%, branches 96.34% (P5-01 gate; the floor is the suite's own 99% / 94.8%).
- **Seam ledger (§0.4): FAIL.** RUST+HYBRID is 39.4% of logic by weight against a target of 70% or more. The 78.9% reported at P5-03 counted rows that make no engine call. accordproject/concerto-rust#261 reclassified them as PARTIAL, and P5-11 (accordproject/concerto-rust#276) evaluated each one. By maintainer decision (2026-09-28), no more code moves to Rust for now: 14 port candidates stay PARTIAL, deferred, and the rest are TS. D1 stays as defined, with the 70% bar, and the maintainer accepts §0.4 as FAIL for now.
- **Guardrails:** `test/**` is unchanged against `main`, the nyc thresholds are unchanged, the relaxations TSV is empty, and the API snapshot matches BC-37.

### Flags
- **CI is red on this PR: accordproject/concerto-rust#259 (blocker).** Unit Tests ×6, conformance and check-guardrails fail because CI never builds or provisions the engine. concerto-core does not declare `@accordproject/concerto-engine` as a dependency, and `packages/concerto-engine` expects a concerto-rust checkout next to this repo. This must be fixed before merge. The packaging decision is BC-31 / BC-32.
- **DCO: accordproject/concerto-rust#260 (blocker, maintainer decision).** Merge commit `00d47e802` has no `Signed-off-by`. With more than 250 commits, the DCO app cannot evaluate this PR.
- **This is a major release (R1 in `migration/BREAKING-CHANGES-PLAN.md`).**
  - BC-31 raises the Node floor, or makes the ESM entry load the engine asynchronously.
  - BC-32 adds a browser `init()` entry.
  - BC-37 is the maintainer-accepted removal of `DecoratorExtractor`, the internal `DecoratorManager` statics and `MapKeyType` / `MapValueType.processType`.
  - The R1 changelog also covers the accepted divergences BC-03 (DV-004), BC-07(a) (DV-009), BC-13 (DV-015), BC-15 (DV-017) and BC-16 (DV-018).
- **Error parity is class, not message (maintainer decision, 2026-09-27; P5-09).** Rust and TS throw in the same scenarios with the same exception class; the message text may differ. No test needed relaxing.
- **Performance:** through the public API the engine is slower than the TS reference. After P5-06d, model load is about 15× and load plus validate about 8× on the concerto-core test data (`migration/bench/RESULTS.md`). The maintainer accepted current performance for this release.
- **Open review findings from P5-03, escalated to a third review** (verdicts are posted on each issue and await coordinator confirmation):
  - accordproject/concerto-rust#261: 140 members the ledger marks RUST make no engine call, and 34 of them still run real TS logic (for example `ModelFile.fromAst`, `BaseModelManager.getType`). Upheld and resolved: #261 reclassified them as PARTIAL (D1 61.5%), and P5-11 (accordproject/concerto-rust#276) evaluated them together with the HYBRID rows that make no engine call. The result is D1 = 39.4%, and §0.4 is FAIL by maintainer decision (see Evidence).
  - accordproject/concerto-rust#262: catch-all `try { rustHandle.x() } catch { run the TS body }` fallbacks in `basemodelmanager.ts` and `modelfile.ts`. They discard the engine's domain errors, so on those paths users see the TS exception. Upheld.
  - accordproject/concerto-rust#263: the key order of `ModelFile.getExternalImports()` differs from v5.0.0. Upheld.
- **Other follow-ups:** accordproject/concerto-rust#264 (DIVERGENCES categories), accordproject/concerto-rust#265 (211 Rust-owned fixtures never compared natively) and accordproject/concerto-rust#266 (umbrella for the TS-only remainder: the CTO parse seam, Factory and instances, value generation, YAML, Globalize).
- **`migration/` is scaffolding.** It adds about 270k lines, mostly fuzz results, test-tag traces, bench fixtures and gate reports. Slim it or remove it before this merges. First move `migration/oracle/lifted/fallbacks.spec.js`, which the concerto-core `test` script runs, somewhere permanent (a post-migration follow-up is filed).
- **concerto-validate-rs** has no PR. The maintainer decided to leave it untouched and archive it after the migration. Its checks and tests are folded into concerto-rust (D3, P3-04).

### Screenshots or Video
N/A

### Related Issues
- Issue accordproject/concerto-rust#29 (plan), task issues accordproject/concerto-rust#30 to accordproject/concerto-rust#266, final review accordproject/concerto-rust#74
- Pull Request accordproject/concerto-rust#78 (the Rust engine, concerto-wasm and the oracle harness)

### Author Checklist
- [ ] Ensure you provide a [DCO sign-off](https://github.com/probot/dco#how-it-works) for your commits using the `--signoff` option of git commit. (Not yet: see accordproject/concerto-rust#260.)
- [x] Vital features and changes captured in unit and/or integration tests (the unchanged concerto-core suite, 146 lifted checks and the 16,242-fixture oracle)
- [x] Commits messages follow [AP format](https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md#commit-message-format)
- [ ] Extend the documentation, if necessary (the R1 changelog and the BC-31 / BC-32 packaging docs are still to write)
- [ ] Merging to `main` from `fork:branchname`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
