# Running a migration worker on your machine

The worker is a dynamic workflow. Each round it:
1. finds open issues in `accordproject/concerto-rust` labelled `migration`, `mig:ready` and `worker:<you>` whose dependencies are done;
2. claims them;
3. runs each through **implement → adversarial review (plus one fix round if needed) → draft PR → merge**, in parallel. A task is merged only if its review passed and CI is green.

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
- When a task's review passed, the worker waits for CI on all of its PRs. If every check is green, it merges them all into `claude/tender-pascal-ocwf9q`, closes the issue and labels it `mig:done`.
  - `concerto-rust` and `concerto-validate-rs` merge with `gh pr merge --merge`.
  - `concerto` refuses merge commits through the API. There, the worker makes a signed-off `--no-ff` merge in a throwaway worktree and pushes it.
- The worker never merges to `main`.
- The worker leaves some tasks for the coordinator: any task whose review failed (`mig:blocked`), and any task whose CI failed, timed out or hit a merge conflict (still `mig:in-review`, with a comment on the issue).

## Sizing parallelism
- A workflow runs at most min(16, CPUs − 2) agents at once. `maxPerRound` caps how many tasks each round claims.
- On an 8-core machine, `maxPerRound: 3` keeps implementers and reviewers flowing without starving the test runs.
- Rust builds and the concerto-core suite are CPU-heavy, so err low.

## Adding more workers
Any other environment can run a worker under its own name, for example `worker: "cloud-3"`. Ask the coordinator to start labelling issues `worker:cloud-3`. Workers only take issues that carry their own worker label, so they never collide.

## Cloud workers (Claude Code on the web)
Cloud sessions have no `gh` CLI; they reach GitHub through the GitHub MCP tools. Run **`cloud-worker-workflow.js`**, not the local script.
- **Never edit `cloud-worker-workflow.js` by hand.** It is generated from `local-worker-workflow.js`. After changing the local script, run `node migration/worker/make-cloud-worker.mjs` and commit both files. The generator refuses to write if any `gh` use is left untranslated.
- **Setup:** start a session in the migration environment with `concerto`, `concerto-rust` and `concerto-validate-rs`, then:
  1. Check out `claude/tender-pascal-ocwf9q` in each repo, and clone `concerto-conformance` next to them.
  2. Install the canonical oracle corpus:
     - Download it with `curl -sSL -H 'Accept: application/octet-stream' https://api.github.com/repos/accordproject/concerto-rust/releases/assets/587625306 -o corpus.tgz`. The session proxy authenticates the request.
     - Check its sha256 is `e8a2bf72c7775a2d45123dea7b6ff897823c74a108603f5412251ced2619fce1`.
     - Run `tar xzf` on it at the concerto root and delete the `._*` files it creates.
  3. Pre-approve `Workflow`, `mcp__github`, and `Bash(git *)`, `Bash(cargo *)`, `Bash(npm *)`, `Bash(node *)` and `Bash(npx *)` in `/root/.claude/settings.json`, so scheduled runs don't wait for approval.
- **Run:** say *"Use a workflow: run the workflow script at `/home/user/concerto/migration/worker/cloud-worker-workflow.js` with args `{"worker": "cloud-3", "workspace": "/home/user", "rounds": 10, "maxPerRound": 3}`"*. `git pull` the integration branch first so you run the latest rules.
- **Keep it running:** add an hourly routine that re-runs the worker when no run is in progress. Session cron jobs are lost when an idle session is shut down, so the routine is what keeps a cloud worker going overnight.
- **CPU:** a cloud container has about 4 cores. Use `maxPerRound: 2`–`3`.

## Stopping
Stop the workflow from `/workflows`. Tasks already claimed stay labelled `mig:claimed`. To hand them back, relabel them `mig:ready`, or let the coordinator reassign them.
