# P5-78 spike: Concertino as the web story (analysis only, not shipped)

Task accordproject/concerto-rust#420. The report is a comment on that issue.
Nothing here is a shipped package and nothing here is merged; it lives on the
task branch for reference.

## Prototypes (`src/`, TypeScript)

| file | what |
|---|---|
| `names.ts` | `getShortName` / `getNamespace` inlined (replaces the converter's `ModelUtil` import) |
| `resolver.ts` | concerto-cto AST(s) -> the resolved AST `ModelManager.getAst(true)` gives, plus the parse-level and resolution checks (option (c)) |
| `concertino/` | the Concertino converter after the item-3 cleanup: no concerto-core, no ajv in the main entry, 5.0.0 types only; `schema.ts` is the `./schema` subpath over a precompiled ajv validator (`schema-validator.mjs`, generated) |
| `query.ts` | runtime query layer over a Concertino document (tree-shakeable functions) |
| `validator.ts` | plain-JSON `validate` / `normalise` / `check` with R1 semantics (follows concerto-rust `instance/from_json.rs` and `instance/validate.rs`) |
| `node-all.ts` | everything, for the Node runners |

## Tools (`bin/`) and outputs (`results/`)

Build first: `node bin/build-schema-validator.mjs && node bin/build-node.mjs`
(from this directory, after `npm ci` and the package builds at the repository root).

| command | item | output |
|---|---|---|
| `node bin/conformance.mjs` | 6 (and 2c) | `results/conformance.json` |
| `node bin/oracle-instances.mjs` | 6 (extended: every `Serializer.fromJSON` oracle fixture, against R1) | `results/oracle-instances.json` |
| `node bin/roundtrip.mjs` | 2 (resolver vs `getAst(true)`), 7 (round trip) | `results/roundtrip.json` |
| `node bin/sizes.mjs` | 3, 9 | `results/sizes.json`, `results/sizes.md` |
| `node bin/cto-trim.mjs` | 2 (what concerto-cto could trim; estimate) | `results/cto-trim.json` |
| `node bin/speed.mjs` | 10 | `results/speed.json` |
| hand-made | 2a (model-check catalogue) | `results/model-checks.json` |
| `migration/bench/p560-bundle.mjs <dir outside the repo>` | 9 (engine and v5 rows) | `results/p560-engine.md` |

The R1 reference is this checkout's `packages/concerto-core/dist` over the
WASM engine built by concerto-rust `concerto-wasm/build.sh` at the same
integration head. The oracle runner reads the canonical corpus (with the
supplement) from `CONCERTO_ORACLE_FIXTURES` or `/home/user/concerto/migration/oracle/fixtures`.
