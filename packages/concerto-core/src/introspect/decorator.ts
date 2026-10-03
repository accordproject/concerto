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

import { Logger } from '@accordproject/concerto-util';
import IllegalModelException from './illegalmodelexception';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Decorated from './decorated';
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */
import { rust } from '../engineloader';

/**
 * A decorator argument that references a type, produced from a
 * `DecoratorTypeReference` node in the metamodel AST.
 */
export interface DecoratorTypeReferenceArgument {
    type: 'Identifier';
    name: string;
    array: boolean;
}

/**
 * The values a decorator can be given: a literal, or a reference to a type.
 */
export type DecoratorArgument = string | number | boolean | DecoratorTypeReferenceArgument;

/**
 * Decorator encapsulates a decorator (annotation) on a class or property.
 * @class
 * @memberof module:concerto-core
 */
class Decorator {
    ast: AstNode;
    parent: Decorated;
    arguments: DecoratorArgument[];
    name!: string;
    /**
     * Create a Decorator.
     * @param {ClassDeclaration | Property} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: Decorated, ast: AstNode) {
        this.ast = ast;
        this.parent = parent;
        this.arguments = [];
        this.process();
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor, parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Returns the owner of this property
     * @return {ClassDeclaration|Property} the parent class or property declaration
     */
    getParent(): Decorated {
        return this.parent;
    }

    /**
    * Handles a validation error, logging and throwing as required. Called
    * back by the Rust engine's decoratorValidate binding (concerto-wasm
    * src/lib.rs `handle_error`) for every non-fatal-or-fatal validation
    * outcome, so this is a live collaborator, not TS-only fallback logic.
    * @param {string} level the log level
    * @param {string | Error} err the message to log, or the error that was caught
    * @private
    */
    handleError(level: string | undefined, err: string | Error): void {
        Logger.dispatch(level as string, err);
        if (level === 'error') {
            // BC-14 (R1): a caught IllegalModelException already names its
            // file, so it is thrown as it is, and a caught Error gives its
            // message. TS 5.0.0 wrapped the Error itself, so the message
            // embedded 'IllegalModelException: ' and the file suffix twice.
            if (err instanceof IllegalModelException) {
                throw err;
            }
            const message = err instanceof Error ? err.message : err;
            throw new IllegalModelException(message, this.getParent().getModelFile(), this.ast.location);
        }
    }

    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        // `this` lets the binding name `this.getParent().getModelFile()`
        // in the IllegalModelException it throws for a null node, where
        // the old TS body used to crash (concerto-rust DIVERGENCES.md DV-018).
        Object.assign(this, rust.decoratorProcess(this.ast, this));
    }

    /**
     * Validate the decorator
     * @throws {IllegalModelException}
     * @private
     */
    validate() {
        const mf = this.getParent().getModelFile();
        // ModelFile decorators have no fully qualified name, hence the optional call
        const parent = this.getParent() as Decorated & { getFullyQualifiedName?(): string };
        const decoratedName = parent.getFullyQualifiedName?.();

        rust.decoratorValidate(this, mf, decoratedName);
    }

    /**
     * Returns the name of a decorator
     * @return {string} the name of this decorator
     */
    getName(): string {
        return this.name;
    }

    /**
     * Returns the arguments for this decorator
     * @return {object[]} the arguments for this decorator
     */
    getArguments(): DecoratorArgument[] {
        return this.arguments;
    }

    /**
     * Returns true if this class is the definition of a decorator.
     *
     * @return {boolean} true if the class is a decorator
     */
    isDecorator(): boolean {
        return true;
    }
}

export { Decorator };
export default Decorator;
