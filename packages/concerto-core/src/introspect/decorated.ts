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
import { rust, engineViews } from '../engineloader';

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
    // P5-10b: an accessor on the prototype (installed below), so that a
    // lazily built file's element builds its decorators on first read. A
    // write stores a plain own field, and an element that never processed
    // any reads an empty array, as the `= []` initialiser gave it.
    decorators!: Decorator[];
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
        // P5-10b: in a lazily built file, the decorators are built on first
        // read (engine/views.ts `deferDecorators`).
        const views = engineViews();
        if (views.deferDecorators(this)) {
            return;
        }
        this.decorators = [];

        if(this.ast.decorators) {
            const modelFile = this.getModelFile();
            // `modelFile.getModelManager()?.getDecoratorFactories()`, except
            // for a lazily built file (engine/views.ts `decoratorFactories`).
            const factories = views.decoratorFactories(modelFile);
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

            const duplicateName = rust.decoratedFindDuplicateName(this.decorators.map(d => d.getName())) as string | null;
            if (duplicateName !== null) {
                throw new IllegalModelException(
                    `Duplicate decorator ${duplicateName}`,
                    this.getModelFile(),
                    this.ast.location,
                );
            }
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

engineViews().installLazyField(Decorated.prototype, 'decorators', () => []);

export { Decorated };
export default Decorated;
