# Moved: lifted checks and scenarios

Everything that lived in this directory (`fallbacks.spec.js`, the
`*.checks.js` files, `boundary-args.expect.json`, the `*.scenarios.js`
recorder inputs, `MAP.tsv` and `README.md`) moved to
[`packages/concerto-core/test-lifted/`](../../../packages/concerto-core/test-lifted/)
in accordproject/concerto-rust#252, so the lifted checks outlive `migration/`.
The core loader they use (`migration/oracle/lib/core.js`) moved with them to
`packages/concerto-core/test-lifted/lib/core.js`; the old path only forwards.

There are no copies here. `drivers/lifted.spec.js` reads the scenarios from
the new location.
