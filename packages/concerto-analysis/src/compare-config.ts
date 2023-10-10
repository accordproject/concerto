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
};

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
        'scalar-validator-added': CompareResult.MAJOR,
        'scalar-validator-removed': CompareResult.PATCH,
        'scalar-validator-changed': CompareResult.MAJOR,
    },
};

const EmptyConfig: CompareConfig = {
    comparerFactories: [],
    rules: {},
};

export class CompareConfigBuilder {
    /**
   * A utility to build CompareConfig to be used in Compare class.
   * A new compare config can be edited with provided functions and finally
   * resulting config can be used by calling `build`.
   *
   * By default, it starts with an emoty configuration.
   */

    private _config: CompareConfig = EmptyConfig;

    /**
   * Final step of the builder
   *
   * @returns {CompareConfig} Resulting CompareConfig object.
   */
    public build(): CompareConfig {
        return { ...this._config };
    }

    /**
   * Sets default comparer configuration.
   */
    public default() {
        this._config = { ...defaultCompareConfig };
    }

    /**
   * Extends existing configuration tha't built up to this point
   * with the provided config.
   *
   * @param {CompareConfig} config - The configuration to extend with
   */
    public extend(config: CompareConfig) {
        this._config = {
            comparerFactories: [...this._config.comparerFactories, ...config.comparerFactories],
            rules: { ...this._config.rules, ...config.rules },
        };
    }

    /**
   * Adds a comparison outcome rule to the configuration
   *
   * @param {string} ruleKey - A key that is referenced from one of the comparer factories
   * @param {CompareResult} result - A version diff outcome based on this rule
   */
    public addRule(ruleKey: string, result: CompareResult) {
        this._config.rules[ruleKey] = result;
    }

    /**
   * Removes a comparison outcome rule from the configuration
   *
   * @param {string} ruleKey - A key that is referenced from one of the comparer factories
   * @throws {ReferenceError}
   * Thrown if the `ruleKey` does not exist in the configuration
   */
    public removeRule(ruleKey: string) {
        if (!this._config.rules[ruleKey]) {
            throw new ReferenceError(`ruleKey '${ruleKey}' does not exist`);
        }

        delete this._config.rules[ruleKey];
    }

    /**
   * Add a {@link ComparerFactory} to the configuration.
   *
   * @param {ComparerFactory} f - A {@link ComparerFactory} that should reference the rules in the configuration
   */
    public addComparerFactory(f: ComparerFactory) {
        this._config.comparerFactories = [...this._config.comparerFactories, f];
    }
}
