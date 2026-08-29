# Migrating to Concerto 5.0.0

Concerto 5.0.0 converts the internal modules of `@accordproject/concerto-core`,
`@accordproject/concerto-util`, `@accordproject/concerto-cto` and
`@accordproject/concerto-vocabulary` from TypeScript's CommonJS-interop export syntax
(`export = X`) to native ES module syntax (`export default X` / `export { X }`). This
was done under [issue #1304](https://github.com/accordproject/concerto/issues/1304)
(see [PR #1306](https://github.com/accordproject/concerto/pull/1306)) so that bundlers
can tree-shake unused exports out of applications that only need part of the API.

**Who is affected:** almost nobody. If your code imports Concerto packages by their
package name — `require('@accordproject/concerto-util')` or
`import { Writer } from '@accordproject/concerto-core'` — nothing changes and you can
upgrade without edits. You are only affected if your code reaches past the package
root into a package's built internals, e.g.
`require('@accordproject/concerto-util/dist/writer')`.

This change applies to all packages in this monorepo: `@accordproject/concerto-core`,
`@accordproject/concerto-util`, `@accordproject/concerto-cto`,
`@accordproject/concertino`, `@accordproject/concerto-vocabulary`,
`@accordproject/concerto-analysis`, and `@accordproject/concerto-linter`. All of them
move to 5.0.0 together to keep their versions in lockstep.

## Am I affected?

Run these against your own codebase. Anything they print is worth checking against the
"Breaking changes" section below.

```bash
# CommonJS deep requires into a package's compiled internals
grep -rn "require(['\"]@accordproject/concerto-[a-z-]*/dist/" .

# ESM deep imports into a package's compiled internals
grep -rn "from ['\"]@accordproject/concerto-[a-z-]*/dist/" .
```

If those commands find nothing, you are not affected — upgrade and move on. If they
find something, look at what is being imported:

- Importing a **class** deep path (e.g. `.../dist/writer`, `.../dist/filewriter`,
  `.../dist/modelmanager`) and constructing it directly (`new Writer()`) is the
  pattern that breaks. See "Breaking changes" below.
- Importing an **object/namespace** module (e.g. `.../dist/label`,
  `.../dist/identifiers`, `.../dist/warning`, `.../dist/modelwriter`,
  `.../dist/errorcodes`) and reading named functions or constants off it is
  unaffected — those modules were already plain named exports.

Note that `ModelUtil` (`concerto-core/dist/modelutil`) *looks* like a namespace but is
a class of static methods, so it is in the first category, not the second.

## What changed and why

Bundlers can only tree-shake (drop unused code from a bundle) when a module's exports
are statically analyzable ES module `export` statements. Concerto's TypeScript source
previously used `export = X`, a CommonJS-interop construct that compiles to
`module.exports = X` and cannot be statically analyzed by an ESM-aware bundler. That
prevented import-level tree-shaking of `concerto-core` and `concerto-util`, even though
the packages already published an ESM build.

5.0.0 changes the source to native ESM: `import X from './x'` / `import * as NS from
'./ns'` on the way in, and `export { X }; export default X;` on the way out, for each
class-shaped module. This is a purely mechanical, low-level TypeScript compilation
detail, but it has a real runtime effect on `require()`:

- `export = X` compiles to `module.exports = X`, so `require('./x')` returns **the
  bare class** — `new (require('./x'))()` works.
- `export default X` (compiled under `module: commonjs`) compiles to
  `exports.default = X` (alongside `exports.X = X`), so `require('./x')` returns **an
  object**, `{ default: X, X }` — `new (require('./x'))()` now throws, because the
  thing you got back is a plain object, not the class.

No `tsconfig` flag changes this: it is how the TypeScript compiler has always lowered
these two export forms to CommonJS. There was no way to keep both `export =` (for old
deep `require()` callers) and `export default` (for tree-shaking) on the same module at
once, so this is a deliberate, scoped breaking change confined to deep imports.

## Breaking changes

### Deep CommonJS `require()` of a class module

**Before (4.x):**

```js
const Writer = require('@accordproject/concerto-util/dist/writer');
const writer = new Writer();
```

**After (5.0.0)** — this throws `TypeError: Writer is not a constructor`. Fix it by
destructuring the named export, or reading `.default`:

```js
const { Writer } = require('@accordproject/concerto-util/dist/writer');
const writer = new Writer();

// or
const Writer = require('@accordproject/concerto-util/dist/writer').default;
const writer = new Writer();
```

Preferred: stop importing the built file at all and import from the package root
instead (see "Recommended migration path" below).

### Deep ESM `import` of a class module

**Before (4.x)** — a default import worked because `export =` interop makes the whole
module the default:

```js
import Writer from '@accordproject/concerto-util/dist/writer';
const writer = new Writer();
```

**After (5.0.0)** — this breaks too. The `./dist/*` subpath resolves to the
**CommonJS** build, and when an ESM importer loads a CommonJS module the default import
is bound to `module.exports` — which is now the `{ default: Writer, Writer }` object
rather than the class. Use a named import instead; it works in both module systems:

```js
import { Writer } from '@accordproject/concerto-util/dist/writer';
const writer = new Writer();
```

### The UMD browser bundles are removed

**Before (4.x):** three packages published a webpack-built UMD bundle for direct browser
consumption via a `<script>` tag. The bundle exposed a global named after the package —
which is not a valid JavaScript identifier, so it was read off `window`:

```html
<script src="https://cdn.jsdelivr.net/npm/@accordproject/concerto-core/dist/concerto-core.js"></script>
<script>
  const { Factory, ModelManager } = window['concerto-core'];
</script>
```

The same packages also set the legacy top-level `browser` field in `package.json` to
point at these bundles, for bundlers that predate the `exports` field.

The bundles were at:
- `@accordproject/concerto-core`: `dist/concerto-core.js`
- `@accordproject/concerto-util`: `dist/concerto-util.js`
- `@accordproject/concerto-cto`: `dist/concerto-cto.js`

**After (5.0.0)** — the UMD bundles and the `browser` field are removed. They are gone
in all three packages with no drop-in replacement.

What actually changed:

- **For bundler users** (webpack 5+, Vite, Rollup, esbuild): nothing. These read the
  `exports` map, which takes precedence over the legacy `browser` field, so they were
  already resolving to the browser ESM graph at `dist/esm-browser/index.mjs` rather than
  the UMD bundle. Removing the bundle takes away something they had stopped using. Your
  code needs no edits.
- **For `<script>` tag users** with no build step: you were relying on the UMD bundle's
  global namespace. That is gone. Your options are:
  1. **Add a bundler** to your build (webpack, esbuild, Rollup, Vite). Bundle the
     package with your own code and import normally.
  2. **Load the ESM graph as a module**, with `<script type="module">` and an
     `import` statement. Note that `dist/esm-browser/index.mjs` is a module *graph*, not
     a single file — it imports sibling chunks by relative path, and `concerto-core`'s
     graph additionally imports `@accordproject/concerto-cto` and
     `@accordproject/concerto-util` as bare specifiers. Serving it therefore needs
     either a CDN that rewrites those specifiers into resolvable URLs, or an import map
     that maps them yourself. Check the behaviour of whichever CDN you use before
     relying on it.
- **For tooling that does not read `exports` at all** (webpack 4, browserify, Parcel 1):
  this is the sharp edge. Those tools previously found the UMD bundle through the
  top-level `browser` field. With both removed they fall back to `main`, which is the
  **CommonJS** build — it imports `fs` and other Node builtins, so it will not run in a
  browser, and the failure surfaces as a confusing missing-module error rather than a
  clear one. There is no supported path for these tools in 5.0.0; upgrade to a bundler
  that understands `exports`.

The `browser` condition in `exports` (which points to `dist/esm-browser/index.mjs`) is
still there and still in use — bundlers automatically pick it when targeting the web. But
the old UMD distribution is gone, and there is no `window['concerto-core']` global
anymore.

### Affected modules

Every single-class module in the four migrated packages moved from `export =` to
`export default` / `export { X }`:

- `concerto-util` — `Writer`, `FileWriter`, `InMemoryWriter`, `TypedStack`, `Logger`,
  `BaseException`, `BaseFileException`, `FileDownloader`, and the file loaders.
- `concerto-core` — `ModelManager`, `Factory`, `Serializer`, `ModelFile`,
  `Introspector`, `ModelUtil`, and the various `*Declaration`/`*Validator` classes.
- `concerto-cto` — `ParseException`. The `Parser`, `Printer` and `External` modules were
  object exports and stay object-shaped, but they now also expose their members as
  individual named exports (`parse`, `parseModels`, `toCTO`, `resolveExternal`,
  `createDefaultFileDownloader`), which is what makes them tree-shakeable.
- `concerto-vocabulary` — `Vocabulary`, `VocabularyManager`.

Any of these you deep-import and construct directly needs the fix above (or, better, a
root import).

### Type-only imports

If you were reaching into a package's `types/` declaration tree — e.g.
`import type { ClassDeclaration } from '@accordproject/concerto-core/types/lib/introspect/classdeclaration'`
— stop. That path is not part of the package's export surface and is not guaranteed to
resolve under `node16`/`nodenext` or `bundler` module resolution. Import the type from
the package root instead:

```ts
import type { ClassDeclaration, ModelFile } from '@accordproject/concerto-core';
```

`import type` is erased at compile time, so it costs nothing at runtime and cannot
anchor a module into your bundle — which is exactly why it is the right tool here, and
why the packages deliberately do **not** widen their `exports` map to re-expose the
`types/` tree. If a type you need is not reachable from the root, please open an issue
asking for it to be exported rather than deep-importing the declaration file.

### Mixing `import` and `require` in one Node process

In 4.x a package had no `exports` map and no `module` field, so `import` and `require`
both resolved to the same CommonJS file: one copy of every class, in one process. From
5.0.0 they resolve to different files, and Node loads each independently. A process
that reaches a package both ways therefore holds **two copies** of it, with two sets of
class identities:

```js
import { ModelManager, Factory } from '@accordproject/concerto-core';
const concerto = createRequire(import.meta.url)('@accordproject/concerto-core');

ModelManager === concerto.ModelManager;   // 4.x: true — 5.0.0: false
```

Most of the API is duck-typed and survives this, but the `instanceof` guards do not.
The failure is not subtle when it happens:

```js
const resource = new Factory(modelManager).newResource('org.example@1.0.0', 'Order', 'o1');
new concerto.Serializer(...).toJSON(resource);
// Error: "Serializer.toJSON" only accepts "Concept", "Event", "Asset",
// "Participant" or "Transaction".
```

This is the standard dual-package hazard, and it is inherent to shipping both module
systems. It only bites a process that loads a package twice, so:

- **Pick one module system per process for a given package.** In an ESM application,
  `import` the package; don't also `createRequire` it.
- **Watch for a CommonJS dependency in an ESM app.** A library that still uses
  `require('@accordproject/concerto-core')` internally has its own copy. Objects can
  cross that boundary safely, but `Resource`s and `ClassDeclaration`s created on one
  side must be handed back to that same side to be serialized or validated. Where a
  library re-exports concerto types for you (`@accordproject/template-engine` re-exports
  `ModelManager` for exactly this reason), import them from the library rather than from
  `@accordproject/concerto-core` directly.
- **Check for a duplicate before debugging anything stranger.** If an `instanceof` or a
  `Serializer` guard fails on an object that is obviously the right type, run
  `npm ls @accordproject/concerto-core` and confirm you aren't loading it twice.

## Not breaking

Root-package imports are unaffected — this is true for both CommonJS and ESM, and for
every package in this release:

```js
// CommonJS — unchanged
const { Writer, FileWriter, Logger, TypedStack } = require('@accordproject/concerto-util');
const { ModelManager, Factory, Serializer } = require('@accordproject/concerto-core');

// ESM — unchanged
import { Writer, FileWriter, Logger, TypedStack } from '@accordproject/concerto-util';
import { ModelManager, Factory, Serializer } from '@accordproject/concerto-core';
```

Namespace/object modules that were already plain object exports are unaffected even
when deep-imported, because they never went through the `export =` vs `export default`
change described above. In `concerto-util` these are `label`, `identifiers`,
`errorcodes`, `warning`, and `modelwriter` (re-exported from the package root under the
names `Label`, `Identifiers`, `ErrorCodes`, `Warning` and `ModelWriter`):

```js
// the module's own named exports — unchanged
const { writeModelsToFileSystem } = require('@accordproject/concerto-util/dist/modelwriter');
writeModelsToFileSystem(files, path, options);

// or, preferred, via the root barrel's namespace re-export
const { ModelWriter } = require('@accordproject/concerto-util');
ModelWriter.writeModelsToFileSystem(files, path, options);
```

## Recommended migration path

1. **Prefer root-package named imports.** This is the supported, stable contract and
   is unaffected by this release regardless of module bundler or module system:

   ```js
   import { Writer, ModelManager, Factory } from '@accordproject/concerto-core';
   ```

   `concerto-core`'s root barrel re-exports (among others) `ModelManager`, `Factory`,
   `Serializer`, `Introspector`, `ModelFile`, `ModelUtil`, `ModelLoader`,
   `DecoratorManager`, `Decorator`, `ClassDeclaration`, `Property`, `Field`,
   `Relationship`, `Resource`, and the exception types
   `SecurityException`/`IllegalModelException`/`TypeNotFoundException`/`MetamodelException`.
   `concerto-util`'s root barrel re-exports `Writer`, `FileWriter`, `InMemoryWriter`,
   `Logger`, `TypedStack`, `BaseException`, `BaseFileException`, `FileDownloader`, the
   file loaders (`CompositeFileLoader`, `DefaultFileLoader`, `GitHubFileLoader`,
   `HTTPFileLoader`), and the namespace modules `Label`, `Identifiers`, `ErrorCodes`,
   `Warning`, `ModelWriter`. Check a package's `src/index.ts` (or its published
   `dist/index.d.ts`) for the authoritative, current list.

2. **Use `import type` for anything you only need in a type position.** It is erased at
   compile time, keeps your bundle free of a runtime edge to the module, and is
   resolution-stable across `node16`/`nodenext`/`bundler`:

   ```ts
   import type { ModelFile, Property } from '@accordproject/concerto-core';
   ```

3. **If a symbol genuinely is not re-exported from the root**, keep the deep import but
   update it to the new shape: a named destructure (`const { X } = require(...)`) for
   CommonJS, or `.default` if you need the default export specifically. Consider
   opening an issue to ask for the symbol to be added to the root barrel instead of
   depending on the internal path long-term.

## Tree-shaking: what you get

To benefit from the tree-shaking this release enables:

- Import via `import { Writer } from '@accordproject/concerto-util'` (named ESM
  imports), not `const concertoUtil = require(...)` / `import * as concertoUtil from
  ...` followed by property access — a bundler can only drop what it can see you don't
  use.
- Build with a bundler that reads `package.json`'s `exports`/`module` field and honors
  `sideEffects` (webpack, Rollup, esbuild, Vite all do this by default in production
  mode).
- `@accordproject/concerto-util` declares `"sideEffects": false`, so a compliant
  bundler can drop any export you don't import.
- `@accordproject/concerto-core` declares `"sideEffects": ["./dist/dayjs-setup.js",
  "./dist/esm/dayjs-setup.mjs", "./dist/esm-browser/dayjs-setup.mjs"]` — everything
  else is safe to drop, but those modules run global setup code (`dayjs` plugin
  registration) as a side effect and are always kept.

The ESM build ships one output module per source module (with shared code hoisted into
chunks), mirroring the CJS build, so your bundler can drop whole modules you never
reach.

Measured with `esbuild --bundle --minify --format=esm`, importing each package **by
name** so that resolution happens the way it would in your project (4.2.0 has no
`exports` map, so a browser bundler takes its `browser` field — the UMD bundle — while
5.0.0 resolves the `browser` condition to `dist/esm-browser`):

| What you import | 4.2.0 | 5.0.0 | |
|---|---:|---:|---:|
| `{ Writer }` from `concerto-util` | 95,570 B | **1,050 B** | −98.9% |
| `{ SecurityException }` from `concerto-core` | 903,570 B | **4,064 B** | −99.6% |
| `{ ModelManager }` from `concerto-core` | 903,565 B | **419,416 B** | −53.6% |

Bundling for Node instead (`--platform=node`, which takes 4.2.0's `main` and 5.0.0's
`import` condition):

| What you import | 4.2.0 | 5.0.0 | |
|---|---:|---:|---:|
| `{ Writer }` from `concerto-util` | 28,647 B | **863 B** | −97.0% |
| `{ SecurityException }` from `concerto-core` | 559,234 B | **3,831 B** | −99.3% |
| `{ ModelManager }` from `concerto-core` | 559,229 B | **426,781 B** | −23.7% |

`ModelManager` genuinely reaches most of the package (introspection, serialization and
the CTO parser), so it shrinks least — that is the honest floor, not a bug. Importing
the whole package costs about what it always did.

## Package entrypoints reference

Every package in this release ships a dual-package `exports` map (CJS + ESM + types),
plus the legacy `main`/`module`/`typings` fields for tooling that doesn't read
`exports`.

| Package | `main` (CJS) | `module` (ESM) | `types` |
|---|---|---|---|
| `concerto-core` | `dist/index.js` | `dist/esm/index.mjs` | `dist/index.d.ts` |
| `concerto-util` | `dist/index.js` | `dist/esm/index.mjs` | `dist/index.d.ts` |
| `concerto-cto` | `dist/index.js` | `dist/esm/index.mjs` | `dist/index.d.ts` |
| `concertino` | `dist/index.js` | `dist/esm/index.mjs` | `dist/index.d.ts` |
| `concerto-vocabulary` | `dist/index.js` | `dist/esm/index.mjs` | `dist/index.d.ts` |
| `concerto-analysis` | `dist/index.js` | `dist/esm/index.mjs` | `dist/index.d.ts` |
| `concerto-linter` | `dist/index.js` | `dist/esm/index.mjs` | `dist/index.d.ts` |

Every package's `exports` map has the same shape (shown here for `concerto-core`;
`concerto-util` is identical apart from the package name):

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "browser": "./dist/esm-browser/index.mjs",
    "import": "./dist/esm/index.mjs",
    "require": "./dist/index.js"
  },
  "./package.json": "./package.json",
  "./dist/*": "./dist/*"
}
```

Two ESM graphs are published, built from the same entry points and exposing the same
named exports. They differ only in how Node builtins are handled:

| Graph | Selected by | Node builtins |
|---|---|---|
| `dist/esm` | the `import` condition — Node, and node-target bundlers | real `fs`/`path`, imported normally |
| `dist/esm-browser` | the `browser` condition — webpack, Vite, Rollup and friends targeting the web | stubbed to empty modules |

The split matters for the handful of APIs that touch the file system —
`FileWriter`, `ModelWriter.writeModelsToFileSystem` and `ModelLoader`. In the browser
graph those are inert by construction (the `fs` and `path` modules are stubbed); under
Node they behave exactly as they do in CommonJS. Nothing in your code selects between
the graphs — your runtime or bundler does.

The `"./dist/*"` subpath is what still permits deep imports at all (it is not removed
in this release) — it is the compiled *shape* of those modules, described above, that
changed. The `types/` declaration tree is deliberately **not** mapped in `exports`: use
`import type` from the package root instead (see "Type-only imports" above).

## Getting help

If you hit an import that this guide doesn't cover, please open an issue at
<https://github.com/accordproject/concerto/issues> and reference
[#1304](https://github.com/accordproject/concerto/issues/1304), the tracking issue for
this migration.

## License <a name="license"></a>
Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
