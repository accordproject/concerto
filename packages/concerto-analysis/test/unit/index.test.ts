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

import {
    Compare,
    CompareResult,
    CompareConfigBuilder,
    compareResultToString,
    type CompareConfig,
    type CompareContext,
    type CompareFinding,
    type CompareMessage,
    type CompareResults,
    type Comparer,
    type ComparerFactory,
} from '../../src/index';

describe('index exports', () => {
    it('should export all public classes and functions', () => {
        expect(Compare).toBeDefined();
        expect(CompareResult).toBeDefined();
        expect(CompareConfigBuilder).toBeDefined();
        expect(compareResultToString).toBeDefined();
    });

    it('should support typing custom comparers using exported types', () => {
        const customComparerFactory: ComparerFactory = (context: CompareContext): Comparer => ({
            compareModelFiles: () => {
                const message: CompareMessage = {
                    key: 'custom-rule',
                    message: 'Custom comparison message',
                    element: null,
                };
                context.report(message);
            },
        });

        const builder = new CompareConfigBuilder();
        const config: CompareConfig = builder.addComparerFactory(customComparerFactory).build();
        expect(config.comparerFactories).toContain(customComparerFactory);

        const finding: CompareFinding = {
            key: 'custom-rule',
            message: 'Custom comparison message',
            result: CompareResult.PATCH,
            element: null,
        };
        const results: CompareResults = {
            findings: [finding],
            result: CompareResult.PATCH,
        };
        expect(results.findings).toHaveLength(1);
        expect(results.result).toEqual(CompareResult.PATCH);
    });
});
