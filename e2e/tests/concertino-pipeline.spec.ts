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

// The browser CTO pipeline (decision A1 of accordproject/concerto-rust#420,
// P5-128): concerto-cto's parser, then @accordproject/concertino/resolve,
// then the converter, then ./runtime and ./validate, loaded through the
// packages' browser ESM graphs. No concerto-core and no engine: the page must
// fetch neither.
const PACKAGES_ROOT = path.resolve(__dirname, '../../packages');

const MOUNTS = [
    { prefix: '/concertino/', dir: path.join(PACKAGES_ROOT, 'concertino/dist/esm-browser') },
    { prefix: '/concerto-cto/', dir: path.join(PACKAGES_ROOT, 'concerto-cto/dist/esm-browser') },
    { prefix: '/concerto-util/', dir: path.join(PACKAGES_ROOT, 'concerto-util/dist/esm-browser') },
];

const MODELS = [
    'namespace org.example.base@1.0.0\nparticipant Person identified by email { o String email }',
    'namespace org.example.app@1.0.0\nimport org.example.base@1.0.0.{Person as Party}\n' +
        'concept Order { o String ref o Integer quantity range=[1,] --> Party buyer }',
];

let server: EsmServer;

test.beforeAll(async () => {
    server = await startEsmServer(MOUNTS);
});

test.afterAll(async () => {
    await server.close();
});

test('runs the CTO pipeline in the browser without concerto-core or the engine', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(server.baseUrl);
    await page.addScriptTag({
        type: 'importmap',
        content: JSON.stringify({ imports: { '@accordproject/concerto-util': `${server.baseUrl}/concerto-util/index.mjs` } }),
    });

    const result = await page.evaluate(async ({ base, models }) => {
        const { Parser } = await import(`${base}/concerto-cto/index.mjs`);
        const { resolveModels } = await import(`${base}/concertino/resolve.mjs`);
        const { convertToConcertino } = await import(`${base}/concertino/index.mjs`);
        const { load, getProperties } = await import(`${base}/concertino/runtime.mjs`);
        const { check, normalise } = await import(`${base}/concertino/validate.mjs`);

        const { models: resolved, diagnostics } = resolveModels(models.map((m: string) => Parser.parse(m)));
        const model = load(convertToConcertino(resolved));
        const order = { $class: 'org.example.app@1.0.0.Order', ref: 'A-1', quantity: 2, buyer: 'resource:org.example.base@1.0.0.Person#ann@example.com' };
        const bad = check(model, { ...order, quantity: 0 });
        const broken = resolveModels([Parser.parse('namespace org.example.bad@1.0.0\nconcept A { o Missing m }')]);
        return {
            diagnostics,
            properties: getProperties(model, 'org.example.app@1.0.0.Order').map((p: { name: string }) => p.name),
            normalised: normalise(model, order),
            badOk: bad.ok,
            badClass: bad.ok ? null : bad.error.errorClass,
            brokenDiagnostics: broken.diagnostics.map((d: { code: string; errorClass: string }) => `${d.errorClass} ${d.code}`),
        };
    }, { base: server.baseUrl, models: MODELS });

    expect(result).toEqual({
        diagnostics: [],
        properties: ['ref', 'quantity', 'buyer'],
        normalised: { $class: 'org.example.app@1.0.0.Order', ref: 'A-1', quantity: 2, buyer: 'resource:org.example.base@1.0.0.Person#ann@example.com' },
        badOk: false,
        badClass: 'ValidationException',
        brokenDiagnostics: ['IllegalModelException type-undeclared'],
    });
    expect(requests.filter((url) => /concerto-core|concerto-engine|\.wasm/.test(url))).toEqual([]);
});
