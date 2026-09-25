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

// Proves that concerto-core's browser ESM graph (dist/esm-browser, the same
// artifact browser-bundles.spec.ts exercises) can actually load and run the
// CONCERTO_ENGINE=rust WASM engine in a real browser context, not just build
// without it (accordproject/concerto-rust#70).
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

test.describe('Concerto browser ESM graph with the WASM engine', () => {
    test.skip(!engineBuilt, `concerto-wasm is not built at ${WASM_PKG_DIR}; run concerto-wasm/build.sh in a concerto-rust checkout next to this one`);

    let server: EsmServer;

    test.beforeAll(async () => {
        server = await startEsmServer([
            { prefix: '/concerto-core/', dir: path.join(PACKAGES_ROOT, 'concerto-core/dist/esm-browser') },
            { prefix: '/concerto-util/', dir: path.join(PACKAGES_ROOT, 'concerto-util/dist/esm-browser') },
            { prefix: '/concerto-engine/', dir: WASM_PKG_DIR },
        ]);
    });

    test.afterAll(async () => {
        await server.close();
    });

    test('loads the WASM engine and runs a Rust-backed call through the browser bundle', async ({ page }) => {
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
            // Standing in for that bundler step is exactly what this test
            // exercises: whether the already-loaded WASM module can in fact
            // be handed back to concerto-core's real engine-selection code.
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
});
