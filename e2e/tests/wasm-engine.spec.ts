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
import * as path from 'path';
import { startEsmServer, type EsmServer } from './support/esm-static-server';
import { installEngineBundler, WASM_PKG_DIR } from './support/engine-bundler';

// Runs concerto-core, backed by the real WASM engine, through the PUBLIC
// browser ESM entry point dist/esm-browser/index.mjs (the same entry point
// browser-bundles.spec.ts exercises; accordproject/concerto-rust#70,
// #115/P4-11a). The test calls public API
// (ModelUtil, ModelManager, ScalarDeclaration) whose views reach the engine
// through src/engineloader.ts's `loadEngine` -> `module.require(specifier)`.
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
// The engine's browser loader instantiates nothing when it is imported:
// the host calls its explicit, idempotent `await init()`, which fetches the
// raw .wasm, before the first engine-backed call (BC-32). The stand-in does
// that after loading concerto-core's engine modules; this test checks that
// `init()` is idempotent and that the .wasm was fetched once.
//
// The engine is served from the concerto-rust checkout next to this one
// (packages/concerto-engine/README.md), where CI provides it
// (.github/actions/concerto-engine). concerto-core loads the engine when it
// is imported (P5-02), so there is no longer a skip for a checkout without it.
const PACKAGES_ROOT = path.resolve(__dirname, '../../packages');

test.describe('Concerto rust mode with the WASM engine in a browser (bundler stand-in)', () => {
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

        // ---- BUNDLER STAND-IN ----------------------------------------------
        // support/engine-bundler.ts does what a consumer's bundler does when
        // it bundles concerto-core for the browser. It is NOT something
        // dist/esm-browser/index.mjs does by itself: the browser ESM graph
        // cannot load the engine unaided (PORTING.md 1.5). A bundler resolves
        // the synchronous `require` calls in the engine code at build time,
        // so at run time each one returns an already-loaded module; the
        // stand-in loads those modules up front with `import()` and answers
        // the synchronous calls from that registry: src/engineloader.ts's
        // `module.require('./engine' | './engine/<subpath>')` (the one loader
        // every public module reaches the engine through),
        // src/engine/rust.ts's `require('@accordproject/concerto-engine')`,
        // and the engine's own `require`s of public modules, which resolve to
        // the SAME module instances the public graph uses.
        await installEngineBundler(page, server.baseUrl);
        // ---- end of bundler stand-in ---------------------------------------

        const result = await page.evaluate(async (baseUrl) => {
            // The thing under test: the PUBLIC browser entry point only. No
            // engine function is called directly; every Rust-backed result
            // below comes from public API that reached the engine through
            // src/engineloader.ts. Its module-level `loadEngine('./engine')`
            // already ran while the bundler stand-in loaded the engine (the
            // engine's modules import public modules that share the loader's
            // chunk), so that request is part of the discarded setup.
            // Building the model goes through ModelManager, ModelFile and
            // ScalarDeclaration's snapshot path, which builds its
            // NumberValidator through the engine views. The loader requires
            // './engine/views' on the first `engineViews()` call of the public
            // graph (introspect/field.ts's top level, or this path).
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

            // BC-32: the explicit init() is idempotent, and the .wasm was
            // fetched once, by the stand-in's call.
            const engine = (globalThis as any).__concertoBundler.bundled.get('@accordproject/concerto-engine');
            const initIdempotent = engine.init() === engine.init();
            await engine.init();
            const wasmFetches = performance.getEntriesByType('resource')
                .filter((entry) => entry.name.endsWith('/concerto_wasm.wasm')).length;
            // An engine error reaches the page through the error factory
            // concerto-core gave setHost before init() ran.
            let engineError: string | undefined;
            try {
                modelManager.addCTOModel('namespace bad@1.0.0\nconcept A extends Missing {}\n', 'bad.cto');
            } catch (err) {
                engineError = (err as Error).constructor.name;
            }

            return {
                // Which engine specifiers engineloader.ts asked the bundler
                // stand-in for: proof the results below came through it.
                viewEngineRequests: [...(globalThis as any).__concertoBundler.requested as Set<string>]
                    .filter((s) => /^\.\.?\/engine/.test(s)).sort(),
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
                // P5-110 (accordproject/concerto-rust#477): the engine's
                // `#[wasm_bindgen(start)]` seeds the hasher of untrusted keys
                // from crypto.getRandomValues when the module is
                // instantiated. Read from the SAME engine module instance
                // src/engine/rust.ts got from the bundler stand-in, taken
                // from its registry rather than through `require` so the
                // read is not counted in viewEngineRequests.
                hashSeed: engine.hashSeed(),
                initIdempotent,
                wasmFetches,
                engineError,
            };
        }, server.baseUrl);

        expect(pageErrors).toEqual([]);
        expect(result).toEqual({
            // engineloader.ts's lazy require of engine/views.ts, the only
            // engine request the public graph makes after setup. Its
            // specifiers are all './engine...', relative to src/: no public
            // module requires '../engine' any more.
            viewEngineRequests: ['./engine/views'],
            capitalized: 'Vehicle',
            validIdentifier: true,
            invalidIdentifier: false,
            scalarType: 'Integer',
            lowerBound: 0,
            upperBound: null,
            hashSeed: { source: 'crypto', probe: expect.stringMatching(/^[0-9a-f]{16}$/) },
            initIdempotent: true,
            wasmFetches: 1,
            engineError: 'IllegalModelException',
        });
    });
});
