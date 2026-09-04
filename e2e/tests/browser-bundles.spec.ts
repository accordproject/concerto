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

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import { startEsmServer, type EsmServer } from './support/esm-static-server';

// The `browser` export condition (see each package's package.json "exports")
// resolves consumers to dist/esm-browser/index.mjs. That file is not a single
// bundle: it is a module graph that imports sibling `./chunk-*.mjs` files by
// relative path, and (for concerto-core and concerto-cto) imports its
// workspace dependencies as bare specifiers ("@accordproject/concerto-util",
// "@accordproject/concerto-cto") because those packages are external to the
// browser build. These tests exercise exactly that graph, the way a real
// browser consumer resolving through the "browser" condition would load it.
const PACKAGES_ROOT = path.resolve(__dirname, '../../packages');

const MOUNTS = [
    { prefix: '/concerto-core/', dir: path.join(PACKAGES_ROOT, 'concerto-core/dist/esm-browser') },
    { prefix: '/concerto-cto/', dir: path.join(PACKAGES_ROOT, 'concerto-cto/dist/esm-browser') },
    { prefix: '/concerto-util/', dir: path.join(PACKAGES_ROOT, 'concerto-util/dist/esm-browser') },
];

let server: EsmServer;

test.beforeAll(async () => {
    server = await startEsmServer(MOUNTS);
});

test.afterAll(async () => {
    await server.close();
});

/**
 * Installs an import map so that the bare workspace specifiers the browser
 * ESM graph imports ("@accordproject/concerto-util", "@accordproject/concerto-cto")
 * resolve to the sibling packages' served browser ESM graphs, then navigates
 * to a blank page ready to `import()` from `server`.
 *
 * This is the crux of testing the browser ESM graph in isolation: outside of
 * a bundler, nothing else tells the browser how to resolve those bare
 * specifiers, so an import map standing in for "the bundler's resolution
 * step" is required for concerto-core and concerto-cto to load at all.
 *
 * @param {Page} page - the Playwright page to prepare.
 * @returns {Promise<void>} resolves once the import map is installed.
 */
async function withWorkspaceImportMap(page: Page): Promise<void> {
    // Navigate to a same-origin page served by our own server rather than
    // about:blank: Chromium's Private Network Access check blocks a page
    // with an opaque origin from fetching loopback addresses, which is
    // exactly what dynamically importing our served modules requires.
    await page.goto(server.baseUrl);
    await page.addScriptTag({
        type: 'importmap',
        content: JSON.stringify({
            imports: {
                '@accordproject/concerto-util': `${server.baseUrl}/concerto-util/index.mjs`,
                '@accordproject/concerto-cto': `${server.baseUrl}/concerto-cto/index.mjs`,
            },
        }),
    });
}

test.describe('Concerto browser ESM graph', () => {
    test('parses a CTO model via the concerto-cto browser ESM graph', async ({ page }) => {
        await withWorkspaceImportMap(page);

        const parsed = await page.evaluate(async (moduleUrl) => {
            const { Parser } = await import(moduleUrl);
            const ast = Parser.parse('namespace org.acme.test@1.0.0\nconcept Person { o String name }');
            return {
                namespace: ast.namespace,
                declarationCount: ast.declarations.length,
                declarationName: ast.declarations[0].name,
            };
        }, `${server.baseUrl}/concerto-cto/index.mjs`);

        expect(parsed).toEqual({
            namespace: 'org.acme.test@1.0.0',
            declarationCount: 1,
            declarationName: 'Person',
        });
    });

    test('builds a ModelManager and round-trips a resource via the concerto-core browser ESM graph', async ({ page }) => {
        await withWorkspaceImportMap(page);

        const result = await page.evaluate(async (moduleUrl) => {
            const { ModelManager, Factory, Serializer } = await import(moduleUrl);

            const modelManager = new ModelManager();
            modelManager.addCTOModel(
                'namespace org.acme.browser@1.0.0\nasset Vehicle identified by vin { o String vin o String colour }',
                'vehicle.cto',
                true
            );

            const vehicleType = modelManager.getType('org.acme.browser@1.0.0.Vehicle');

            const factory = new Factory(modelManager);
            const resource = factory.newResource('org.acme.browser@1.0.0', 'Vehicle', 'VIN-123');
            resource.colour = 'red';

            const serializer = new Serializer(factory, modelManager);
            const json = serializer.toJSON(resource);
            const revived = serializer.fromJSON(json);

            return {
                fqn: vehicleType.getFullyQualifiedName(),
                identifierFieldName: vehicleType.getIdentifierFieldName(),
                json,
                revivedVin: revived.vin,
                revivedColour: revived.colour,
            };
        }, `${server.baseUrl}/concerto-core/index.mjs`);

        expect(result).toEqual({
            fqn: 'org.acme.browser@1.0.0.Vehicle',
            identifierFieldName: 'vin',
            json: {
                $class: 'org.acme.browser@1.0.0.Vehicle',
                $identifier: 'VIN-123',
                vin: 'VIN-123',
                colour: 'red',
            },
            revivedVin: 'VIN-123',
            revivedColour: 'red',
        });
    });

    // This is the highest-value test in the file. dayjs plugin registration
    // (dayjs.extend(...) in dayjs-setup.ts) is the one genuine module-level
    // side effect in the dependency tree, and therefore the piece most at
    // risk of being dropped by tree-shaking when going from a UMD bundle
    // (where the whole thing is always evaluated) to an ESM graph (where a
    // bundler is free to prune anything it decides is unused). If either the
    // `utc` or `quarterOfYear` dayjs plugin failed to register, the calls
    // below would throw or return wrong values instead of round-tripping.
    test('keeps dayjs plugins registered through the concerto-core browser ESM graph', async ({ page }) => {
        await withWorkspaceImportMap(page);

        const result = await page.evaluate(async ({ coreUrl, dayjsSetupUrl }) => {
            const { DateTimeUtil } = await import(coreUrl);
            // dayjs-setup.mjs is the module that calls dayjs.extend(utc) and
            // dayjs.extend(quarterOfYear); import it directly to assert the
            // registration itself survived, not just code that happens to
            // depend on it.
            const { default: dayjs } = await import(dayjsSetupUrl);

            // Exercises the `utc` plugin end-to-end through the public
            // DateTimeUtil API, mirroring how ModelManager/Resource use it.
            const currentTime = DateTimeUtil.setCurrentTime('2023-03-17T12:30:00.000Z', 0);

            // Exercises the `quarterOfYear` plugin directly: it is registered
            // but never exercised by any other code path in concerto-core,
            // so this is the only thing that would catch a bundler dropping it.
            const quarter = dayjs.utc('2023-03-17T12:30:00.000Z').quarter();

            return {
                iso: currentTime.currentTime.toISOString(),
                offset: currentTime.utcOffset,
                quarter,
            };
        }, {
            coreUrl: `${server.baseUrl}/concerto-core/index.mjs`,
            dayjsSetupUrl: `${server.baseUrl}/concerto-core/dayjs-setup.mjs`,
        });

        expect(result).toEqual({
            iso: '2023-03-17T12:30:00.000Z',
            offset: 0,
            quarter: 1,
        });
    });
});
