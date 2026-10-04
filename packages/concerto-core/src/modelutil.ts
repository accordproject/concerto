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

import semver from 'semver';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './introspect/modelfile';
/* eslint-enable no-unused-vars */
import { rust, engineViews } from './engineloader';
import type { EngineBindings } from './engine/bindings';

// The other pure string-to-value members below cross into the engine once
// per distinct argument rather than once per call (a model load calls
// isSystemProperty/isValidIdentifier/getFullyQualifiedName for every
// property of every declaration). Only string arguments are memoised, and
// only a result the engine returned (a throw is never cached), so every
// other call, and every error, goes to the engine. Each
// member's memo is cleared once it reaches ENGINE_MEMO_LIMIT entries.
const engineMemo: { [binding: string]: Map<string, unknown> } = {};
const ENGINE_MEMO_LIMIT = 4096;

/** The members memoised by `memoisedEngineCall`, all `(...strings) => value`. */
type MemoisedBinding = 'modelUtilCapitalizeFirstLetter' | 'modelUtilIsValidIdentifier' | 'modelUtilGetFullyQualifiedName' |
    'modelUtilRemoveNamespaceVersionFromFullyQualifiedName';

/**
 * `rust[binding](...args)`, memoised under `key` (see engineMemo).
 * @param {string} binding - the engine binding to call
 * @param {string} key - the memo key: the call's string arguments, unambiguously joined
 * @param {...string} args - the arguments
 * @return {*} the binding's result
 * @private
 */
function memoisedEngineCall<B extends MemoisedBinding>(binding: B, key: string, ...args: string[]): ReturnType<EngineBindings[B]> {
    let memo = engineMemo[binding];
    if (!memo) {
        memo = engineMemo[binding] = new Map();
    } else if (memo.has(key)) {
        return memo.get(key) as ReturnType<EngineBindings[B]>;
    }
    const result = (rust[binding] as (...strings: string[]) => ReturnType<EngineBindings[B]>)(...args);
    if (memo.size >= ENGINE_MEMO_LIMIT) {
        memo.clear();
    }
    memo.set(key, result);
    return result;
}

// The members below that only slice a string, or look one up in a fixed
// list, answer a string argument here, with the engine's own semantics
// (concerto-rust `model_util::short_name`, `namespace_of`,
// `PRIMITIVE_TYPES` and the reserved property lists), rather than crossing
// into the engine for it. Any other argument, and every error, still goes
// to the engine.
const PRIMITIVE_TYPES = ['Boolean', 'String', 'DateTime', 'Double', 'Integer', 'Long'];
const PRIVATE_RESERVED_PROPERTIES = [
    '$classDeclaration', '$namespace', '$type', '$modelManager', '$validator',
    '$identifierFieldName', '$imports', '$superTypes', '$id',
];
const ASSIGNABLE_RESERVED_PROPERTIES = ['$identifier', '$timestamp'];

/**
 * BC-52: `ModelUtil.isEnum`, `isMap` and `isScalar` resolve
 * `field.getParent().getModelFile().getType(field.getType())` in the
 * engine's arena, by the handle of that model file and the field's type
 * name (a Property, or a MapKeyType or MapValueType, whose parent is the
 * MapDeclaration); a replaced `getType` method is not called. `undefined`
 * stands for a type that is not found, as when the model file is outside
 * the arena (it resolves no type).
 * @param {Field} field - the field
 * @param {string} binding - the handle method answering for a found type
 * @return {boolean|undefined} the answer, or undefined when the type is not found
 */
function fieldTypeIs(field, binding: 'modelUtilIsEnum' | 'modelUtilIsMap' | 'modelUtilIsScalar'): boolean | undefined {
    const modelFile = field.getParent().getModelFile();
    const type = field.getType();
    const file = engineViews().modelFileArenaRef(modelFile);
    if (file === undefined || (type !== null && type !== undefined && typeof type !== 'string')) {
        return undefined;
    }
    return file.handle[binding](file.id, type);
}

/**
 * Internal Model Utility Class
 * <p><a href="./diagrams-private/modelutil.svg"><img src="./diagrams-private/modelutil.svg" style="height:100%;"/></a></p>
 * @private
 * @class
 * @memberof module:concerto-core
 */
class ModelUtil {
    /**
     * Returns everything after the last dot, if present, of the source string
     * @param {string} fqn - the source string
     * @return {string} - the string after the last dot
     */
    static getShortName(fqn): string {
        return typeof fqn === 'string' ? fqn.substring(fqn.lastIndexOf('.') + 1) : rust.modelUtilGetShortName(fqn);
    }

