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

import Property from './property';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { AstNode } from './decorated';
import type ClassDeclaration from './classdeclaration';
/* eslint-enable no-unused-vars */

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). See property.ts's own
// copy of this comment for the bundler/webpack reasoning this loader relies
// on.
import { createRequire } from 'module';
import type { EngineBindings } from '../engine/bindings';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : createRequire(__filename)(specifier);
/* istanbul ignore next */
const rust: EngineBindings = loadEngine('../engine').rust;

/**
 * Class representing a relationship between model elements
 * @extends Property
 * @see See  {@link Property}
 *
 * @class
 * @memberof module:concerto-core
 */
class RelationshipDeclaration extends Property {
    /**
     * Create a Relationship.
     * @param {ClassDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ClassDeclaration, ast: AstNode) {
        super(parent, ast);
    }

    /**
     * Validate the property
     * @param {ClassDeclaration} classDecl the class declaration of the property
     * @throws {IllegalModelException}
     * @protected
     */
    validate(classDecl: ClassDeclaration): void {
        super.validate(classDecl);

        rust.relationshipDeclarationValidate(this, classDecl);
    }

    /**
     * Returns a string representation of this property
     * @return {String} the string version of the property.
     */
    toString(): string {
        return 'RelationshipDeclaration {name=' + this.name + ', type=' + this.getFullyQualifiedTypeName() + ', array=' + this.array + ', optional=' + this.optional +'}';
    }

    /**
     * Returns true if this class is the definition of a relationship.
     *
     * @return {boolean} true if the class is a relationship
     */
    isRelationship(): boolean {
        return true;
    }
}

export { RelationshipDeclaration };
export default RelationshipDeclaration;
