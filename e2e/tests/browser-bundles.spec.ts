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

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const CTO_BUNDLE = path.resolve(__dirname, '../../packages/concerto-cto/dist/concerto-cto.js');
const CORE_BUNDLE = path.resolve(__dirname, '../../packages/concerto-core/dist/concerto-core.js');

async function injectBundle(page: Page, bundlePath: string): Promise<void> {
    await page.goto('about:blank');
    await page.addScriptTag({ path: bundlePath });
}

test.describe('Concerto browser bundles', () => {
    test('loads the CTO parser UMD bundle in Chromium', async ({ page }) => {
        await injectBundle(page, CTO_BUNDLE);

        const parsed = await page.evaluate(() => {
            const { Parser } = (window as any)['concerto-cto'];
            const ast = Parser.parse('namespace org.acme.test@1.0.0\nconcept Person { o String name }');
            return {
                namespace: ast.namespace,
                declarationCount: ast.declarations.length,
            };
        });

        expect(parsed).toEqual({
            namespace: 'org.acme.test@1.0.0',
            declarationCount: 1,
        });
    });

    test('loads the core UMD bundle and uses ModelManager in Chromium', async ({ page }) => {
        await injectBundle(page, CORE_BUNDLE);

        const model = await page.evaluate(() => {
            const { ModelManager } = (window as any)['concerto-core'];
            const modelManager = new ModelManager();
            modelManager.addCTOModel(
                'namespace org.acme.browser@1.0.0\nasset Vehicle identified by vin { o String vin }',
                'vehicle.cto',
                true
            );
            const vehicle = modelManager.getType('org.acme.browser@1.0.0.Vehicle');
            return {
                fqn: vehicle.getFullyQualifiedName(),
                identifierFieldName: vehicle.getIdentifierFieldName(),
            };
        });

        expect(model).toEqual({
            fqn: 'org.acme.browser@1.0.0.Vehicle',
            identifierFieldName: 'vin',
        });
    });

    test('keeps dayjs plugins available through the core bundle', async ({ page }) => {
        await injectBundle(page, CORE_BUNDLE);

        const currentTime = await page.evaluate(() => {
            const { DateTimeUtil } = (window as any)['concerto-core'];
            const result = DateTimeUtil.setCurrentTime('2023-03-17T12:30:00.000Z', 0);
            return {
                iso: result.currentTime.toISOString(),
                offset: result.utcOffset,
            };
        });

        expect(currentTime).toEqual({
            iso: '2023-03-17T12:30:00.000Z',
            offset: 0,
        });
    });
});