    /**
     * Returns the namespace for the fully qualified name of a type
     * @param {string} fqn - the fully qualified identifier of a type
     * @return {string} - namespace of the type (everything before the last dot)
     * or the empty string if there is no dot
     */
    static getNamespace(fqn): string {
        return typeof fqn === 'string' && fqn !== '' ? fqn.substring(0, Math.max(fqn.lastIndexOf('.'), 0)) : rust.modelUtilGetNamespace(fqn);
    }

    /**
     * @typedef ParseNamespaceResult
     * @property {string} name the name of the namespace
     * @property {string} escapedNamespace the escaped namespace
     * @property {string} version the version of the namespace
     * @property {object} versionParsed the parsed semantic version of the namespace
     */

    /**
     * Parses a versioned namespace into
     * its name and version parts. The version of the namespace
     * is parsed using semver.parse.
     * @param {string} ns the namespace to parse
     * @param {object} [options] optional parsing options
     * @param {boolean} [options.disableVersionParsing] if false, the version will be parsed
     * @returns {ParseNamespaceResult} the result of parsing
     */
    static parseNamespace(ns: string, options?: { disableVersionParsing?: boolean }): {
        name: string;
        escapedNamespace?: string;
        version?: string | null;
        versionParsed?: unknown;
    } {
        // The engine checks the version and returns its result packed into
        // one string (concerto-wasm modelUtilParseNamespaceChecked),
        // without calling back into JS. `versionParsed` is then built
        // here, by semver.parse, which costs far less in JS than a
        // callback across the boundary. Since BC-41 the engine takes
        // strict SemVer 2.0.0, which semver.parse accepts too, except
        // where node-semver's own limits reject it (a component above
        // Number.MAX_SAFE_INTEGER, or more than 256 characters):
        // `versionParsed` is then null, as the engine's own is.
        const packed = rust.modelUtilParseNamespaceChecked(ns, options) as string;
        const parts = packed.slice(1).split('@');
        if (packed[0] === 'N') {
            return { name: parts[0] };
        }
        const version = packed[0] === 'V' ? parts[2] : null;
        return {
            name: parts[0],
            escapedNamespace: parts[1],
            version,
            versionParsed: version === null ? null : semver.parse(version),
        };
    }

    /**
     * Return the fully qualified name for an import
     * @param {object} imp - the import
     * @return {string[]} - the fully qualified names for that import
     * @private
     */
    static importFullyQualifiedNames(imp): string[] {
        return rust.modelUtilImportFullyQualifiedNames(imp);
    }

    /**
     * Returns true if the type is a primitive type
     * @param {string} typeName - the name of the type
     * @return {boolean} - true if the type is a primitive
     * @private
     */
    static isPrimitiveType(typeName): boolean {
        return typeof typeName === 'string' ? PRIMITIVE_TYPES.includes(typeName) : rust.modelUtilIsPrimitiveType(typeName);
    }

    /**
     * Returns true if the type is assignable to the propertyType.
     *
     * @param {ModelFile} modelFile - the ModelFile that owns the Property
     * @param {string} typeName - the FQN of the type we are trying to assign
     * @param {Property} property - the property that we'd like to store the
     * type in.
     * @return {boolean} - true if the type can be assigned to the property
     * @private
     */
    static isAssignableTo(modelFile, typeName, property): any {
        // BC-52: the type is resolved by the engine from its arena, by the
        // handle of `modelFile` (engine/views.ts, "Arena handles of views");
        // a replaced `getType` or `getAllSuperTypeDeclarations` method is
        // not called. The property's own type is still read through
        // `getFullyQualifiedTypeName` (the serializer passes a relationship
        // map value's stand-in), and a direct match or a primitive on either
        // side is decided here, with no crossing. `typeName` is converted
        // with `String()`, as the JS-object binding did.
        const propertyTypeName = property.getFullyQualifiedTypeName();
        const name = String(typeName);
        const isDirectMatch = name === propertyTypeName;
        if (isDirectMatch || ModelUtil.isPrimitiveType(name) || ModelUtil.isPrimitiveType(propertyTypeName)) {
            return isDirectMatch;
        }
        const file = engineViews().modelFileArenaRef(modelFile);
        if (file === undefined) {
            // A model file outside the arena resolves no type.
            throw new Error(`Cannot find type ${name}`);
        }
        return file.handle.modelUtilIsAssignableTo(file.id, name, String(propertyTypeName));
    }

