# Oracle corpus supplement (task P2-11b)

- Additive to the pinned canonical corpus `oracle-corpus-p107-06aa375` (content hash `7b9be1de66690be63e689b3bf0feb4583ed6cd9597099fdec1acb32f87736e71`), which it does not change.
- Recorded from accordproject/concerto@d842c0ab7 by `migration/oracle/drivers/supplement.spec.js` under `lib/recorder.js` (frozen clock, seeded random and uuid), against the frozen reference's own source (concerto-core v5.0.0 `src/`).
- Built by `migration/oracle/bin/build-supplement.js`: 157 fixtures under `migration/oracle/fixtures/supplement/`, blobs inlined, 2 exact duplicate(s) of pinned fixtures dropped, no id collision.
- Files: 157 fixture files plus `fixtures/supplement/manifest.json`.
- Content hash: 1b3bf6a55c70826d9fc79530792e482e17c122ce83ec49595bb15ddfa90cdbeb -- sha256 of the sorted "<sha256>  <path>" lines of every fixture file under `fixtures/supplement/` (not `manifest.json`), paths relative to the concerto checkout root: the same method as CORPUS.md's pin hash, but over only the supplement's own fixture files, not the whole corpus and not `cto-cache/` (CORPUS.md's pin hash spans both `fixtures/` and `cto-cache/`).
- CTO cache delta: 7 entries under `migration/oracle/cto-cache/` that the supplement needs and the canonical shared copy (pinned cache plus its P2-09b rebuild, 705 files) lacks. Rebuilding with `node migration/oracle/bin/build-cto-cache.js` gives the same 712 entries.
- Measured with `coverage.sh --with-suite` (pinned + supplement, 16,242 fixtures, 100% pass against the reference): statements 99.21%, branches 96.34%, functions 99.01%, lines 99.19%.

Use: extract at the root of a concerto checkout of claude/tender-pascal-ocwf9q that already holds the pinned corpus (`tar xzf`). It adds only `migration/oracle/fixtures/supplement/` and 7 cache files, and changes no existing file. Verify the pin afterwards: the CORPUS.md content hash over the pinned tarball's own file list must still be 7b9be1de66690be63e689b3bf0feb4583ed6cd9597099fdec1acb32f87736e71.

baseline.tsv rows for the supplement (66: 62 pass, 4 fail) must land together with this extraction: on a full run the harness fails on a baselined fixture that is missing from the corpus.
