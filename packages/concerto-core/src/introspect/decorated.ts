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

import Decorator from './decorator';
import IllegalModelException from './illegalmodelexception';

import type { IDecorator, IRange } from '@accordproject/concerto-metamodel';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './modelfile';
/* eslint-enable no-unused-vars */

// CONCERTO_ENGINE=rust: the Rust engine, or null in ts mode (src/engine/index.ts).
// Its bindings are typed `never` so that a view leaves the member's inferred
// return type, and so the .d.ts, exactly as the TS body makes it.
//
// dist/, dist/esm and dist/esm-browser ship src/engine/ as JavaScript only,
// with no .d.ts, since it is not public API (tsconfig.build.internal.json;
// OD-11). A ts-mode bundle of dist/ must still leave it out, so a bundler
// must never see a specifier it would resolve: `loadEngine` takes a
// non-literal one (esbuild, rollup and browserify leave it alone) and never
// names the bare `require` (esbuild's ESM output would add its `__require`
// shim, which webpack reports as a critical dependency), and webpack folds
// the `typeof __webpack_require__` test and keeps only the dead-in-Node
// `__non_webpack_require__` branch, so it neither resolves nor warns. ts mode
// bundles exactly as before (PORTING.md 1.5).
//
// rust mode works through the CommonJS dist/ only. Through the public ESM and
// browser entry points (dist/esm/index.mjs, dist/esm-browser/index.mjs) it is
// not supported yet and is deferred to a follow-up: there `module.require`
// does not exist, and the relative specifier does not match the flattened
// chunks' location.
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : module.require(specifier);
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => never } | null =
    typeof process !== 'undefined' && process.env?.CONCERTO_ENGINE === 'rust' ? loadEngine('../engine').rust : null;

/**
 * The shape shared by every metamodel AST node that the introspect classes
 * consume. The named members are the ones present on every node; the index
 * signature is deliberate: these classes are duck-typed across node kinds
 * (a ClassDeclaration is built from either a concept or an enum declaration,
 * for example), so narrowing `ast` per subclass would mean a type guard at
 * every access site. Callers wanting the precise node types should use the
 * interfaces exported by `@accordproject/concerto-metamodel`.
 */
export interface AstNode {
    $class: string;
    name?: string;
    location?: IRange;
    decorators?: IDecorator[];
    [key: string]: any;
}

/**
 * Decorated defines a model element that may have decorators attached.
 *
 * @private
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
class Decorated {
    ast: AstNode;
    decorators: Decorator[] = [];
    /**
     * Create a Decorated from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {string} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(ast: AstNode) {
        if(!ast) {
            throw new Error('ast not specified');
        }
        this.ast = ast;
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @abstract
     * @protected
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile {
        throw new Error('not implemented');
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor,parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        this.decorators = [];

        if(this.ast.decorators) {
            const modelFile = this.getModelFile();
            const factories = modelFile.getModelManager()?.getDecoratorFactories();
            const hasFactories = factories && factories.length > 0;
            for(let n=0; n < this.ast.decorators.length; n++ ) {
                let thing = this.ast.decorators[n];
                let decorator;
                if (hasFactories) {
                    for (let factory of factories) {
                        decorator = factory.newDecorator(this, thing);
                        if (decorator) {
                            break;
                        }
                    }
                }
                if (!decorator) {
                    decorator = new Decorator(this, thing);
                }
                this.decorators.push(decorator);
            }
        }
    }

    /**
     * Semantic validation of the structure of this decorated. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @param {...*} args the validation arguments
     * @throws {IllegalModelException}
     * @protected
     */
    validate(...args) {
        if (this.decorators && this.decorators.length > 0) {
            for(let n=0; n < this.decorators.length; n++) {
                this.decorators[n].validate();
            }

            /* istanbul ignore if */
            if (rust) {
                const duplicateName = rust.decoratedFindDuplicateName(this.decorators.map(d => d.getName())) as string | null;
                if (duplicateName !== null) {
                    throw new IllegalModelException(
                        `Duplicate decorator ${duplicateName}`,
                        this.getModelFile(),
                        this.ast.location,
                    );
                }
                return;
            }

            // check we don't have this decorator twice
            const uniqueDecoratorNames = new Set();
            this.decorators.forEach(d => {
                const decoratorName = d.getName();
                if(!uniqueDecoratorNames.has(decoratorName)) {
                    uniqueDecoratorNames.add(decoratorName);
                } else {
                    const modelFile = this.getModelFile();
                    throw new IllegalModelException(
                        `Duplicate decorator ${decoratorName}`,
                        modelFile,
                        this.ast.location,
                    );
                }
            });
        }
    }

    /**
     * Returns the decorators for this class.
     *
     * @return {Decorator[]} the decorators for the class
     */
    getDecorators(): Decorator[] {
        return this.decorators;
    }

    /**
     * Returns the decorator for this class with a given name.
     * @param {string} name  - the name of the decorator
     * @return {Decorator} the decorator attached to this class with the given name, or null if it does not exist.
     */
    getDecorator(name: string): Decorator | null {
        for(let n=0; n < this.decorators.length; n++) {
            let decorator = this.decorators[n];
            if(decorator.getName() === name) {
                return decorator;
            }
        }

        return null;
    }
}

export { Decorated };
export default Decorated;
