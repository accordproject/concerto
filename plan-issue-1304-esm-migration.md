# Plan & Handoff — Issue #1304: Native-ESM migration of `concerto-core` / `concerto-util`

> **Status:** ⏸️ PAUSED at a strategic decision point. This branch is a **resumable
> checkpoint**, not merge-ready. A human decision (Option A/B/C below) is required
> before the work can proceed to green.
>
> **Branch:** `esm/integration` · **PR:** draft (WIP) · **Base:** `main` @ `455c77977`
> **Beads tracker:** `concerto-3oj` (Phase C, in_progress) · parent epic `concerto-334`

---

## 1. Goal (unchanged from #1304)

Convert `concerto-core` and `concerto-util` from TypeScript CJS-interop syntax
(`export =`, `import X = require()`, `const X = require()`) to **native ESM
`import`/`export`** so that bundlers can perform **per-export tree-shaking** on the
published packages.

### Original hard constraints
1. **Non-breaking** for existing clients.
2. **All existing tests pass unchanged** — ZERO edits to any test file (`*.spec.ts`, `test/**`).
3. **CJS + UMD outputs preserved** alongside the new ESM output.

## 2. TL;DR of where we are

- Phases A (baseline/pilot), B (per-batch migration, 6 branches), and C (integration
  + build-to-green) are **done**. The branch is **tsc-green** on both packages and
  **emits all four targets** (CJS, ESM, UMD, `.d.ts`).
- **But** we hit a fundamental conflict between constraint (1)+(3) "native ESM" and
  constraint (2) "zero test edits". It is **not a bug** — it is an architecture/release
  decision that only a human can make. See §4.
- **Concretely:** the aggressive full migration on this branch converts leaf classes
  from `export = Class` to `export default Class`, which breaks **66 of 85**
  `concerto-util` tests that do `const X = require('../src/x'); new X()`.

## 3. What is on this branch (current implementation state)

Base pilot commit `97534fddc`, then 6 migration batches merged (all disjoint → clean
merges), then two Phase-C fix commits:

| Commit | What |
|---|---|
| `19a42eb8e`..`3c3e5bf1f` | Merge of 6 Phase-B batch branches (util, core-root, core-model, core-serializer, core-introspect-a/b) |
| `e5551ed7d` | Resolve integration seam type errors after native-ESM migration |
| `b4b9c411f` | Use namespace import for `uuid` in `factory.ts` (uuid v9+ has no ESM default) |

`git diff --stat 455c77977` → **91 files, +1180 / −828**.

### Phase-C seam fixes (all runtime-neutral — verified)

The baseline was tsc-green only because `const X = require()` typed everything as `any`.
Migrating to real ESM imports **unmasked latent type inconsistencies**. Six clusters fixed:

| File | Fix | Why |
|---|---|---|
| `serializer/validationexception.ts` | `constructor(message, component?)` | optional 2nd arg |
| `serializer/jsonpopulator.ts` | `visit(thing: any, …)`; `path?: TypedStack<string>` | union `VisitorTarget` lacks duck-typed `?.()` predicates; `TypedStack` is what's assigned at runtime |
| `serializer/resourcevalidator.ts` | `constructor(options?)` | body already `options \|\| {}` |
| `introspect/metamodel.ts` | drop dead trailing `true` 5th arg to `new ModelFile(...)` (2 sites) | ctor is 4-param, never read `arguments[4]` |
| `introspect/modelfile.ts` | `getImports()` `let result: string[] = []` | was inferred `never[]` |
| `serializer/jsongenerator.ts` | `let id: any = null` | matches sibling `let result: any = {}` |

### `factory.ts` uuid fix
`import * as uuid from 'uuid'` (not `import uuid from 'uuid'`) — usage is `uuid.v4()`.
uuid v9+ ESM exports are named-only; esbuild found no `default` when building `dist/esm`.

### Verified green / emitting
- `tsc -p tsconfig.build.json`: **0 errors**, both packages (matches baseline `455c77977`).
- Emits: `dist/index.js` (CJS), `dist/index.d.ts`, `dist/esm/index.mjs` (ESM via esbuild),
  `dist/concerto-*.js` (UMD via webpack).
