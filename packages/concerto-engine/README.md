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
    concerto-engine.cjs                           Node `require`  (index.js)
    concerto-engine.node.mjs                      Node `import`   (index.mjs)
    concerto-engine.mjs                           browsers, and any other `import` (browser.mjs)
    concerto_wasm.wasm                            the module, the package's only copy
```

Build it with:

```sh
cd ../concerto-rust/concerto-wasm
npm install          # binaryen (wasm-opt) and Playwright, for the smokes
npm run build        # needs the wasm32-unknown-unknown target and wasm-bindgen-cli 0.2.128
```

**Node** loads synchronously. Both Node loaders read the raw
`concerto_wasm.wasm` next to them with `readFileSync` and are ready once
loaded; their `init()` resolves at once. To use a build somewhere else, set
`CONCERTO_ENGINE_MODULE` to its `concerto-engine.cjs` (with its
`concerto_wasm.wasm` next to it); the shim then loads that path instead of
this package.

**Browsers** call `await init()` first (BC-32). The browser loader
(`browser.mjs`, the `browser` condition) instantiates nothing when it is
imported. `init()` fetches and compiles `concerto_wasm.wasm`, next to the
loader by default (`new URL('./concerto_wasm.wasm', import.meta.url)`), or
what `init({ module_or_path })` names: a URL, a `Response`, the bytes or a
compiled `WebAssembly.Module`. It is idempotent: every call returns the same
promise. concerto-core can be imported before `init()` runs, but nothing
that reaches the engine may be called until it resolves.

## Browsers: the worker recipe

concerto-core is Node and server first; Concertino is the lightweight
browser path. A browser app that needs concerto-core itself runs it **in a
module Worker** (or bundles it for the page): the engine's 3.4 MB module is
then fetched, compiled and used off the main thread, and the page only posts
plain data.

1. **Supply the engine host.** concerto-core's browser build loads its
   engine modules through a synchronous `require` that the bundler or host
   provides as `globalThis.module.require` (PORTING.md 1.5 in
   concerto-rust). Stock bundlers do not generate it, because the
   specifiers are not literal, so the worker imports a generated registry
   of those modules first, before concerto-core.
2. **Call `await init()`** from `@accordproject/concerto-engine` in the
   worker before the first engine-backed call. Keep the promise and await it
   in every message handler.
3. **Ship the `.wasm`.** Vite and webpack 5 emit it as an asset by
   themselves. With esbuild or plain Rollup, copy `concerto_wasm.wasm` next
   to the bundle, or pass `init({ module_or_path })`.
4. **Talk to the worker with plain data** (CTO text, JSON instances, and the
   results as JSON or `{ name, message }` errors): class instances do not
   cross `postMessage`.

[`examples/worker/`](examples/worker/) is the recipe as a small app:

- `worker.mjs` imports the engine host, then `init` and concerto-core, and
  validates the instances it is sent;
- `main.mjs` is the page side: `validate(model, instance)` posts to the
  worker and resolves with its answer;
- `build.mjs` bundles the worker with esbuild, generating the engine host
  as a virtual module, and copies the `.wasm` next to it.

```sh
node packages/concerto-engine/examples/worker/build.mjs /tmp/concerto-worker
# then serve /tmp/concerto-worker over HTTP and open index.html
```

`e2e/tests/engine-worker.spec.ts` builds and runs it in Chromium.

## CI and publishing

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
