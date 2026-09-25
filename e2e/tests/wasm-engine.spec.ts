/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { startEsmServer, type EsmServer } from './support/esm-static-server';

// Runs concerto-core in CONCERTO_ENGINE=rust mode, backed by the real WASM
// engine, through the PUBLIC browser ESM entry point dist/esm-browser/index.mjs
// (the same entry point browser-bundles.spec.ts exercises in ts mode;
// accordproject/concerto-rust#70, #115/P4-11a). The test calls public API
// (ModelUtil, ModelManager, ScalarDeclaration) whose views reach the engine
// through their `loadEngine` -> `module.require(specifier)`.
//
// Browser rust mode needs a bundler (or a host that supplies a synchronous
// `require`): the views load the engine synchronously, and a browser cannot
// load an ES module synchronously, so the browser ESM graph does NOT load
// dist/esm-browser/engine/*.mjs by itself (PORTING.md 1.5; maintainer
// decision on accordproject/concerto-rust#115). In this test the harness
// plays the bundler's part and nothing more: it supplies the synchronous
// module loader a bundler would provide, preloading the modules that loader
// must be able to return. Only Node ESM (dist/esm/index.mjs) resolves the
// engine without outside help.
//
// packages/concerto-engine (PORTING.md, decision D9) is a local-only link to
// the WASM package concerto-rust's concerto-wasm/build.sh writes into a
// concerto-rust checkout next to this one; it is not part of this repo and is
// not built by `npm run build` here. Skip when that checkout has not built
// concerto-wasm, exactly like the Node-side loader does when the package is
// absent (packages/concerto-engine/README.md) — a plain checkout of this repo
// still builds and tests without concerto-rust.
const REPO_ROOT = path.resolve(__dirname, '../..');
const WASM_PKG_DIR = path.resolve(REPO_ROOT, '../concerto-rust/concerto-wasm/pkg');
const ENGINE_LOADER = path.join(WASM_PKG_DIR, 'concerto-engine.mjs');
const PACKAGES_ROOT = path.resolve(__dirname, '../../packages');

const engineBuilt = fs.existsSync(ENGINE_LOADER);

