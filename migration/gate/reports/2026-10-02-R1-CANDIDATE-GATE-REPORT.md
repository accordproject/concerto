## P5-82 gate report: R1 candidate (2026-10-02)

**Heads:** concerto `4578718b2`, concerto-rust `bfa4a55` (integration `claude/tender-pascal-ocwf9q`). Node v22.23.2. Canonical corpus `oracle-corpus-p107-06aa375` plus supplement `d842c0ab7` (16,242 fixtures), CTO cache rebuilt with the integration `build-cto-cache.js`. Runner: `migration/gate/run.mjs`, every step enabled. Report committed locally as `migration/gate/reports/2026-10-02T07-03-16-871Z/` (commit `79deef047` on `claude/tender-pascal-ocwf9q-local-matt-P5-82`, not pushed). No source changes. No fuzz, no timed runs.

### PASS/FAIL per criterion

| Criterion | Result | Detail |
|---|---|---|
| §0.1 B unit tests, rust engine | **PASS** | 926/932 passing, 0 failing, 6 pending |
| §0.2 W tests | **PASS** | 269/269 |
| §0.3a reference coverage by the corpus | **PASS on the floor; runner reports FAIL (tooling)** | Corpus over the frozen v5.0.0 reference: stmt 99.21%, branch 96.34%, fn 99.01%, line 99.19%. These are the same figures as on 26 Sep and above the floor. The runner fails the step because `coverage.sh --with-suite` runs today's `test/` against the v5.0.0 `src/`, and 28 tests fail there. All 28 are approved R1 test changes: 27 strict DateTime cases (P5-24, BC-07) and the `u`-flag RegExp case (P5-52, BC-28). `coverage.sh` still assumes "test/ is unchanged since v5.0.0", which R1 has made untrue. This needs a runner fix, not an engine fix. |
| §0.3b oracle, native, 0 regressions | **PASS** | 13,861 pass, 271 intended failures (all in `baseline.tsv`), 2,110 unsupported, 0 harness errors, 0 unowned, 0 regressions. `cargo test --workspace` with `CONCERTO_ORACLE_FIXTURES` set: 0 failed. |
| §0.3c oracle, WASM/JS binding, "100% vs v5.0.0" | **FAIL by design; every failure maps to a BC row** | 15,971/16,242 (98.33%). 269 of the 271 failures are the native baseline's intended R1 failures. The other 2 are `gaps/Factory.newResource/8556634c…` and `f7aca8c9…` (an enum type with `generate`: `TypeError` becomes `Error`, BC-08's InstanceGenerator path). The native harness marks these unsupported. In the other direction, the native-only BC-45 failures (`unit/Factory.newResource/af5730ac…`, `1cf6a6d9…`) pass through JS, because the TS `Factory` keeps 5.x defaults. The BC-45 row and the migration guide document this. The 100% bar was set before R1 made intended changes; against the baseline, the WASM leg has 0 unexplained failures. |
| §0.4 ≥70% of logic in Rust (D1) | **FAIL, maintainer-accepted** | 39.7% ledger-weighted. Recorded as accepted; not re-litigated. |
| §0.5 public API / guardrails | **PASS against the committed snapshot; one undocumented change vs main** | `check-guardrails.mjs` OK; `check-core-exports.mjs` 3/3 (43/43 root exports, deep imports rejected); `test:esm` 10/10. See the API snapshot section below. |
| §0.6a llvm-cov ≥90% lines | **PASS**: 94.56% lines in concerto-core (26,635 lines, 1,450 missed). Workspace: 94.31% lines, 92.38% functions, 93.69% regions | status.mjs timed out on `cargo llvm-cov` (6-min budget), so the runner shows "not judged"; I ran it separately |
| §0.6b cargo-mutants ≥85% | **PASS** | 358/420 (94.5%), MUTANTS.md (P5-06) |
| §0.7 conformance | **PASS (JS); Rust harness 149/151, both failures fixed by #43** | JS (concerto-conformance `57d3c23` against npm `@accordproject/concerto-core@5.0.0`): 109/109 semantic plus 42/42 instance scenarios. The Rust-native harness with draft #42 (`c578a7e`) patched to this concerto-rust ran 158 scenarios: 151 run, 149 passed, 2 failed, 7 upstream `@skip`. The 2 failures are `concepts.feature:120` (circular inheritance, BC-11) and `maps.feature:26` (undeclared map value type, BC-12). Both expect the v5 JS crash messages (`Maximum call stack size exceeded`, `Cannot read properties of null`). Draft #43 (P5-63) rewrites exactly these two expectations, so with #42 and #43 merged the harness should reach 151/151. |

