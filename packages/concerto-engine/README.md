# @accordproject/concerto-engine

The concerto-core Rust engine, compiled to WASM by
[concerto-rust](https://github.com/accordproject/concerto-rust)'s
`concerto-wasm` crate. The migration's `CONCERTO_ENGINE=rust` shim
(`packages/concerto-core/src/engine/`) loads it by this name.

In this repository the package links the engine locally: `npm install` puts it at
`node_modules/@accordproject/concerto-engine`, and it re-exports the loaders
that `concerto-wasm/build.sh` writes into a concerto-rust checkout **next to
this one**:

```
<dir>/concerto/                                   this repository
<dir>/concerto-rust/concerto-wasm/pkg/            the built package
    concerto-engine.cjs                           `require` (index.js)
    concerto-engine.mjs                           `import`  (index.mjs)
```

Build it with:

```sh
cd ../concerto-rust/concerto-wasm
npm install          # binaryen (wasm-opt) and Playwright, for the smokes
npm run build        # needs the wasm32-unknown-unknown target and wasm-bindgen-cli 0.2.128
```

Both loaders carry the `.wasm` inline and instantiate it synchronously when
they are loaded. To use a build somewhere else, set `CONCERTO_ENGINE_MODULE`
to its `concerto-engine.cjs`; the shim then loads that path instead of this
package.

concerto-core loads the engine when it is imported and declares this package
as a dependency, so concerto does not build or test without it. CI provides
it the same way: `.github/actions/concerto-engine` builds concerto-wasm from a
pinned concerto-rust commit into a sibling checkout
(accordproject/concerto-rust#259). This package itself is **not published**
(decision D9, accordproject/concerto-rust#28/#29); the Rust build is not
stable enough to release yet (accordproject/concerto-rust#259, #278).

Because concerto-core depends on this private workspace package, D9 must be
resolved (this package published, or the dependency otherwise removed) before
concerto-core itself can be released — a published package cannot depend on a
private one.
