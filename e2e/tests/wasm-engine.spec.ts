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

// Proves that concerto-core's built engine module, dist/esm-browser/engine/
// index.mjs imported directly, can load and run the CONCERTO_ENGINE=rust WASM
// engine in a real browser context (accordproject/concerto-rust#70).
//
// A second test below proves the follow-up (P4-11a, accordproject/concerto-rust#115):
// the public browser ESM graph (dist/esm-browser/index.mjs, the same entry
// point browser-bundles.spec.ts exercises in ts mode) also loads and uses the
// engine, through the views' `module.require(specifier)` and
// scripts/browser-module-shim.js — not by importing engine/index.mjs directly.
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

test.describe('Concerto built engine module with the WASM engine', () => {
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

    test('loads the WASM engine and runs a Rust-backed call through dist/esm-browser/engine/index.mjs', async ({ page }) => {
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
                },
            }),
        });

        const result = await page.evaluate(async (baseUrl) => {
            // The engine bytes are inlined and instantiated synchronously by
            // this module at import time (concerto-wasm/scripts/inline.mjs) —
            // no separate .wasm fetch is needed here.
            const engineModule = await import(`${baseUrl}/concerto-engine/concerto-engine.mjs`);

            // src/engine/rust.ts resolves the engine with a plain `require`,
            // which a Node consumer's `require`/createRequire satisfies; in a
            // browser it is a bundler's job to make `require` resolve that
            // specifier (an import map cannot, since it is not an import).
            // This test stands in for that bundler step, then imports the
            // built engine module directly (not through the public index.mjs)
            // to check that the already-loaded WASM module can be handed back
            // to concerto-core's real engine-selection code.
            (globalThis as any).process = { env: { CONCERTO_ENGINE: 'rust' } };
            (globalThis as any).require = (name: string) => {
                if (name === '@accordproject/concerto-engine') {
                    return engineModule;
                }
                throw new Error(`Dynamic require of "${name}" is not supported`);
            };

            const { rust } = await import(`${baseUrl}/concerto-core/engine/index.mjs`);
            return {
                hasRust: !!rust,
                capitalized: rust.modelUtilCapitalizeFirstLetter('vehicle'),
                validIdentifier: rust.modelUtilIsValidIdentifier('Vehicle'),
                invalidIdentifier: rust.modelUtilIsValidIdentifier('1Vehicle'),
            };
        }, server.baseUrl);

        expect(pageErrors).toEqual([]);
        expect(result).toEqual({
            hasRust: true,
            capitalized: 'Vehicle',
            validIdentifier: true,
            invalidIdentifier: false,
        });
    });

    test('loads the WASM engine and runs a Rust-backed call through the public dist/esm-browser/index.mjs entry point', async ({ page }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(String(e)));

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
            // Stand in for what src/engine/rust.ts's bare
            // `require('@accordproject/concerto-engine')` needs, exactly as
            // the first test does — and for src/engine/views.ts's own bare
            // `require('../introspect/numbervalidator')` (built as
            // `__require("../introspect/numbervalidator.mjs")`), the engine's
            // reach back into the *public* graph so the snapshot it rebuilds
            // is a real NumberValidator/StringValidator instance, sharing
            // class identity with the rest of the public modules rather than
            // a copy private to the engine build.
            const engineModule = await import(`${baseUrl}/concerto-engine/concerto-engine.mjs`);
            const crossBoundaryModules = new Map<string, unknown>([
                ['../introspect/numbervalidator.mjs', await import(`${baseUrl}/concerto-core/introspect/numbervalidator.mjs`)],
                ['../introspect/stringvalidator.mjs', await import(`${baseUrl}/concerto-core/introspect/stringvalidator.mjs`)],
            ]);
            (globalThis as any).process = { env: { CONCERTO_ENGINE: 'rust' } };
            (globalThis as any).require = (name: string) => {
                if (name === '@accordproject/concerto-engine') {
                    return engineModule;
                }
                if (crossBoundaryModules.has(name)) {
                    return crossBoundaryModules.get(name);
                }
                throw new Error(`Dynamic require of "${name}" is not supported`);
            };

            // modelutil.ts, introspect/numbervalidator.ts and
            // introspect/scalardeclaration.ts call module.require with
            // './engine', '../engine' and '../engine/views' respectively —
            // the specifiers scripts/build-esm.js's own module.require
            // resolves in a real deployment. This stub stands in for a
            // consumer's bundler (browser-module-shim.js's contract), but it
            // must still resolve every subpath the same way the built
            // package actually lays the engine out —
            // dist/esm-browser/engine/<subpath>.mjs, fetched from
            // concerto-core's own served directory below with a genuine
            // dynamic `import()` — rather than handing back a copy of
            // engine/index.mjs the test already imported some other way.
            // `module.require` is synchronous (CommonJS), so every subpath
            // is fetched up front and only looked up, never imported, inside
            // the stub itself.
            // globalThis.module has to be in place before ANY built module —
            // including the engine's own — is imported: browser-module-shim.js
            // is injected into every concerto-core browser build (the public
            // one and the engine's own internal one), reads whatever
            // globalThis.module holds exactly once, the first time anything
            // in that build imports it, and caches that reading (a plain
            // esbuild lazy-init, not a live re-check) for the page's whole
            // lifetime. Setting it up first, with the specifier-driven
            // resolution below already wired in, means every subsequent
            // import — the preload just below, and the public entry point
            // after it — reads the real one.
            const engineModules = new Map<string, unknown>();
            (globalThis as any).module = {
                require(specifier: string) {
                    const m = /^\.\.?\/engine(\/.*)?$/.exec(specifier);
                    if (!m) {
                        throw new Error(`Dynamic module.require of "${specifier}" is not supported`);
                    }
                    const subpath = m[1] ? m[1].slice(1) : 'index';
                    if (!engineModules.has(subpath)) {
                        throw new Error(`Engine module "${subpath}" was not preloaded`);
                    }
                    return engineModules.get(subpath);
                },
            };
            const engineSubpaths = ['index', 'views'];
            for (const subpath of engineSubpaths) {
                engineModules.set(subpath, await import(`${baseUrl}/concerto-core/engine/${subpath}.mjs`));
            }

            // Now go through the *public* entry point only, never
            // engine/index.mjs directly: ModelUtil exercises the module-level
            // rust binding ('./engine'), and validating a real model with a
            // scalar range exercises ModelManager, ModelFile and
            // ScalarDeclaration's '../engine/views' snapshot path together
            // with numbervalidator.ts's '../engine'.
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
                capitalized: ModelUtil.capitalizeFirstLetter('vehicle'),
                validIdentifier: ModelUtil.isValidIdentifier('Vehicle'),
                invalidIdentifier: ModelUtil.isValidIdentifier('1Vehicle'),
                scalarType: scalarDeclaration.getType(),
                // Not the validator's constructor name: esbuild's ESM output
                // renames a top-level class when its name collides with
                // another one bundled elsewhere in the graph, so the rebuilt
                // NumberValidator's own class identity is checked by what it
                // does, not by its (possibly renamed) constructor.name.
                lowerBound: validator?.getLowerBound?.(),
                upperBound: validator?.getUpperBound?.(),
            };
        }, server.baseUrl);

        expect(pageErrors).toEqual([]);
        expect(result).toEqual({
            capitalized: 'Vehicle',
            validIdentifier: true,
            invalidIdentifier: false,
            scalarType: 'Integer',
            lowerBound: 0,
            upperBound: null,
        });
    });
});