**Other full-tier checks (all exit 0):** `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings`, `cargo test --workspace` (oracle on). Wasm leg: `cargo fmt --check`, wasm32 clippy `-D warnings`, `cargo check`, `build.sh` (engine 2,931,108 bytes, budget 4,194,304), `smoke:node`. `run-core-tests.sh` with nyc, Node 22: rust and ts both 2,226 passing, 8 pending, 0 failing (stmt 99.4%, branch 95.45%, fn 99.81%, line 99.44%).

### API snapshot vs main

`main` has not changed concerto-core `src/`/`types/` since the merge base, so I compared the P0-02 snapshot (`9769f2852`) with HEAD. Each change maps to a BC row:
- `DecoratorExtractor` module, 11 `DecoratorManager` helpers, and `MapKeyType`/`MapValueType.processType` removed: BC-37.
- `BaseModelManager.modelFiles` removed, and `ModelFile` throws `TypeError` for a non-`BaseModelManager`: BC-46/BC-47/BC-48 (P5-34).
- `serializer/relationshipmapvalue.d.ts` and `convertRelationship(RelationshipDeclaration | RelationshipMapValue, …)` added: BC-05 (P5-58).
- JSDoc only: `regExp` deprecated (BC-28), `metamodelValidation` (BC-19), `setCurrentTime` (BC-51), `Validator.reportError` throws `ValidationException` (BC-39).
- Narrowed `any` types (`getShortName`, `getFullyQualifiedName`, `capitalizeFirstLetter` and similar `any` to `string`; `$class: any` to `string`; `parseNamespace` return shape; `JSONGenerator.visitClassDeclaration`): these came with P5-02 (`70bdeb49e`, the BC-37 regeneration).

**Finding:** the same P5-02 regeneration changed **14 public method return types to `never`** in the published `dist/*.d.ts`. The cause is `const rust: { [binding: string]: (...args: any[]) => never }` in `src/modelutil.ts` and siblings. The affected methods:
- `Identifiable.toURI()` and `ResourceId.toURI()` (were `string`);
- `DecoratorManager.extractDecorators`, `extractVocabularies`, `extractNonVocabDecorators` and `falsyOrEqual`;
- `ModelUtil.isEnum`, `isMap`, `isScalar`, `isAssignableTo`, `isValidMapKey`, `isValidMapKeyScalar`, `isValidMapValue` and `importFullyQualifiedNames` (were `boolean`/`string[]`/`any`).

This breaks TypeScript consumers at compile time. `r.toURI().split('#')` compiles against 5.0.0 but fails against this build with `TS2339: Property 'split' does not exist on type 'never'` (checked with `tsc --strict` against `dist/`). BC-37 says these entry points are "unchanged", and the CHANGELOG says "same type declarations, apart from the removals listed", so neither covers this change. See DECISION NEEDED below.

### Docs cross-check (docs/r1/CHANGELOG.md, MIGRATION-GUIDE.md vs the R1 list and merged tasks)

