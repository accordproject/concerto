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

import { ClassDeclaration, ModelFile, Property } from '@accordproject/concerto-core';
import { CompareConfig, CompareResult, defaultCompareConfig } from './compare-config';
import { CompareFinding } from './compare-message';
import { CompareResults } from './compare-results';
import { Comparer } from './comparer';

export class Compare {
    private config: CompareConfig;

    public constructor(config?: CompareConfig) {
        this.config = Object.assign({}, defaultCompareConfig, config);
    }

    public compare(a: ModelFile, b: ModelFile): CompareResults {
        if (!a.getModelManager().isStrict()) {
            throw new Error(`model file "${a.getNamespace()}" does not have strict versioned namespaces`);
        } else if (!b.getModelManager().isStrict()) {
            throw new Error(`model file "${b.getNamespace()}" does not have strict versioned namespaces`);
        }
        const comparerFactories = this.config.comparerFactories;
        const findings: CompareFinding[] = [];
        const comparers = comparerFactories.map(comparerFactory => comparerFactory({
            report: finding => findings.push(finding),
        }));
        this.compareModelFiles(comparers, a, b);
        return this.buildResults(findings);
    }

    private getAddedProperties<T extends Property>(a: T[], b: T[]): T[] {
        return b.filter(bItem => !a.some(aItem => bItem.getName() === aItem.getName()));
    }

    private getMatchingProperties<T extends Property>(a: T[], b: T[]): [a: T, b: T][] {
        return a.map(aItem => [aItem, b.find(bItem => aItem.getName() === bItem.getName())]).filter(([, b]) => !!b) as [T, T][];
    }

    private getRemovedProperties<T extends Property>(a: T[], b: T[]): T[] {
        return a.filter(aItem => !b.some(bItem => aItem.getName() === bItem.getName()));
    }

    private compareProperty(comparers: Comparer[], a: Property, b: Property) {
        comparers.forEach(comparer => comparer.compareProperty?.(a, b));
    }

    private compareProperties(comparers: Comparer[], a: Property[], b: Property[]) {
        const added = this.getAddedProperties(a, b);
        const matching = this.getMatchingProperties(a, b);
        const removed = this.getRemovedProperties(a, b);
        added.forEach(b => comparers.forEach(comparer => comparer.compareProperty?.(undefined, b)));
        matching.forEach(([a, b]) => this.compareProperty(comparers, a, b));
        removed.forEach(a => comparers.forEach(comparer => comparer.compareProperty?.(a, undefined)));
    }

    private getAddedClassDeclarations(a: ClassDeclaration[], b: ClassDeclaration[]): ClassDeclaration[] {
        return b.filter(bItem => !a.some(aItem => bItem.getName() === aItem.getName()));
    }

    private getMatchingClassDeclarations(a: ClassDeclaration[], b: ClassDeclaration[]): [a: ClassDeclaration, b: ClassDeclaration][] {
        return a.map(aItem => [aItem, b.find(bItem => aItem.getName() === bItem.getName())]).filter(([, b]) => !!b) as [ClassDeclaration, ClassDeclaration][];
    }

    private getRemovedClassDeclarations(a: ClassDeclaration[], b: ClassDeclaration[]): ClassDeclaration[] {
        return a.filter(aItem => !b.some(bItem => aItem.getName() === bItem.getName()));
    }

    private compareClassDeclaration(comparers: Comparer[], a: ClassDeclaration, b: ClassDeclaration) {
        comparers.forEach(comparer => comparer.compareClassDeclaration?.(a, b));
        this.compareProperties(comparers, a.getOwnProperties(), b.getOwnProperties());
    }

    private compareClassDeclarations(comparers: Comparer[], a: ClassDeclaration[], b: ClassDeclaration[]) {
        const added = this.getAddedClassDeclarations(a, b);
        const matching = this.getMatchingClassDeclarations(a, b);
        const removed = this.getRemovedClassDeclarations(a, b);
        added.forEach(b => comparers.forEach(comparer => comparer.compareClassDeclaration?.(undefined, b)));
        matching.forEach(([a, b]) => this.compareClassDeclaration(comparers, a, b));
        removed.forEach(a => comparers.forEach(comparer => comparer.compareClassDeclaration?.(a, undefined)));
    }

    private compareModelFiles(comparers: Comparer[], a: ModelFile, b: ModelFile) {
        comparers.forEach(comparer => comparer.compareModelFiles?.(a, b));
        this.compareClassDeclarations(comparers, a.getAllDeclarations(), b.getAllDeclarations());
    }

    private buildResults(findings: CompareFinding[]) {
        const results: CompareResults = {
            findings: [],
            result: CompareResult.NONE,
        };
        findings.forEach(finding => {
            const result = this.config.rules[finding.key] ?? CompareResult.NONE;
            results.findings.push({
                ...finding,
                result
            });
            if (result > results.result) {
                results.result = result;
            }
        });
        return results;
    }
}
