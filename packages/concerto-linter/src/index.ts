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

import { Spectral, Document } from '@stoplight/spectral-core';
import { Json as JsonParsers } from '@stoplight/spectral-parsers';
import { concertoRuleset } from './rulesets/core-ruleset';

/**
 * Lints a Concerto model's JSON AST using the defined rulesets
 * @param ast - The JSON AST generated from a Concerto model.
 * @returns An array on linting results (e.g., errors or warnings).
 */

export function lintAST(ast: string) {

    const spectral = new Spectral();

    spectral.setRuleset(concertoRuleset);

    const document = new Document(ast,JsonParsers,'/virtual/concerto-ast.json');

    const results = spectral.run(document);
    return results;

}

export { concertoRuleset } from './rulesets/core-ruleset';