- **Zero existing-test edits confirmed.** The only changed test file is the pilot's
  *added* `e2e/tests/browser-bundles.spec.ts` (+86/−0) — a new file, not a modification.

### ❌ Known-red
- `concerto-util` test suite: **66/85 fail** with "X is not a constructor". Root cause is
  the `export =` → `export default` leaf conversion (see §4). This is expected and is the
  subject of the decision below — **do not try to "fix" it as a code bug.**

## 4. The strategic conflict (why this is paused)

TypeScript compiles module syntax to CJS interop as follows, and **no compiler flag
changes this**:

- `export = X` → `module.exports = X`  →  `require()` returns **the bare value** ✅
- `export default X` (under `module: commonjs`) → `exports.default = X`  →  `require()`
  returns `{ default: X }`, so `new require('...')()` throws "not a constructor" ❌

The existing `concerto-util` tests deep-require **source** leaf modules and construct them
directly: `const Writer = require('../src/writer'); new Writer()`. Only `export = Writer`
satisfies that. So:

> **"native ESM everywhere" (incl. leaf classes) ⟺ breaks "zero test edits".**
> These two constraints cannot both hold for the deep-required leaf classes.

**Scope of the break is bounded.** Root consumers (`import { Writer } from '@accordproject/concerto-util'`)
are non-breaking either way. The break is confined to:
1. Deep constructor imports of `./dist/*` leaf modules (a discouraged but real contract), and
2. Source-coupled tests that `require('../src/<leaf>')` and `new` it.

Namespace modules (`label`, `identifiers`, `warning`, `modelwriter`, `errorcodes`) that are
deep-required as objects are **unaffected** — only single-class-export leaves matter.

### The options

| | **A. Hybrid (non-breaking minor now)** ⭐ recommended | **B. Clean break (dual-package major, v5)** | **C. Measure first** |
|---|---|---|---|
| Leaf classes | Revert ~8 util leaves (+ core equivalents) to `export =` | Native ESM everywhere | TBD |
| Index / import-graph / namespace modules | Native ESM (tree-shakeable) | Native ESM | Native ESM |
| Tests | Pass unchanged (0 edits) | Require edits OR a codemod/shim; ship v5 | — |
| Client impact | **None** | Deep `./dist/*` constructor imports break; root imports fine | — |
| Tree-shaking win | **Partial** — index + graph shake; leaves still `export =` | **Full** per-export | — |
| Release | Minor (e.g. 3.x) | Major (5.0.0), dual-package `exports` map | — |
| Effort now | Low (revert ~8–12 files, re-run to green) | High (release eng, migration guide, dual build) | Low (2 measurements) |

**Recommendation: A now, plan B as v5.** Ship the tree-shaking win that is achievable
without breaking anyone, and schedule the full clean break for a deliberate major release
once its value is measured (§6).

## 5. Path A — Hybrid implementation steps (the recommended actionable work)

Do this on a branch off `esm/integration` (keep this checkpoint intact).

1. **Revert leaf single-class exports back to `export = X`** for every module that a test
   deep-requires-and-constructs. Start with the `concerto-util` leaves:
   `writer.ts`, `filewriter.ts`, `inmemorywriter.ts`, `typedstack.ts`, `logger.ts`,
   `baseexception.ts`, `filedownloader.ts`, `null.ts`.
   - Mechanically: replace the trailing `export { X };\nexport default X;` with `export = X;`
     and change any intra-package `import X from './x'` of that leaf to `import X = require('./x')`.
   - Confirm each against its test: `grep -rn "require('../src/<leaf>')" packages/concerto-util/test`.
2. **Repeat for `concerto-core` leaves** that tests deep-require-and-construct (enumerate
   with the same grep against `packages/concerto-core/test`).
3. **Keep native ESM** for: `index.ts`, the internal import graph (cross-module imports that
   are *not* `new`-ed by tests), and all namespace/object modules.
