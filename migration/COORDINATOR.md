# Migration coordinator runbook (local)

Coordination of the concerto-core → Rust migration moved from the cloud session to the maintainer's machine on 2026-09-24. This file is everything a local Claude Code session needs to take over. The plan is `migration/PLAN.md` (v2.3), the tracker is `accordproject/concerto-rust` issues labelled `migration` (#29–#92), and the rulebook is `PORTING.md` in concerto-rust.

## Roles
- **Coordinator (you):** keep the tracker in sync, label ready tasks for the worker, merge passing worker PRs, report progress. The coordinator doesn't implement tasks.
- **Worker:** `migration/worker/local-worker-workflow.js` (copy it into your workspace), run as a dynamic workflow with `{"worker": "local-matt", ...}`. It picks up issues labelled `mig:ready` together with `worker:local-matt`, then implements, runs an adversarial review, and opens a draft PR. The instructions are in `migration/worker/LOCAL_WORKER.md`.
- **Maintainer:** decides; reviews the integration PRs into `main`.

## Standing rules and decisions
- **Unchanged tests:** never edit `packages/concerto-core/test/**`. The guardrails CI check and `migration/bin/guard-tests-hook.sh` enforce this.
- **Merge policy:** worker PRs whose base is `claude/tender-pascal-ocwf9q` are merged **without human review** once their recorded adversarial-review verdict is "Passed" and CI is green on their head. Before merging, re-run the repo's fast checks on the merged tree. The integration PRs into `main` (accordproject/concerto-rust#78, accordproject/concerto#1327) **always need human review. Never merge them.**
- **All agent work runs locally,** to save cloud allowance.
- **Models:** Opus for architect and reviewer roles, Sonnet for bulk implementation, Haiku for mechanical steps. Don't use Fable.
- **DCO:** every commit is signed off (`git commit --signoff`). Commit trailers:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- **Decisions:** D1 to D11 are in PLAN.md §6. The ledger answers are on #32: HYBRID counts at full weight; markers and `accept()` are excluded; DCS goes in P2-12; Factory model checks go to Rust; YAML quoting is ported; Serializer option B; regex is evaluated in Rust, with a JS engine only when `options.regExp` is supplied; loaders stay in TS; coupling is re-derived.
- **WASM spike input for P1-04 (on #41):** views cache JSON snapshots, not per-getter calls; ids are dense `u32` handles; there is a `generation()` counter.

## Merging a worker PR (stacked branches)
GitHub's merge API refuses PRs whose base is itself an open PR's head. Merge locally instead:
```sh
git -C <repo> fetch origin claude/tender-pascal-ocwf9q <task-branch>
git -C <repo> checkout claude/tender-pascal-ocwf9q && git -C <repo> merge --ff-only origin/claude/tender-pascal-ocwf9q
git -C <repo> merge --no-ff --signoff -m "Merge <task> (#<pr>) into the migration integration branch" origin/<task-branch>
```
**Fast checks before pushing:**
- **Rust repos:** `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
- **concerto-rust, concerto-wasm** (not a workspace member): `cargo fmt --manifest-path concerto-wasm/Cargo.toml -- --check`, `cargo clippy --manifest-path concerto-wasm/Cargo.toml --target wasm32-unknown-unknown -- -D warnings`.
- **concerto:**
  - `node migration/bin/check-guardrails.mjs --base-ref origin/main`;
  - the concerto-core suite in TS mode, expecting 1299 passing and 1 known network failure (`ModelLoader #loadModelFromUrl`) in sandboxed environments;
  - for engine changes, the affected test files with `CONCERTO_ENGINE=rust CONCERTO_ENGINE_MODULE=<concerto-rust>/concerto-wasm/pkg/concerto-engine.cjs`.

Then push, close the tracking issue as `mig:done` with a short evidence comment, and unblock dependants by labelling them `mig:ready` and `worker:local-matt`.

A PR whose review failed: post the findings on its tracking issue, set it back to `mig:ready`, and tell the worker to continue on the same branch and PR.

## Check-in (run hourly)
In a local session in the workspace, run:
```
/loop 1h <paste the check-in prompt below>
```
Or run it by hand when convenient.

> Migration check-in (coordinator only, keep it lean). (1) Tracker: sync the `migration` issue labels in accordproject/concerto-rust with reality. Label tasks whose dependencies are done as `mig:ready` + `worker:local-matt`, with a scoping comment if they could conflict with work in flight. (2) Run `node migration/bin/status.mjs --fast` and `node migration/status/render.mjs` in concerto, then commit the snapshot (signed off) and push. (3) Run `node migration/telemetry/stuck.mjs`. (4) List open PRs with base `claude/tender-pascal-ocwf9q` in concerto, concerto-rust, concerto-validate-rs and concerto-conformance, and apply the merge policy and procedure in `migration/COORDINATOR.md`. (5) Check CI, merge state and review threads on the integration PRs accordproject/concerto-rust#78 and accordproject/concerto#1327. Never merge them. (6) Report: tasks done, in progress and blocked; critical path; TS tests (B/W); oracle; nyc; Rust tests; ledger %; conformance; PRs and merges; blockers; what is ready for the worker. If nothing changed, say so in one line.

## State at handover (2026-09-24 ~15:50 UTC)
- **Done:**
  - all of Phase 0: P0-01 to P0-08, including P0-04a (PORTING.md, #88) and P0-04b (the trial port, #93 and accordproject/concerto#1331);
  - P1-01 (metamodel crate), P1-02 (core on metamodel newtypes), P4-01a (WASM spike);
  - P2-10 part 1 (jsonpopulator lifted).
- **Ready or in progress for local-matt:**

  | Task | Issue | Notes |
  |---|---|---|
  | P1-03 traits and derives | #40 | critical path; don't touch the error-builder or `error.rs` |
  | P1-05 error contract and catalogue | #42 | critical path; absorb the trial's `error.rs` payload |
  | P2-10 | #54 | 207 W tests remain |
  | P2-11 | #55 | failed re-review: about 61 public-API branches still lack inputs; re-run coverage |
  | P1-07a CTO-to-AST cache | #91 | |
  | P5-04a benchmark baseline | #92 | |
- **Next on the critical path:**
  1. P1-04, the handle model (#41; the spike input is on the issue);
  2. P1-07, the native oracle harness (#44);
  3. P1-06;
  4. then Phase 2 (P2-01 to P2-12) in parallel.
- **Metrics:**
  - TS suite 1299/1308 (B 949/956, M 78/80, W 272/272);
  - nyc 98.95/95.80/99.18/98.96, just under the gate only because of the network test;
  - oracle replay 15,037/15,037, 8/8 mutants detected, corpus coverage 88.4%/82.1% (statements/branches) after P2-10 part 1;
  - Rust workspace 157 tests;
  - conformance 60 PASS, 0 FAIL;
  - ledger 85.3% (RUST-only 57.2%).
- **Integration PRs:** accordproject/concerto-rust#78 and accordproject/concerto#1327, both green, both drafts awaiting human review at the end.
- **Upstream, already merged:** concerto-conformance #37 and #38 (the Rust harness).

**Oracle CTO cache (2026-09-25):** the CTO cache is derived from the pinned corpus by `migration/oracle/bin/build-cto-cache.js`, which P2-09b (accordproject/concerto-rust#153) changed. After extracting `oracle-corpus-p107-06aa375`, or whenever that script changes, run `npm ci` in `migration/oracle/reference`, then `node migration/oracle/bin/build-cto-cache.js`. A stale cache shows about 89 false `addModel`/`updateExternalModels` regressions. The fixtures themselves never change.

**Oracle corpus supplement (2026-09-26):** the pin `oracle-corpus-p107-06aa375` is joined by the additive supplement `oracle-corpus-supplement-d842c0ab7` (draft release, maintainer-approved on accordproject/concerto-rust#188, recorded by P2-11b #190). Extract both, supplement second, then rebuild the CTO cache. That gives 16,242 fixtures, with §0.3 coverage at 99.21 / 96.34 / 99.01 / 99.19. The baseline has 66 supplement rows, so a full oracle run needs the supplement.
