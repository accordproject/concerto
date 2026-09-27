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

import Decorated from './decorated';
import type { AstNode } from './decorated';
import IllegalModelException from './illegalmodelexception';

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
// P5-10a: memoised per specifier (see introspect/property.ts).
const engineModules: { [specifier: string]: any } = {};
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    engineModules[specifier] ??
    (engineModules[specifier] =
        typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : createRequire(__filename)(specifier));

/**
 * Declaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A Declaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
class Declaration extends Decorated {
    modelFile: ModelFile;
    name!: string;
    fqn!: string;
    /**
     * Create a Declaration from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: AstNode) {
        super(ast);
        this.modelFile = modelFile;
        this.process();
    }

    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        // P5-10a: `modelUtilIsValidIdentifier` and
        // `modelUtilGetFullyQualifiedName`, read from the file's view
        // snapshot while its declarations are built (engine/views.ts).
        const views = loadEngine('../engine/views');
        if (!views.declarationIsValidIdentifier(this)) {
            throw new IllegalModelException(`Invalid class name '${this.ast.name}'`, this.modelFile, this.ast.location);
        }
        // `declarationIsValidIdentifier` is a plain boolean function, not a
        // type predicate, so `this.ast.name` is not narrowed from
        // `string | undefined` by the check above.
        this.name = this.ast.name as string;
        this.fqn = views.declarationFullyQualifiedName(this);
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
    validate(...args: any[]) {
        super.validate(...args);
        const modelFile = this.getModelFile();

        // #648 - check for clashes against imported types
        if (modelFile.isImportedType(this.getName())) {
            const dangerouslyAllowReservedSystemTypeNamesInUserModels = Boolean(modelFile.getModelManager()?.options?.dangerouslyAllowReservedSystemTypeNamesInUserModels);
            if (dangerouslyAllowReservedSystemTypeNamesInUserModels && this.isReservedSystemTypeImport(modelFile, this.getName())) {
                return;
            }

            throw new IllegalModelException(`Type '${this.getName()}' clashes with an imported type with the same name.`, this.modelFile, this.ast.location);
        }
    }

    /**
     * Determines whether a type name resolves to a reserved type in the Concerto
     * system namespace.
     * @param {ModelFile} modelFile - the current model file
     * @param {string} typeName - local/imported type name
     * @returns {boolean} true if the resolved import is a reserved system type
     */
    private isReservedSystemTypeImport(modelFile: ModelFile, typeName: string): boolean {
        const importedType = modelFile.getType(typeName);
        if (!importedType || typeof importedType === 'string') {
            return false;
        }

        const importedModelFile = importedType.getModelFile();
        if (!importedModelFile || !importedModelFile.isSystemModelFile()) {
            return false;
        }

        return importedType.isConcept()
            || importedType.isAsset()
            || importedType.isTransaction()
            || importedType.isParticipant()
            || importedType.isEvent();
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile {
        return this.modelFile;
    }

    /**
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName(): string {
        return this.name;
    }

    /**
     * Return the namespace of this class.
     * @return {string} namespace - a namespace.
     */
    getNamespace(): string {
        return this.modelFile.getNamespace();
    }

    /**
     * Returns the fully qualified name of this class.
     * The name will include the namespace if present.
     *
     * @return {string} the fully-qualified name of this class
     */
    getFullyQualifiedName(): string {
        return this.fqn;
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isIdentified(): boolean {
        return false;
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isSystemIdentified(): boolean {
        return false;
    }

    /**
     * Returns the name of the identifying field for this class. Note
     * that the identifying field may come from a super type.
     *
     * @return {string} the name of the id field for this class or null if it does not exist
     */
    getIdentifierFieldName(): string | null {
        return null;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getType(): string | null {
        return null;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string | null {
        return null;
    }

    /**
     * Returns true if this class is the definition of an enum.
     *
     * @return {boolean} true if the class is an enum
     */
    isEnum(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isClassDeclaration(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a map-declaration.
     *
     * @return {boolean} true if the class is a map-declaration
     */
    isMapDeclaration(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     */
    isParticipant(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     */
    isTransaction(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     */
    isEvent(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     */
    isConcept(): boolean {
        return false;
    }
}

export { Declaration };
export default Declaration;
