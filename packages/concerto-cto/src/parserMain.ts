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

import { MetaModelNamespace, IModel, IModels } from '@accordproject/concerto-metamodel';

import * as Parser from './parser';
import ParseException from './parseexception';

interface ParseOptions {
    skipLocationNodes?: boolean;
}

// The shape of the error thrown by the generated peg.js parser (parser.js's
// `peg$SyntaxError`), which is not itself a typed module.
interface CtoSyntaxError {
    message: string;
    location?: {
        start: { line: number; column: number; offset: number };
        end?: { line: number; column: number; offset: number };
    };
}

/**
 * Create a metamodel instance (i.e. JSON AST) object from a CTO string
 * @param {string} cto - the Concerto string
 * @param {string} [fileName] - an optional file name
 * @param {Object} [options] - an optional options parameter or filename
 * @param {boolean} [options.skipLocationNodes] - default true, when true location nodes will be skipped in the metamodel AST
 * @return {object} the metamodel instance for the cto argument
 */
export function parse(cto: string, fileName?: string, options?: ParseOptions): IModel {
    try {
        // Set default for skipLocationNodes to true if not specified
        if (!options || options?.skipLocationNodes === undefined) {
            options = { ...options, skipLocationNodes: true };
        }
        return Parser.parse(cto, options);
    } catch(err: unknown) {
        const parseErr = err as CtoSyntaxError;
        if(parseErr.location && parseErr.location.start) {
            throw new ParseException(parseErr.message, parseErr.location, fileName);
        }
        else {
            throw err;
        }
    }
}

/**
 * Parses an array of model files
 * @param {string[]} files - array of cto files
 * @param {Object} [options] - an optional options parameter
 * @param {string} [options.skipLocationNodes] - when true location nodes will be skipped in the metamodel AST
 * @return {IModels} the AST / metamodel
 */
export function parseModels(files: string[], options?: ParseOptions): IModels {
    const result: IModels = {
        $class: `${MetaModelNamespace}.Models`,
        models: [],
    };
    files.forEach((modelFile) => {
        const metaModel: IModel = Parser.parse(modelFile, options);
        result.models.push(metaModel);
    });
    return result;
}

const ParserMain = {
    parse,
    parseModels,
};
export default ParserMain;
