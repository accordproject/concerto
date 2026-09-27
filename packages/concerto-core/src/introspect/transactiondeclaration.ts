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

import IdentifiedDeclaration from './identifieddeclaration';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './modelfile';
/* eslint-enable no-unused-vars */

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). Its bindings are typed
// `never` so that a view leaves the member's inferred return type, and so
// the .d.ts, exactly as the TS body used to make it.
//
// dist/, dist/esm and dist/esm-browser ship src/engine/ as JavaScript only,
// with no .d.ts, since it is not public API (tsconfig.build.internal.json;
// OD-11). A bundler must never see a specifier it would resolve: `loadEngine`
// takes a non-literal one (esbuild, rollup and browserify leave it alone) and
// never names the bare `require` (esbuild's ESM output would add its
// `__require` shim, which webpack reports as a critical dependency), and
// webpack folds the `typeof __webpack_require__` test and keeps only the
// dead-in-Node `__non_webpack_require__` branch, so it neither resolves nor
// warns.
//
// rust mode works through the CommonJS dist/ only. Through the public ESM and
// browser entry points (dist/esm/index.mjs, dist/esm-browser/index.mjs) it is
// not supported yet and is deferred to a follow-up: there `module.require`
// does not exist, and the relative specifier does not match the flattened
// chunks' location.
import { createRequire } from 'module';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : createRequire(__filename)(specifier);
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => never } = loadEngine('../engine').rust;

/** Class representing the definition of an Transaction.
 * @extends ClassDeclaration
 * @see See  {@link ClassDeclaration}
 *
 * @class
 * @memberof module:concerto-core
 */
class TransactionDeclaration extends IdentifiedDeclaration {
    /**
     * Create an TransactionDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, ast) {
        super(modelFile, ast);
    }

    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind() {
        return rust.modelUtilGetShortName(this.type) as string;
    }
}

export { TransactionDeclaration };
export default TransactionDeclaration;
