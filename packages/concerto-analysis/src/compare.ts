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

import { ClassDeclaration, MapDeclaration, ModelFile, Property, ScalarDeclaration } from '@accordproject/concerto-core';
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

    private getAddedMapDeclarations(a: MapDeclaration[], b: MapDeclaration[]): MapDeclaration[] {
        return b.filter(bItem => !a.some(aItem => bItem.getName() === aItem.getName()));
    }

    private getAddedScalarDeclarations(a: ScalarDeclaration[], b: ScalarDeclaration[]): ScalarDeclaration[] {
        return b.filter(bItem => !a.some(aItem => bItem.getName() === aItem.getName()));
    }

    private getMatchingMapDeclarations(a: MapDeclaration[], b: MapDeclaration[]): [a: MapDeclaration, b: MapDeclaration][] {
        return a.map(aItem => [aItem, b.find(bItem => aItem.getName() === bItem.getName())]).filter(([, b]) => !!b) as [MapDeclaration, MapDeclaration][];
    }

    private getMatchingScalarDeclarations(a: ScalarDeclaration[], b: ScalarDeclaration[]): [a: ScalarDeclaration, b: ScalarDeclaration][] {
        return a.map(aItem => [aItem, b.find(bItem => aItem.getName() === bItem.getName())]).filter(([, b]) => !!b) as [ScalarDeclaration, ScalarDeclaration][];
    }

    private getRemovedMapDeclarations(a: MapDeclaration[], b: MapDeclaration[]): MapDeclaration[] {
        return a.filter(aItem => !b.some(bItem => aItem.getName() === bItem.getName()));
    }

    private getRemovedScalarDeclarations(a: ScalarDeclaration[], b: ScalarDeclaration[]): ScalarDeclaration[] {
        return a.filter(aItem => !b.some(bItem => aItem.getName() === bItem.getName()));
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

    private compareMapDeclarations(comparers: Comparer[], a: MapDeclaration[], b: MapDeclaration[]) {
        const added = this.getAddedMapDeclarations(a, b);
        const matching = this.getMatchingMapDeclarations(a, b);
        const removed = this.getRemovedMapDeclarations(a, b);
        added.forEach(b => comparers.forEach(comparer => comparer.compareMapDeclaration?.(undefined, b)));
        matching.forEach(([a, b]) => comparers.forEach(comparer => comparer.compareMapDeclaration?.(a, b)));
        removed.forEach(a => comparers.forEach(comparer => comparer.compareMapDeclaration?.(a, undefined)));
    }

    private compareScalarDeclarations(comparers: Comparer[], a: ScalarDeclaration[], b: ScalarDeclaration[]) {
        const added = this.getAddedScalarDeclarations(a, b);
        const matching = this.getMatchingScalarDeclarations(a, b);
        const removed = this.getRemovedScalarDeclarations(a, b);
        added.forEach(b => comparers.forEach(comparer => comparer.compareScalarDeclaration?.(undefined, b)));
        matching.forEach(([a, b]) => comparers.forEach(comparer => comparer.compareScalarDeclaration?.(a, b)));
        removed.forEach(a => comparers.forEach(comparer => comparer.compareScalarDeclaration?.(a, undefined)));
    }


    private compareClassDeclaration(comparers: Comparer[], a: ClassDeclaration, b: ClassDeclaration) {
        comparers.forEach(comparer => comparer.compareClassDeclaration?.(a, b));
        // MapDeclarations do not contain properties, nothing to compare.
        if(a instanceof MapDeclaration || b instanceof MapDeclaration) {
            return;
        }
        // ScalarDeclarations do not contain properties, nothing to compare.
        if(a instanceof ScalarDeclaration || b instanceof ScalarDeclaration) {
            return;
        }
        // const propsA = a.getProperties();
        // const propsB = b.getProperties();
        let propsA = a.getOwnProperties();
        let propsB = b.getOwnProperties();
        if (a.getProperties()) {
            propsA = a.getProperties();
        }
        if (b.getProperties()) {
            propsB = b.getProperties();
        }
        this.compareProperties(comparers, propsA, propsB);
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
        this.compareMapDeclarations(comparers, a.getMapDeclarations(), b.getMapDeclarations());
        this.compareScalarDeclarations(comparers, a.getScalarDeclarations(), b.getScalarDeclarations());
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