- Every R1 BC id in BREAKING-CHANGES-PLAN is referenced in docs/r1. I found no R1 change missing a doc entry.
- Spot checks where the docs agree with the code: `engines.node`, the exports map (P5-71), the warning codes, `isValidIdentifier` (BC-01), and BC-45's "JS `Factory.newResource` still assigns the default" (the oracle WASM leg shows exactly this).
- Doc claims the code contradicts, or stale content:
  1. CHANGELOG lines 15-20 ("same type declarations") and BC-37 ("entry points … unchanged") are contradicted by the 14 `never` return types above.
  2. CHANGELOG line 61 gives the engine as 2,833,833 bytes (P5-61), and the guide (line 63) and CHANGELOG (line 79) say about 2.8 MB. P5-76 records 3,048,959 bytes (RESULTS.md line 15); this run built 2,931,108.
  3. CHANGELOG lines 64-65 still carry the P5-60 re-measure placeholder, although P5-60's numbers are in RESULTS.md and already quoted in the table at lines 48-50.
  4. Both docs say "written at concerto `09295b075` / concerto-rust `fa4ee0b`", which is before P5-68, 69, 71, 73, 75, 76, 77 and 79.
  5. BC-19 wording (CHANGELOG line 197 "every AST is checked"; guide line 265 "R1 checks every AST") predates P5-68 and P5-73, which skip the shape check for engine-written and system-model ASTs. Behaviour is unchanged for user ASTs, but the claim is broader than the code.
  6. BC-08 is documented for `fromJSON`/`toJSON` only. The same `TypeError` to `Error` change also reaches `Factory.newResource` with `generate` (InstanceGenerator, oracle `gaps/Factory.newResource/8556634c…`).
  7. The "Not in R1" lists (CHANGELOG lines 204-223, guide lines 453-457) name the P5-39 decisions but not P5-78 (#420, Concertino as the web story). P5-78's held decisions would reword BC-32 ("ships as described above until P5-39 is decided"), add BC-52 (`ModelManager.toConcertino()`) and possibly BC-53 (`isValid` leaving the Concertino class). Neither row is in BREAKING-CHANGES-PLAN yet, which is correct while they are undecided, but the docs should say that the browser story also waits on #420.
- Plan vs held decisions: BREAKING-CHANGES-PLAN line 59 says "Still to decide for the single major: BC-04 (Q6), BC-21 (Q9), the BC-24 factory-timing part, BC-27, BC-33, the BC-35 removal form, and BC-44 and BC-49". I checked each against the plan rows, Q6/Q8/Q9 (lines 572-575), the docs and the tracker. None is settled: no task shipped any of them, Q6, Q8 and Q9 have no recorded answer, and the only tracker issue (#362, BC-44) is open as `mig:post-migration`. So line 59 is not stale, and it agrees with the docs' "Not in R1" list. One small gap: line 59 leaves out BC-09 (Q8), which the docs list as not in R1 and which P5-63 left out of R1 (plan lines 509-512). All of these are in the open-items table below.
- The integration branch has moved since the gate run, to concerto `047e5cf35` (P5-83, `migration/log/` tooling only). The plan and docs/r1 are unchanged there, and concerto-rust is still at `bfa4a55`.

### R1 open items

| Item | State | Suggested owner |
|---|---|---|
| P5-39 (#349) web bundle size / async init | open, `mig:needs-decision` | maintainer (decision), then worker |
| P5-78 (#420) Concertino as the web story: six held DECISION NEEDED items (adopt Concertino as the R1 web story, and in what form; how each playground gets CTO into the browser and which model validation option; runtime/validator API shape and package boundary; format stability and versioning; which R1 tasks change; the official way to produce Concertino) | open, `mig:needs-decision`; report reviewed (PASS), concerto#1472 stays a draft and unmerged | maintainer (decision), then coordinator files the follow-up tasks |
| What P5-78 holds: BC-52 (`ModelManager.toConcertino()`, additive) and BC-53 (`isValid` leaving the Concertino class) rows, BC-32 wording, the reshaping of P5-44, P5-45 and P5-47 (#365, #366, #368; P5-46 #367 unchanged under its recommendation), the playground guidance and R1 browser docs | blocked on #420 (and P5-44 to P5-47 also on #349) | coordinator, after the decisions |
| BC-04 (Q6: record fixtures to show the direction; minor if the fix only accepts more) | held, not in R1 | maintainer (decision), then worker records fixtures |
| BC-09 (Q8: is a map value's `$identifier` public output?) | held, not in R1; missing from plan line 59 | maintainer (decision) |
| BC-21 (Q9: port TS's acceptance of `[7]` as a patch, or extend DV-018's rejection) | held, not in R1 | maintainer (decision) |
| BC-24 factory-timing part (decorator factories run on first read) | held; R1 keeps factories eager (#270 option (b)) | maintainer (decision: this major or never) |
| BC-27 read-only `Resource.validate()` (needed before the #227 fast path is revived) | held, not in R1 | maintainer (decision) |
| BC-33 `getModelFileByFileName` typed `ModelFile \| undefined` | held, not in R1; type-only, and it touches the same API snapshot as the `never` finding below | maintainer (decision), then worker |
| BC-35 removal form (deprecate `Globalize`; the generation form is a patch) | held, not in R1; also listed on #266 | maintainer (decision) |
| BC-44 `utcOffset` units (#362) and BC-49 per-declaration `validate()` | held; planned as R2 deprecation then R3 removal, so with one major they are removed in R1 or not at all | maintainer (decision) |
| concerto-conformance #42 (P5-62 Rust harness) and #43 (P5-63 BC-11/12 expectations) | open drafts; need to land together (#42 alone gives 149/151) | coordinator (merge together) |
| concerto-conformance #41 (P5-53 BC-39/40) | open draft | coordinator |
| DCO: #260 (unsigned merge commits, DCO app limit on >250-commit PRs) | open | maintainer |
| dco.yml remediation: concerto-rust#353 | open (concerto#1428 merged) | coordinator / maintainer |
| #252 move lifted fallback specs out of `migration/` before it is removed | open | worker |
| WeakMap stall (RESULTS.md, P5-73 section: `engine/views.ts` stages) | recorded, not fixed | worker (performance task) |
| `never` return types in published `.d.ts` (this report) | new | worker (follow-up task, if approved) |
| `coverage.sh --with-suite` assumes `test/` equals v5.0.0, and §0.3c's 100% bar predates R1 | new, tooling | worker (gate runner task) |
| `status.mjs` `cargo llvm-cov` 6-min budget too short for the instrumented oracle; `status.mjs` ignores `--validate-rs-root` (looked for `wt/P5-82/concerto-validate-rs`) | new, tooling | worker |
| docs/r1 stale items 2-7 above, and BC-09 added to plan line 59 | new | worker (docs task) |

### DECISION NEEDED

DECISION NEEDED: 14 public methods now return `never` in the published `.d.ts`. These are `Identifiable/ResourceId.toURI`, `ModelUtil.isEnum/isMap/isScalar/isAssignableTo/isValidMapKey/isValidMapKeyScalar/isValidMapValue/importFullyQualifiedNames` and `DecoratorManager.extractDecorators/extractVocabularies/extractNonVocabDecorators/falsyOrEqual`. This is a TypeScript compile-time break, and neither BC-37 nor the CHANGELOG describes it. Options:
1. Treat it as a bug and restore the 5.0.0 return types before R1. This is a type-only, additive fix: type the engine binding map as returning `any`/`unknown` and annotate these methods. Then regenerate the API snapshot.
2. Accept it as part of BC-37 "as shipped" and document it in the CHANGELOG and migration guide.

Recommendation: option 1. What stays blocked: §0.5 "every API change mapped to a BC row" and the R1 docs sign-off. Nothing else in this gate depends on it.

The held decisions in the open-items table (P5-39, P5-78, and the plan's BC-04, BC-09, BC-21, BC-24, BC-27, BC-33, BC-35, BC-44 and BC-49) are already raised on #349, #420 and in BREAKING-CHANGES-PLAN Q6-Q9, so they are not repeated here. None of them makes a gate criterion fail; they decide what R1 contains, and R1 cannot be called final until each is answered or explicitly deferred.

D1 (§0.4, 39.7%) is recorded as maintainer-accepted. §0.3a and §0.3c fail only because of runner assumptions that R1's intended changes invalidate, so they need no maintainer call.
