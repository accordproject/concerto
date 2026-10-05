# Concerto in the browser (R1, draft)

This guide says how a web app uses Concerto in R1: what runs on the main
thread, what runs in a worker, and what each choice costs. It records
decisions A1 and A2 of the P5-78 spike (accordproject/concerto-rust#420,
decided 2026-10-04) and was written for P5-128 (accordproject/concerto-rust#505).
The [migration guide](./MIGRATION-GUIDE.md#browsers-bc-32) covers the engine's
browser loader (BC-32).

## Three ways in

| what the page needs | use | concerto-core and the engine | browser bundle (gzip) |
|---|---|---|---|
| Read a model and check instances (forms, viewers) | a **prebuilt Concertino** document, with `@accordproject/concertino/runtime` and `./validate` | no | about 7 KiB |
| Edit CTO: parse, resolve imports, report resolution errors, show Concertino | the **CTO pipeline**: `@accordproject/concerto-cto`, then `@accordproject/concertino/resolve`, then the converter | no | about 39 KiB (44 KiB with `./runtime` and `./validate`) |
| Full model validation, `Serializer`, `Factory`, codegen, template engines | **concerto-core and the engine, in a module Worker** (or bundled for the page) | yes | 3.4 MB of WebAssembly, fetched and compiled by `await init()` |

Sizes are from `node packages/concertino/scripts/bundleSizes.js` (esbuild,
ESM, browser, minified, es2022). None of the Concertino and concerto-cto
bundles compiles code at run time (`new Function`), so all of them run under
a strict Content-Security-Policy. `e2e/tests/concertino-pipeline.spec.ts` runs
the CTO pipeline in Chromium and checks that the page fetches neither
concerto-core nor the engine.

| bundle | raw (KiB) | gzip (KiB) |
|---|---:|---:|
| `./runtime` | 5.5 | 2.2 |
| `./validate` and `load` from `./runtime` | 19.8 | 6.6 |
| `./resolve` | 5.9 | 2.2 |
| CTO pipeline: concerto-cto `Parser`, `./resolve`, `convertToConcertino` | 169.5 | 38.7 |
| CTO pipeline, then `load` and `validate` (CTO and JSON in, a validated instance out) | 188.1 | 44.4 |

## What `./resolve` checks, and what it does not

`resolveModels(models, options)` takes concerto-cto ASTs (`Parser.parse`) and
gives the resolved AST that `ModelManager.getAst(true)` gives, which is what
`convertToConcertino` needs. On the way it makes the checks that concerto-core
makes while it resolves names, and reports each problem as a diagnostic with
the class of the exception concerto-core throws for it
(`IllegalModelException`, or `Error`):

- the namespace is versioned, its parts are identifiers, and no namespace is
  declared twice;
- imports are versioned, are not wildcards, name a namespace and a type that
  exist, do not alias a type to a primitive name, and do not mix two versions
  of one namespace;
- declaration names are identifiers and unique in their namespace, do not
  clash with an imported name (the system types `Concept`, `Asset`,
  `Participant`, `Transaction` and `Event` included), and a scalar is not
  named like a primitive;
- every property, relationship, super type and map key or value type is
  declared or imported;
- no declaration extends itself, directly or through a cycle.

These are 17 of the 46 model checks in the P5-78 catalogue. The other 29 need
concerto-core: reserved and duplicate field names, which kinds may extend
which, identifier and relationship rules, validator bounds, default values,
decorator rules and so on. So a model with no diagnostics can still fail full
validation. Run the engine for the final word, as the playground recipes below
do. On the concerto-conformance model scenarios, the resolver reports no
diagnostic on any valid model, and catches 15 of the 45 invalid ones
(concerto-conformance `57d3c23`); it gives
the same resolved AST as `getAst(true)` on every model set where both can run.

Other points:

- The resolver never fetches anything. Pass every model a model imports,
  external models (`from <uri>`) included. The system model
  (`concerto@1.0.0`) and the decorator model (`concerto.decorator@1.0.0`) are
  built in.
- By default it collects every diagnostic, so an editor can show them all.
  `{ failFast: true }` throws a `ResolutionError` at the first one, as
  concerto-core does; its `name` is the concerto-core exception class.
- Diagnostics about a declaration or property carry its `location`, for
  editor markers, when the AST has locations: concerto-cto leaves them out
  unless it is called with `{ skipLocationNodes: false }`.
- `importAliasing` defaults to `true`; pass `false` to reject
  `{Foo as Bar}` imports, as a `ModelManager` without that option does.
- Decorator type references to undeclared types (`@Foo(Missing)`) are left
  unresolved, not reported, because concerto-core loads them too. Unlike
  `getAst(true)`, which throws on them, the resolver still gives the resolved
  AST, so the converter can produce Concertino for these models.

## The Concerto playground: resolver checks on the main thread, the engine in its worker

The editor parses and resolves on every change, on the main thread, and shows
the diagnostics at once. Its Concertino tab is built from the same result.
Full validation and code generation stay in the playground's worker, which now
runs concerto-core on the engine; the worker answers after the engine has
loaded and checked the whole model.

The page:

```javascript
import { Parser } from '@accordproject/concerto-cto';
import { resolveModels } from '@accordproject/concertino/resolve';
import { convertToConcertino } from '@accordproject/concertino';

const worker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });

// Fast checks, on every keystroke (debounced): parse, then resolve.
export function quickCheck(ctoFiles) {
    let asts;
    try {
        // keep source locations, so that diagnostics can place editor markers
        asts = ctoFiles.map((cto, i) => Parser.parse(cto, `model${i}.cto`, { skipLocationNodes: false }));
    } catch (err) {
        // a ParseException, with err.fileLocation for the editor marker
        return { diagnostics: [{ errorClass: err.name, message: err.message, location: err.fileLocation }] };
    }
    const { models, diagnostics } = resolveModels(asts);
    return { diagnostics, concertino: diagnostics.length ? null : convertToConcertino(models) };
}

// Full validation and codegen, in the worker, when the user stops typing.
let next = 0;
export function fullCheck(ctoFiles, format) {
    const id = next++;
    return new Promise((resolve) => {
        const onMessage = ({ data }) => {
            if (data.id === id) {
                worker.removeEventListener('message', onMessage);
                resolve(data);
            }
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({ id, ctoFiles, format });
    });
}
```

The worker (`model.worker.js`), bundled with the engine host as in the
[worker recipe](../../packages/concerto-engine/README.md#browsers-the-worker-recipe):

```javascript
import './engine-host.generated.mjs';
import { init } from '@accordproject/concerto-engine';
import { ModelManager } from '@accordproject/concerto-core';
import { InMemoryWriter } from '@accordproject/concerto-util';
import { CodeGen } from '@accordproject/concerto-codegen';

const ready = init();
ready.catch(() => {});

self.onmessage = async ({ data }) => {
    try {
        await ready;
        const modelManager = new ModelManager({ enableMapType: true });
        data.ctoFiles.forEach((cto, i) => modelManager.addCTOModel(cto, `model${i}.cto`, true));
        modelManager.validateModelFiles(); // every model check, on the engine
        const writer = new InMemoryWriter();
        modelManager.accept(new CodeGen.formats[data.format](), { fileWriter: writer });
        self.postMessage({ id: data.id, ok: true, files: Object.fromEntries(writer.getFilesInMemory()) });
    } catch (err) {
        self.postMessage({ id: data.id, ok: false, error: { name: err.constructor.name, message: err.message } });
    }
};
```

`quickCheck` covers the resolution errors a user makes most often (a missing
import, a misspelt type, a duplicate name) without waiting for the worker.
`fullCheck` is the authority: it reports every model error, with the same
exception classes as the server.

## The template playground: full validation in its rebuild worker, with resolver pre-checks

The template stack (template-engine, markdown-template and cicero-core)
needs a full `ModelManager`, so the rebuild worker keeps concerto-core, now on
the engine, and runs full validation there. The main thread uses the resolver
as a cheap pre-check before it posts a rebuild, so a model with a resolution
error never reaches the worker. The logic editor's model outline reads
Concertino through `./runtime`, without the worker.

The page:

```javascript
import { Parser } from '@accordproject/concerto-cto';
import { resolveModels } from '@accordproject/concertino/resolve';
import { convertToConcertino } from '@accordproject/concertino';
import { load, getDeclarationNames, kindOf, getProperties, getIdentifierFieldName } from '@accordproject/concertino/runtime';

// Before each rebuild: report resolution errors here, and only post a model that resolves.
export function validateBeforeRebuild(ctoFiles) {
    const { models, diagnostics } = resolveModels(ctoFiles.map((cto) => Parser.parse(cto)));
    return diagnostics.length ? { ok: false, diagnostics } : { ok: true, model: load(convertToConcertino(models)) };
}

// The logic editor's outline, from the pre-checked model.
export function describeLogicModel(model) {
    return getDeclarationNames(model).map((fqn) => ({
        name: fqn,
        kind: kindOf(model, fqn), // 'AssetDeclaration', 'TransactionDeclaration', ...
        identifier: getIdentifierFieldName(model, fqn),
        properties: getProperties(model, fqn).map((p) => ({ name: p.name, type: p.type, optional: !!p.isOptional })),
    }));
}

export function rebuild(rebuildWorker, template) {
    const pre = validateBeforeRebuild(template.ctoFiles);
    if (!pre.ok) {
        return pre; // shown in the editor; the worker is not woken
    }
    rebuildWorker.postMessage({ type: 'rebuild', template });
    return pre;
}
```

The rebuild worker loads the model into a `ModelManager` exactly as today,
after `await init()` from `@accordproject/concerto-engine` (see the worker
recipe), and its `addCTOModel` makes every model check. Errors that only full
validation finds come back from the worker as they do now.

## Form UIs: prebuilt Concertino, no CTO in the browser

A form renderer knows its model at build time, so it ships the model as a
Concertino document and needs neither the parser nor the resolver. At run
time it reads the model with `./runtime` and checks the user's data with
`./validate`: about 7 KiB gzip in all.

At build time, in Node:

```javascript
const fs = require('fs');
const { Parser } = require('@accordproject/concerto-cto');
const { resolveModels } = require('@accordproject/concertino/resolve');
const { convertToConcertino } = require('@accordproject/concertino');

const ctoFiles = ['models/base.cto', 'models/order.cto'].map((f) => fs.readFileSync(f, 'utf8'));
const { models } = resolveModels(ctoFiles.map((cto) => Parser.parse(cto)), { failFast: true });
fs.writeFileSync('public/order.concertino.json', JSON.stringify(convertToConcertino(models)));
```

Run full validation in the same build step (load the same files into a
concerto-core `ModelManager`) so that a model that only the engine rejects
fails the build. A `ModelManager` can also give the resolved AST,
`convertToConcertino(modelManager.getAst(true))`, unless the model has
decorator type references to primitives or undeclared types, on which
`getAst(true)` throws.

In the browser:

```javascript
import { load, getProperties, propertyKind, getVocabulary } from '@accordproject/concertino/runtime';
import { check, normalise } from '@accordproject/concertino/validate';

const model = load(await (await fetch('/order.concertino.json')).json());
const ORDER = 'org.example.app@1.0.0.Order';

// The fields to render.
const fields = getProperties(model, ORDER).map((p) => ({
    name: p.name,
    label: getVocabulary(model, ORDER, p.name).label ?? p.name,
    kind: propertyKind(model, p),
    optional: !!p.isOptional,
}));

// On submit: the same verdict and exception class as concerto-core's Serializer.fromJSON.
const result = check(model, formData);
if (!result.ok) {
    showError(result.error.errorClass, result.error.message);
} else {
    send(normalise(model, formData)); // the JSON Serializer.toJSON would write
}
```

`load` reads a document of Concertino format major version 5 and throws a
`ConcertinoVersionError` for any other, so a renderer fails clearly when it is
handed a document from an incompatible release.
