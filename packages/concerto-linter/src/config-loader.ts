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

import findUp from 'find-up';

// Valid Spectral ruleset filenames in priority order
const SPECTRAL_RULESET_FILES = [
    '.spectral.yaml',
    '.spectral.yml',
    '.spectral.json',
    '.spectral.js',
];

/**
 * Searches for a Spectral ruleset configuration file in the current and parent directories.
 * @returns {Promise<string | null>} Path to found ruleset file or null if none exists
 */
async function findLocalRuleset(): Promise<string | null> {
    for (const fileName of SPECTRAL_RULESET_FILES) {
        const foundPath = await findUp(fileName);
        if (foundPath) {return foundPath;}
    }
    return null;
}

/**
 * Resolves the Spectral ruleset location based on user input or directory search
 * @param {string} [rulesetOption] - User-provided ruleset path or 'default'
 * @returns {Promise<string | null>} Path to custom ruleset, null for default ruleset
 */
export async function resolveRulesetPath(rulesetOption?: string): Promise<string | null> {
    if (!rulesetOption) {
        return await findLocalRuleset();
    }

    return rulesetOption === 'default' ? null : rulesetOption;
}