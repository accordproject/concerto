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

import { Spectral, Document, IRuleResult, RulesetDefinition, Ruleset } from '@stoplight/spectral-core';
import { Json as JsonParsers } from '@stoplight/spectral-parsers';
import { resolveRulesetPath } from './config-loader';
import { getRuleset } from '@stoplight/spectral-cli/dist/services/linter/utils/getRuleset';
import  concertoRuleset  from '@accordproject/concerto-linter-default-ruleset';
import { Parser } from '@accordproject/concerto-cto';

interface options {
    /** Path to a custom Spectral ruleset or 'default' to use the built-in ruleset */
    ruleset?: string;

    /** One or more namespaces to exclude from linting results */
    excludeNamespaces?: string | string[];
}

interface lintResult {
  /** Unique rule identifier (e.g. 'no-reserved-keywords') */
  code: string;

  /** Human-readable description of the violation */
  message: string;

  /** Severity level ('error' | 'warning' | 'info' | 'hint') */
  severity: string;

  /**
   * JSONPath-style pointer as an array of keys/indices
   * (e.g. ['declarations', 3])
   */
  path: Array<string | number>;

  /** Namespace where the violation occurred */
  namespace: string;

}

/**
 * Converts Concerto model to JSON AST representation
 * @param {string | object} model - Concerto model as string or parsed object
 * @returns {string} JSON string of the AST
 * @throws {Error} For invalid model inputs
 */
function convertToJsonAST(model: string | object): string {
    try {
        if (typeof model === 'string') {
            const modelFile = Parser.parseModels([model]);
            return JSON.stringify(modelFile);
        }
        return JSON.stringify(model);
    } catch (error) {
        throw new Error(`Model conversion failed: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Loads Spectral ruleset based on configuration options
 * @param {string} [ruleset] - Custom ruleset path or 'default'
 * @returns {Promise<Ruleset | RulesetDefinition>} Loaded ruleset
 */
async function loadRuleset(ruleset?: string): Promise<Ruleset | RulesetDefinition> {
    try {

        if (typeof ruleset === 'string' && ruleset.toLowerCase() === 'default') {
            return concertoRuleset;
        }
        const rulesetPath = await resolveRulesetPath(ruleset);
        return rulesetPath ? await getRuleset(rulesetPath) : concertoRuleset;
    } catch (error) {
        throw new Error(`Ruleset loading failed: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Formats Spectral linting results by mapping them to a standardized lint result structure,
 * extracting namespaces from the provided JSON AST, and filtering out results based on excluded namespaces.
 *
 * @param spectralResults - An array of Spectral rule results to be formatted.
 * @param jsonAST - A JSON string representing the AST, used to extract model namespaces.
 * @param excludeNamespaces - A string or array of strings specifying namespace patterns to exclude from the results.
 *                            Patterns ending with `.*` will match any namespace starting with the given prefix.
 *                            Defaults to `['concerto.*', 'org.accord.*']`.
 * @returns An array of formatted lint results, excluding those matching the specified namespaces.
 */

function formatResults(
    spectralResults: IRuleResult[],
    jsonAST: string,
    excludeNamespaces: string | string[] = ['concerto.*', 'org.accordproject.*']
): lintResult[] {
    try {
        const ast = JSON.parse(jsonAST);

        const severityMap: { [key: number]: string } = {
            0: 'error',
            1: 'warning',
            2: 'info',
            3: 'hint',
        };

        const results: lintResult[] = spectralResults.map(r => {
            let namespace = 'unknown';

            if (Array.isArray(r.path) && r.path.length >= 2 && r.path[0] === 'models') {
                const modelIndex = r.path[1] as number;
                const modelEntry = ast.models?.[modelIndex];
                if (modelEntry && modelEntry.namespace) {
                    namespace = modelEntry.namespace;
                }
            }

            return {
                code: r.code as string,
                message: r.message,
                path: r.path,
                severity: severityMap[r.severity],
                namespace: namespace,
            };
        });

        const exclusionPatterns = Array.isArray(excludeNamespaces) ? excludeNamespaces : [excludeNamespaces];

        return results.filter(result => {
            return !exclusionPatterns.some(pattern => {
                if (pattern.endsWith('.*')) {
                    return result.namespace.startsWith(pattern.slice(0, pattern.length - 2));
                }
                return result.namespace === pattern;
            });
        });
    } catch (error) {
        throw new Error(`Formatting lint results failed: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Lints Concerto models using Spectral and Concerto rules.
 * @param {string | object} model - The Concerto model to lint, either as a CTO string or a parsed AST object. Note: No external dependency resolution is performed.
 * @param {options} [config] - Configuration options for customizing the linting process.
 * @param {string} [config.ruleset] - Path to a custom Spectral ruleset file or 'default' to use the built-in ruleset.
 * @param {string | string[]} [config.excludeNamespaces] - One or more namespaces to exclude from linting results (defaults to 'concerto.*' and 'org.accord.*').
 * @returns {Promise<lintResult[]>} Promise resolving to an array of formatted linting results as a JSON object.
 * @throws {Error} Throws an error if linting or model conversion fails.
 */
export async function lintModel(model: string | object, config?: options): Promise<lintResult[]> {
    try {
        const jsonAST = convertToJsonAST(model);
        const ruleset = await loadRuleset(config?.ruleset);

        const spectral = new Spectral();
        spectral.setRuleset(ruleset);

        const document = new Document(jsonAST, JsonParsers);
        const spectralResults = await spectral.run(document);
        return formatResults(spectralResults, jsonAST, config?.excludeNamespaces);

    } catch (error) {
        throw new Error(`Linting process failed: ${error instanceof Error ? error.message : error}`);
    }
}