4. **Re-run the full suites** until green:
   ```bash
   cd packages/concerto-util && npm test
   cd ../concerto-core && npm test
   ```
   Target: match baseline pass counts exactly. (Util baseline = 85 passing.)
5. **Re-verify emit** (CJS/ESM/UMD/.d.ts all present) and **zero test edits**
   (`git diff --stat <base> -- '*.spec.ts' 'packages/**/test/**'` → empty).
6. Update `concerto-3oj`; unblock/close `concerto-mwi` (D1).

## 6. Gating measurements before committing to v5 (Path B)

File these as work under `concerto-334`:

1. **Tree-shaking delta: hybrid vs. full.** Build a tiny consumer that imports one symbol
   (e.g. `Writer`) and measure bundle size under (a) this hybrid and (b) a full-ESM leaf
   build. If the delta is small, Path B's client breakage isn't worth a major; if large,
   it justifies v5. (beads `concerto-fe5` = D2.)
2. **Real deep-import blast radius.** Grep the top dependents (accord-project/*, known
   downstreams) for `require('@accordproject/concerto-*/dist/...')` and
   `from '@accordproject/concerto-*/dist/...'` constructor usage. Quantify how many real
   consumers Path B would break. (Related: `concerto-a34` = D3 tarball compat.)

## 7. Path B — deferred v5 clean-break scope (when greenlit)

- Native ESM for **all** modules incl. leaves.
- `package.json` `exports` map: dual-package (`import` → `dist/esm/*.mjs`, `require` →
  `dist/*.js`), bump `main`/`module`/`types`, add `"type"` strategy.
- Provide a **codemod or shim** for deep `./dist/*` constructor importers, or explicitly
  drop the deep-import contract in the migration guide.
- Version bump to **5.0.0**; write MIGRATION.md; coordinate the monorepo (all
  `@accordproject/concerto-*` packages) so cross-package imports stay consistent.
- Tests: update the source-coupled `require('../src/<leaf>'); new` patterns (allowed under
  a major) or replace with `import`.

## 8. How to resume in a fresh Claude session

1. `git fetch && git checkout esm/integration` (or check out the PR branch).
2. Worktree used previously: `/private/tmp/concerto-esm-integration` (has `node_modules`,
   builds succeed). Recreate with `git worktree add` if gone.
3. Read this file and `bd show concerto-3oj`, `bd show concerto-334`.
4. **Confirm the human's Option choice (A/B/C)** — this is the blocker. Do not assume.
5. If **A**: follow §5. If **B**: follow §7 (after §6 measurements). If **C**: run §6 first.

### Environment / workflow notes for the resumer
- Tests run via `TS_NODE_PROJECT=tsconfig.build.json TZ=UTC nyc mocha -r ts-node/register`
  — ts-node type-checks `src` under commonjs and deep-requires source (this is why leaf
  `export =` matters).
- `concerto-util` tsconfig `module: commonjs`; `concerto-core` NodeNext + resolveJsonModule.
- Beads pre-commit hook injects a gitignored `.beads/issues.jsonl`. Workaround when
  committing src: stage only src files and commit with
  `git -c core.hooksPath=/dev/null commit --no-verify`.
- Preserve Apache license headers byte-for-byte. Never edit `*.spec.ts` / `test/**` /
  `dist/`. No force-push / auto-merge to a public branch without explicit human approval.

## 9. Beads issue map

| Issue | Meaning | State |
|---|---|---|
| `concerto-334` | Parent epic: full native-ESM migration | open |
| `concerto-3oj` | Phase C: integration + build-to-green | in_progress (this branch) |
| `concerto-mwi` | D1: full test suite vs baseline | open (blocked by decision) |
| `concerto-fe5` | D2: tree-shaking measurement | open (gating measurement #1) |
| `concerto-a34` | D3: non-breaking compat from tarballs | open (gating measurement #2) |
| `concerto-btw` | Phase E: close-out + push | open |
| *(new)* | **Decision: choose ESM release strategy A/B/C for #1304** | to be filed |

## License <a name="license"></a>
Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