    /**
     * Returns the passed string with the first character capitalized
     * @param {string} string - the string
     * @return {string} the string with the first letter capitalized
     * @private
     */
    static capitalizeFirstLetter(string): string {
        return typeof string === 'string' ? memoisedEngineCall('modelUtilCapitalizeFirstLetter', string, string) : rust.modelUtilCapitalizeFirstLetter(string);
    }

    /**
     * Returns true if the given field is an enumerated type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an enumeration
     * @private
     */
    static isEnum(field): any {
        return fieldTypeIs(field, 'modelUtilIsEnum');
    }

    /**
     * Returns true if the given field is an map type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an map
     * @private
     */
    static isMap(field): any {
        return fieldTypeIs(field, 'modelUtilIsMap');
    }

    /**
     * Returns true if the given field is a Scalar type
     * @param {Field} field - the Field to test
     * @return {boolean} true if the field is declared as an scalar
     * @private
     */
    static isScalar(field): any {
        return fieldTypeIs(field, 'modelUtilIsScalar');
    }

    /**
     * Return true if the name is a valid Concerto identifier
     * @param {string} name - the name of the identifier to test.
     * @returns {boolean} true if the identifier is valid.
     */
    static isValidIdentifier(name: string | undefined): name is string {
        return typeof name === 'string' ? memoisedEngineCall('modelUtilIsValidIdentifier', name, name) : rust.modelUtilIsValidIdentifier(name);
    }

    /**
     * Get the fully qualified name of a type.
     * @param {string} namespace - namespace of the type.
     * @param {string} type - short name of the type.
     * @returns {string} the fully qualified type name.
     */
    static getFullyQualifiedName(namespace, type): string {
        return typeof namespace === 'string' && typeof type === 'string'
            ? memoisedEngineCall('modelUtilGetFullyQualifiedName', `${namespace.length}:${namespace}${type}`, namespace, type)
            : rust.modelUtilGetFullyQualifiedName(namespace, type);
    }

    /**
     * Converts a fully qualified type name to a FQN without a namespace version.
     * If the FQN is a primitive type it is returned unchanged.
     * @param {string} fqn fully qualified name of a type
     * @returns {string} the fully qualified name minus the namespace version
     */
    static removeNamespaceVersionFromFullyQualifiedName(fqn): string {
        return typeof fqn === 'string' ? memoisedEngineCall('modelUtilRemoveNamespaceVersionFromFullyQualifiedName', fqn, fqn) : rust.modelUtilRemoveNamespaceVersionFromFullyQualifiedName(fqn);
    }

    /**
     * Returns true if the property is a system property.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    static isSystemProperty(propertyName): boolean {
        return typeof propertyName === 'string'
            ? propertyName === '$class' || ASSIGNABLE_RESERVED_PROPERTIES.includes(propertyName) || PRIVATE_RESERVED_PROPERTIES.includes(propertyName)
            : rust.modelUtilIsSystemProperty(propertyName);
    }

    /**
     * Returns true if the property is an system property that can be set in serialized JSON.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    static isPrivateSystemProperty(propertyName): boolean {
        return typeof propertyName === 'string' ? PRIVATE_RESERVED_PROPERTIES.includes(propertyName) : rust.modelUtilIsPrivateSystemProperty(propertyName);
    }

    /**
     * Returns true if this Key is a valid Map Key.
     *
     * @param {Object} key - the Key of the Map Declaration
     * @return {boolean} true if the Key is a valid Map Key
    */
    static isValidMapKey(key): boolean {
        return rust.modelUtilIsValidMapKey(key);
    }

    /**
     * Returns true if this Key is a valid Map Key Scalar Value.
     *
     * @param {Object} decl - the Map Key Scalar declaration
     * @return {boolean} true if the Key is a valid Map Key Scalar type
    */
    static isValidMapKeyScalar(decl): any {
        // `decl?.isScalarDeclaration?.() && ...`: a nullish declaration is
        // undefined. BC-52: any other declaration is answered by the engine
        // from its arena, by the declaration's handle.
        if (decl === null || decl === undefined) {
            return undefined;
        }
        const views = engineViews();
        const ref = views.declarationArenaRef(decl);
        if (ref === undefined) {
            throw views.notInArena('ModelUtil.isValidMapKeyScalar');
        }
        return ref.handle.modelUtilIsValidMapKeyScalar(ref.id);
    }

    /**
     * Returns true if this Value is a valid Map Value.
     *
     * @param {Object} value - the Value of the Map Declaration
     * @return {boolean} true if the Value is a valid Map Value
     */
    static isValidMapValue(value): boolean {
        return rust.modelUtilIsValidMapValue(value);
    }
}

export { ModelUtil };
export default ModelUtil;