test.describe('Concerto rust mode with the WASM engine in a browser (bundler stand-in)', () => {
    test.skip(!engineBuilt, `concerto-wasm is not built at ${WASM_PKG_DIR}; run concerto-wasm/build.sh in a concerto-rust checkout next to this one`);

    let server: EsmServer;

    test.beforeAll(async () => {
        server = await startEsmServer([
            { prefix: '/concerto-core/', dir: path.join(PACKAGES_ROOT, 'concerto-core/dist/esm-browser') },
            { prefix: '/concerto-cto/', dir: path.join(PACKAGES_ROOT, 'concerto-cto/dist/esm-browser') },
            { prefix: '/concerto-util/', dir: path.join(PACKAGES_ROOT, 'concerto-util/dist/esm-browser') },
            { prefix: '/concerto-engine/', dir: WASM_PKG_DIR },
        ]);
    });

    test.afterAll(async () => {
        await server.close();
    });

    test('runs Rust-backed public API through dist/esm-browser/index.mjs, with the test supplying the bundler\'s synchronous require', async ({ page }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(String(e)));

        // Same-origin navigation first: see withWorkspaceImportMap in
        // browser-bundles.spec.ts for why (Private Network Access).
        await page.goto(server.baseUrl);
        await page.addScriptTag({
            type: 'importmap',
            content: JSON.stringify({
                imports: {
                    '@accordproject/concerto-util': `${server.baseUrl}/concerto-util/index.mjs`,
                    // ModelManager.addCTOModel needs the CTO parser, external
                    // to concerto-core's browser bundle the same way
                    // concerto-util is (browser-bundles.spec.ts).
                    '@accordproject/concerto-cto': `${server.baseUrl}/concerto-cto/index.mjs`,
                },
            }),
        });

        const result = await page.evaluate(async (baseUrl) => {
            // ---- BUNDLER STAND-IN ------------------------------------------
            // Everything in this block does what a consumer's bundler does
            // when it bundles concerto-core for the browser in rust mode. It
            // is NOT something dist/esm-browser/index.mjs does by itself: the
            // browser ESM graph cannot load the engine unaided (PORTING.md
            // 1.5). A bundler resolves the synchronous `require` calls in the
            // rust-mode code at build time, so at run time each one returns
            // an already-loaded module. A browser has no synchronous module
            // loading, so this stand-in loads those modules up front with
            // `import()` and then answers the synchronous calls from that
            // registry:
            //   - the views' `module.require('./engine' | '../engine' |
            //     '../engine/views')` (modelutil.ts, introspect/*.ts;
            //     read through scripts/browser-module-shim.js, which defers
            //     to globalThis.module);
            //   - src/engine/rust.ts's `require('@accordproject/concerto-engine')`;
            //   - src/engine/views.ts's `require('../introspect/numbervalidator')`
            //     and `require('../introspect/stringvalidator')` (built as
            //     `__require("../introspect/<name>.mjs")`), which a bundler
            //     resolves to the SAME module instance the public graph
            //     uses, so the engine shares class identity with the public
            //     modules. The stand-in does the same, returning the public
            //     build's own modules.
            //
            // globalThis.module must be in place before any built
            // concerto-core module is imported: browser-module-shim.js reads
            // globalThis.module once, the first time its build imports it,
            // and caches that value for the page's lifetime.
            const bundled = new Map<string, unknown>();
            const requested = new Set<string>();
            const bundlerRequire = (specifier: string) => {
                requested.add(specifier);
                const engine = /^\.\.?\/engine(\/.*)?$/.exec(specifier);
                const key = engine ? `engine/${engine[1] ? engine[1].slice(1) : 'index'}` : specifier;
                if (!bundled.has(key)) {
                    throw new Error(`Bundler stand-in: "${specifier}" is not in the bundle`);
                }
                return bundled.get(key);
            };
            (globalThis as any).process = { env: { CONCERTO_ENGINE: 'rust' } };
            (globalThis as any).module = { require: bundlerRequire };
            (globalThis as any).require = bundlerRequire;

            // The engine bytes are inlined and instantiated synchronously by
            // this module at import time (concerto-wasm/scripts/inline.mjs) —
            // no separate .wasm fetch is needed here.
            bundled.set('@accordproject/concerto-engine', await import(`${baseUrl}/concerto-engine/concerto-engine.mjs`));
            // Engine modules before the two introspect modules: importing
            // introspect/*.mjs runs the views' module-level
            // `loadEngine('../engine')`, which needs the engine in the
            // registry already.
            for (const subpath of ['index', 'views']) {
                bundled.set(`engine/${subpath}`, await import(`${baseUrl}/concerto-core/engine/${subpath}.mjs`));
            }
            bundled.set('../introspect/numbervalidator.mjs', await import(`${baseUrl}/concerto-core/introspect/numbervalidator.mjs`));
            bundled.set('../introspect/stringvalidator.mjs', await import(`${baseUrl}/concerto-core/introspect/stringvalidator.mjs`));
            // Only what the public graph asks for from here on counts.
            requested.clear();
            // ---- end of bundler stand-in -----------------------------------

            // The thing under test: the PUBLIC browser entry point only. No
            // engine function is called directly; every Rust-backed result
            // below comes from public API whose view went through
            // loadEngine. Importing the entry runs modelutil.ts's './engine'
            // and the other views' module-level '../engine' (introspect/
            // scalardeclaration.ts and others). Validating a model with a
            // scalar range goes through ModelManager, ModelFile and
            // ScalarDeclaration's '../engine/views' snapshot path, which
            // builds its NumberValidator through the engine.
            const { ModelUtil, ModelManager } = await import(`${baseUrl}/concerto-core/index.mjs`);

            const modelManager = new ModelManager();
            modelManager.addCTOModel(
                'namespace test@1.0.0\n' +
                'scalar PositiveInteger extends Integer range=[0,]\n' +
                'concept Thing identified by id {\n' +
                '  o String id\n' +
                '  o PositiveInteger n\n' +
                '}\n',
                'test.cto'
            );
            const scalarDeclaration = modelManager.getType('test@1.0.0.PositiveInteger');
            const validator = scalarDeclaration.getValidator();

            return {
                // Which engine specifiers the public views' loadEngine asked
                // the bundler stand-in for: proof the results below came
                // through the views' rust branch, not the ts fallback.
                viewEngineRequests: [...requested].filter((s) => /^\.\.?\/engine/.test(s)).sort(),
                capitalized: ModelUtil.capitalizeFirstLetter('vehicle'),
                validIdentifier: ModelUtil.isValidIdentifier('Vehicle'),
                invalidIdentifier: ModelUtil.isValidIdentifier('1Vehicle'),
                scalarType: scalarDeclaration.getType(),
                // Not the validator's constructor name: esbuild's ESM output
                // renames a top-level class when its name collides with
                // another one bundled elsewhere in the graph, so the rebuilt
                // NumberValidator's class identity is checked by what it
                // does, not by its (possibly renamed) constructor.name.
                lowerBound: validator?.getLowerBound?.(),
                upperBound: validator?.getUpperBound?.(),
            };
        }, server.baseUrl);

        expect(pageErrors).toEqual([]);
        expect(result).toEqual({
            viewEngineRequests: ['../engine', '../engine/views', './engine'],
            capitalized: 'Vehicle',
            validIdentifier: true,
            invalidIdentifier: false,
            scalarType: 'Integer',
            lowerBound: 0,
            upperBound: null,
        });
    });
});
