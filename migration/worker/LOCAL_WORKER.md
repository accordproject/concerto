# Running a migration worker on your machine

The worker is a dynamic workflow. Each round it:
1. finds open issues in `accordproject/concerto-rust` labelled `migration`, `mig:ready` and `worker:<you>` whose dependencies are done;
2. claims them;
3. runs each through **implement → adversarial review (plus one fix round if needed) → draft PR**, in parallel.

It keeps going until no ready issues are left, or until it has run the configured number of rounds.

## One-time setup
1. **Workspace:** make a directory, for example `~/concerto-migration`. The first task clones whatever repos it needs into it, or you can clone `concerto`, `concerto-rust`, `concerto-validate-rs` and `concerto-conformance` yourself.
2. **Tools:**
   - `gh`, authenticated (`gh auth status`) with push access to the accordproject repos;
   - `git`;
   - Node 18 or later and npm;
   - a stable Rust toolchain (rust 1.88 or later, edition 2024).
3. Copy `local-worker-workflow.js` into the workspace.
4. Workflows are opt-in. In your local Claude Code session (started in the workspace folder), say:

   > Use a workflow: run the workflow script at `./local-worker-workflow.js` with args `{"worker": "local-matt", "workspace": "<absolute path of the workspace>", "rounds": 10, "maxPerRound": 4}`

## How work reaches you
- The coordinator (the cloud session) is the only dispatcher. It sets `mig:ready` together with `worker:local-matt` on the issues it wants your machine to take. Your worker never takes issues labelled for another worker, so two environments never pick up the same task.
- Your worker pushes `claude/tender-pascal-ocwf9q-local-matt-<ID>` branches and opens **draft PRs** against `claude/tender-pascal-ocwf9q`, each saying "Tracks accordproject/concerto-rust#N".
- The coordinator subscribes to those PRs, reviews them, merges them into the integration branch and closes the issue.

## Sizing parallelism
- A workflow runs at most min(16, CPUs − 2) agents at once. `maxPerRound` caps how many tasks each round claims.
- On an 8-core machine, `maxPerRound: 3` keeps implementers and reviewers flowing without starving the test runs.
- Rust builds and the concerto-core suite are CPU-heavy, so err low.

## Adding more workers
Any other environment can run the same script with a different worker name, for example another cloud session with `worker: "cloud-2"`. Ask the coordinator to start labelling issues `worker:cloud-2`.

## Stopping
Stop the workflow from `/workflows`. Tasks already claimed stay labelled `mig:claimed`. To hand them back, relabel them `mig:ready`, or let the coordinator reassign them.
