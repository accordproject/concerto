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

import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// The Rust engine is the only path since P5-02, and concerto-core loads it
// when it is imported (accordproject/concerto-rust#259). The browser ESM
// graph (dist/esm-browser) does not load the engine by itself: the views load
// it with a synchronous `module.require`, which a browser cannot answer for an
// ES module, so a consumer needs a bundler (or a host that supplies a
// synchronous `require`; PORTING.md 1.5, scripts/browser-module-shim.js).
// Every test that imports concerto-core's browser graph therefore needs this
// stand-in for the bundler. It does the bundler's part and nothing more.

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** concerto-wasm's built package, in a concerto-rust checkout next to this one. */
export const WASM_PKG_DIR = path.resolve(REPO_ROOT, '../concerto-rust/concerto-wasm/pkg');

/** concerto-core's browser ESM graph. */
export const CORE_ESM_BROWSER_DIR = path.join(REPO_ROOT, 'packages/concerto-core/dist/esm-browser');

const ENGINE_DIR = path.join(CORE_ESM_BROWSER_DIR, 'engine');

/**
 * The public modules (relative to dist/esm-browser/engine/) the engine loads
 * back with its own `require` calls, read from the build (esbuild writes each
 * as `__require("<specifier>")`). A bundler resolves them to the same module
 * instances the public graph uses, so the engine shares class identity with
 * it; the stand-in does the same.
 *
 * @return {string[]} the specifiers, sorted
 */
export function engineRequires(): string[] {
    const specifiers = new Set<string>();
    for (const file of fs.readdirSync(ENGINE_DIR)) {
        if (!file.endsWith('.mjs')) {
            continue;
        }
        const source = fs.readFileSync(path.join(ENGINE_DIR, file), 'utf8');
        for (const match of source.matchAll(/__require\("([^"]+)"\)/g)) {
            specifiers.add(match[1]);
        }
    }
    return [...specifiers].sort();
}

/**
 * The engine's own entry modules (dist/esm-browser/engine/<name>.mjs, not the
 * shared chunks), `index` and `views` first: every public view's module-level
 * `loadEngine('../engine')` needs `index` in the registry already.
 *
 * @return {string[]} the module names, without extension
 */
export function engineModules(): string[] {
    const names = fs.readdirSync(ENGINE_DIR)
        .filter((file) => file.endsWith('.mjs') && !file.startsWith('chunk-'))
        .map((file) => file.slice(0, -'.mjs'.length));
    const first = ['index', 'views'];
    return [...first, ...names.filter((name) => !first.includes(name)).sort()];
}

/**
 * Installs the bundler stand-in on `page`, which must already be on a page of
 * the server that serves concerto-core's browser graph under
 * `/concerto-core/` and the built engine package under `/concerto-engine/`.
 * Call it before anything imports a concerto-core module.
 *
 * It sets `globalThis.module` / `globalThis.require` to a synchronous
 * `require` backed by a registry of modules loaded up front with `import()`:
 *   - `@accordproject/concerto-engine` (src/engine/rust.ts);
 *   - `./engine`, `../engine` and `../engine/<subpath>` (the views'
 *     `loadEngine`, read through scripts/browser-module-shim.js);
 *   - the public modules the engine requires back (see engineRequires).
 *
 * Every specifier asked for while this function loads the engine side of the
 * registry (the wasm engine and its own entry modules) is discarded before
 * the public modules the engine requires back are loaded: those public
 * modules (see engineRequires) are the SAME instances the public graph a test
 * imports afterwards will resolve to, so their module-level `loadEngine`
 * calls are genuine public-graph requests, not setup noise, and happen here
 * because ESM only evaluates a module once. Clearing after them, instead,
 * would discard that signal permanently: a later import of the same
 * already-cached module never re-runs its top-level code, so a request made
 * only during this pre-load could never be observed again. What remains in
 * `globalThis.__concertoBundler.requested` after this function returns is
 * therefore everything the public graph asked for, whether that happened
 * while resolving these shared modules here or later while a test imports
 * and exercises the public entry point.
 * `globalThis.__concertoBundler.bundled` is the registry itself, keyed as
 * above (`@accordproject/concerto-engine`, `engine/<name>`, specifiers).
 *
 * @param {Page} page - the Playwright page
 * @param {string} baseUrl - the server's base URL
 * @return {Promise<void>} resolves once the registry is loaded
 */
export async function installEngineBundler(page: Page, baseUrl: string): Promise<void> {
    await page.evaluate(async ({ baseUrl, modules, requires }) => {
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
        // Must be in place before any built concerto-core module is
        // imported: browser-module-shim.js reads globalThis.module once, the
        // first time its build imports it.
        (globalThis as any).module = { require: bundlerRequire };
        (globalThis as any).require = bundlerRequire;
        // `bundled` lets a test read a registry entry (e.g. the engine
        // module, for hashSeed()) without going through `require`, so the
        // read is not recorded in `requested`.
        (globalThis as any).__concertoBundler = { requested, bundled };

        // The engine bytes are inlined and instantiated synchronously by this
        // module at import time (concerto-wasm/scripts/inline.mjs).
        bundled.set('@accordproject/concerto-engine', await import(`${baseUrl}/concerto-engine/concerto-engine.mjs`));
        for (const name of modules) {
            bundled.set(`engine/${name}`, await import(`${baseUrl}/concerto-core/engine/${name}.mjs`));
        }
        // Only the engine-side setup above is noise: clear it before loading
        // the public modules the engine requires back below, so their
        // module-level `loadEngine` calls (the same instances the public
        // graph reuses, e.g. modelmanager.mjs pulling in basemodelmanager,
        // modelutil and modelfile) are recorded rather than discarded.
        requested.clear();
        for (const specifier of requires) {
            bundled.set(specifier, await import(`${baseUrl}/concerto-core/engine/${specifier}`));
        }
    }, { baseUrl, modules: engineModules(), requires: engineRequires() });
}
