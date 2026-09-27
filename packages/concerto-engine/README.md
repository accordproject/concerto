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
(accordproject/concerto-rust#259).

## Publishing

This package is published with the other concerto packages, at the same
version, and concerto-core depends on that version (`scripts/bump_version.js`
keeps them in step). This supersedes decision D9 (not published) for the
release (accordproject/concerto-rust#259, #28).

The published package carries the built engine rather than the link. On
`npm pack` / `npm publish`, `prepack` runs `node scripts/pack.js stage`,
which copies the engine's runtime files into `pkg/` and points `index.js` and
`index.mjs` at them; `postpack` restores the link and removes `pkg/`:

```
pkg/concerto-engine.cjs      `require` (index.js)
pkg/concerto-engine.mjs      `import`  (index.mjs)
pkg/web/concerto_wasm.js     the wasm-bindgen glue concerto-engine.mjs imports
pkg/web/package.json
```

The engine is read from the sibling checkout above, or from
`CONCERTO_ENGINE_PKG` when that is set; packing fails when it is not built.
The release workflow (`.github/workflows/publish.yml`) builds it first with
`.github/actions/concerto-engine`.
