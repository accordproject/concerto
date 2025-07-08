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
import { concertoRuleset } from './rulesets/core-ruleset';
import { ModelManager } from '@accordproject/concerto-core';

/**
 * Converts Concerto model to JSON AST representation
 * @param {string | object} model - Concerto model as string or parsed object
 * @returns {string} JSON string of the AST
 * @throws {Error} For invalid model inputs
 */
function convertToJsonAST(model: string | object): string {
    try {
        if (typeof model === 'string') {
            const manager = new ModelManager();
            manager.addCTOModel(model);
            return JSON.stringify(manager.getAst());
        }
        return JSON.stringify(model);
    } catch (error) {
        throw new Error(`Model conversion failed: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Loads Spectral ruleset based on configuration options
 * @param {string} [rulesetOption] - Custom ruleset path or 'default'
 * @returns {Promise<Ruleset | RulesetDefinition>} Loaded ruleset
 */
async function loadRuleset(rulesetOption?: string): Promise<Ruleset | RulesetDefinition> {
    try {
        const rulesetPath = await resolveRulesetPath(rulesetOption);
        return rulesetPath ? await getRuleset(rulesetPath) : concertoRuleset;
    } catch (error) {
        throw new Error(`Ruleset loading failed: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Lints Concerto models using Spectral and Concerto rules
 * @param {string | object} model - Model to lint (string CTO or parsed AST)
 * @param {string} [rulesetOption] - Path to custom ruleset or 'default'
 * @returns {Promise<IRuleResult[]>} Linting results
 * @throws {Error} For critical processing failures
 */
export async function lintModel(model: string | object, rulesetOption?: string): Promise<IRuleResult[]> {
    try {
        const jsonAST = convertToJsonAST(model);
        const ruleset = await loadRuleset(rulesetOption);

        const spectral = new Spectral();
        spectral.setRuleset(ruleset);

        const document = new Document(jsonAST, JsonParsers);
        return await spectral.run(document);
    } catch (error) {
        throw new Error(`Linting process failed: ${error instanceof Error ? error.message : error}`);
    }
}