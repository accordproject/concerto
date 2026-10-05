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
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { startEsmServer, type EsmServer } from './support/esm-static-server';

// BC-32's worker recipe (packages/concerto-engine/README.md): the example in
// packages/concerto-engine/examples/worker, built with its own build script
// (esbuild, a stock bundler), served as a consumer would serve it, and run in
// Chromium. concerto-core and the engine live in a module Worker, which calls
// the engine's explicit `await init()`; the page only posts plain data.
const EXAMPLE_BUILD = path.resolve(__dirname, '../../packages/concerto-engine/examples/worker/build.mjs');

const MODEL = `namespace org.example@1.0.0
concept Address {
  o String street
  o Integer number range=[1,]
}
`;

test.describe('the worker recipe: concerto-core and the engine in a module Worker', () => {
    let server: EsmServer;
    let outDir: string;

    test.beforeAll(async () => {
        outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'concerto-engine-worker-'));
        const { build } = await import(pathToFileURL(EXAMPLE_BUILD).href);
        await build({ outDir });
        server = await startEsmServer([{ prefix: '/app/', dir: outDir }]);
    });

    test.afterAll(async () => {
        await server?.close();
        if (outDir) {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });

    test('validates in the worker after init(), and the page never loads the engine', async ({ page }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(String(e)));
        const consoleErrors: string[] = [];
        page.on('console', (m) => {
            if (m.type() === 'error' || m.type() === 'warning') {
                consoleErrors.push(m.text());
            }
        });
        // Requests made by the page and by its worker.
        const wasmRequests: string[] = [];
        page.context().on('request', (request) => {
            if (request.url().endsWith('.wasm')) {
                wasmRequests.push(request.url());
            }
        });

        await page.goto(`${server.baseUrl}/app/index.html`);
        // The demo page's own two results.
        await expect(page.locator('#out')).toContainText('"ok": false', { timeout: 30000 });

        const result = await page.evaluate(async (model) => {
            type Answer = { id: number, ok: boolean, json?: unknown, error?: { name: string, message: string } };
            type Validate = (model: string, instance: object) => Promise<Answer>;
            const { validate } = (globalThis as unknown as { concertoWorker: { validate: Validate } }).concertoWorker;
            const valid = await validate(model, { $class: 'org.example@1.0.0.Address', street: 'High Street', number: 7 });
            const invalid = await validate(model, { $class: 'org.example@1.0.0.Address', street: 'High Street', number: 0 });
            const badModel = await validate('namespace bad@1.0.0\nconcept A extends Missing {}\n', { $class: 'bad@1.0.0.A' });
            return {
                valid,
                invalid: { ok: invalid.ok, name: invalid.error?.name },
                badModel: { ok: badModel.ok, name: badModel.error?.name },
                // The page itself: no engine, no WebAssembly compiled here.
                pageWasmFetches: performance.getEntriesByType('resource')
                    .filter((entry) => entry.name.endsWith('.wasm')).length,
                pageHasEngineHost: 'module' in globalThis,
            };
        }, MODEL);

        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
        expect(result.valid).toEqual({
            id: expect.any(Number),
            ok: true,
            json: { $class: 'org.example@1.0.0.Address', street: 'High Street', number: 7 },
        });
        // The same exception classes as in Node.
        expect(result.invalid).toEqual({ ok: false, name: 'ValidationException' });
        expect(result.badModel).toEqual({ ok: false, name: 'IllegalModelException' });
        expect(result.pageWasmFetches).toBe(0);
        expect(result.pageHasEngineHost).toBe(false);
        // init() fetched the .wasm once, in the worker, for every message.
        expect(wasmRequests).toEqual([`${server.baseUrl}/app/concerto_wasm.wasm`]);
    });
});
