# @accordproject/concerto-engine (local link)

The concerto-core Rust engine, compiled to WASM by
[concerto-rust](https://github.com/accordproject/concerto-rust)'s
`concerto-wasm` crate. The migration's `CONCERTO_ENGINE=rust` shim
(`packages/concerto-core/src/engine/`) loads it by this name.

The engine is not published (decision D9 of accordproject/concerto-rust#29).
This workspace package links it locally instead: `npm install` puts it at
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

Nothing in the default (`CONCERTO_ENGINE=ts`) mode loads this package, so a
checkout without concerto-rust builds and tests as before.
