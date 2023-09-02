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

import { ComparerFactory } from './comparer';
import { comparerFactories } from './comparers';

export enum CompareResult {
    NONE,
    PATCH,
    MINOR,
    MAJOR,
    ERROR,
}

export function compareResultToString(result: CompareResult) {
    switch (result) {
    case CompareResult.NONE:
        return 'none';
    case CompareResult.PATCH:
        return 'patch';
    case CompareResult.MINOR:
        return 'minor';
    case CompareResult.MAJOR:
        return 'major';
    case CompareResult.ERROR:
        return 'error';
    }
}

export type CompareConfig = {
    comparerFactories: ComparerFactory[];
    rules: Record<string, CompareResult>;
}

export const defaultCompareConfig: CompareConfig = {
    comparerFactories,
    rules: {
        'class-declaration-added': CompareResult.MINOR,
        'class-declaration-removed': CompareResult.MAJOR,
        'class-declaration-type-changed': CompareResult.MAJOR,
        'required-property-added': CompareResult.MAJOR,
        'optional-property-added': CompareResult.PATCH,
        'required-property-removed': CompareResult.MAJOR,
        'optional-property-removed': CompareResult.MAJOR,
        'namespace-changed': CompareResult.ERROR,
        'enum-value-added': CompareResult.PATCH,
        'enum-value-removed': CompareResult.MAJOR,
        'property-type-changed': CompareResult.MAJOR,
        'property-validator-added': CompareResult.MAJOR,
        'property-validator-removed': CompareResult.PATCH,
        'property-validator-changed': CompareResult.MAJOR,
        'map-key-type-changed': CompareResult.MAJOR,
        'map-value-type-changed': CompareResult.MAJOR,
        'scalar-extends-changed': CompareResult.MAJOR,
        'scalar-validator-added' : CompareResult.MAJOR,
        'scalar-validator-removed' : CompareResult.PATCH,
        'scalar-validator-changed' : CompareResult.MAJOR,
    }
};
