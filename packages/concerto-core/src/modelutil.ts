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

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './introspect/modelfile';
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
// Loading through the public ESM entry points (P4-11a, PORTING.md 1.5):
// - Node ESM (dist/esm/index.mjs) works unaided. scripts/build-esm.js's Node
//   banner sets a `globalThis.module` whose `require` resolves the engine
//   specifiers. It does not rely on the relative specifier above matching
//   the output file's location (esbuild hoists shared views into chunks at
//   the outdir root, where `../engine` would point outside dist/). Instead
//   it rewrites `./engine`, `../engine` and `../engine/<subpath>` to the
//   engine directory it finds at runtime from the file's own import.meta.url.
// - The browser (dist/esm-browser/index.mjs) needs a bundler, or a host that
//   supplies a synchronous `require`. This call is synchronous and a browser
//   cannot load an ES module synchronously, so the browser ESM graph does not
//   load dist/esm-browser/engine/*.mjs by itself. scripts/browser-module-shim.js
//   reads `module.require` from the `globalThis.module` that the bundler or
//   host provides, and throws if there is none.
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : module.require(specifier);
const rust: { [binding: string]: (...args: any[]) => never } = loadEngine('./engine').rust;

// P5-06: the pure string-to-value members below cross into the engine once
// per distinct argument rather than once per call (a model load calls
// isSystemProperty/isValidIdentifier/getFullyQualifiedName for every
// property of every declaration). Only string arguments are memoised, and
// only a result the engine returned (a throw is never cached), so every
// other call, and every error, goes to the engine exactly as before. Each
// member's memo is cleared once it reaches ENGINE_MEMO_LIMIT entries.
const engineMemo: { [binding: string]: Map<string, unknown> } = {};
const ENGINE_MEMO_LIMIT = 4096;

/**
 * `rust[binding](...args)`, memoised under `key` (see engineMemo).
 * @param {string} binding - the engine binding to call
 * @param {string} key - the memo key: the call's string arguments, unambiguously joined
 * @param {...string} args - the arguments
 * @return {*} the binding's result
 * @private
 */
function memoisedEngineCall(binding: string, key: string, ...args: string[]): unknown {
    let memo = engineMemo[binding];
    if (!memo) {
        memo = engineMemo[binding] = new Map();
    } else if (memo.has(key)) {
        return memo.get(key);
    }
    const result = rust[binding](...args);
    if (memo.size >= ENGINE_MEMO_LIMIT) {
        memo.clear();
    }
    memo.set(key, result);
    return result;
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
        return (typeof fqn === 'string' ? memoisedEngineCall('modelUtilGetShortName', fqn, fqn) : rust.modelUtilGetShortName(fqn)) as never;
    }

    /**
     * Returns the namespace for the fully qualified name of a type
     * @param {string} fqn - the fully qualified identifier of a type
     * @return {string} - namespace of the type (everything before the last dot)
     * or the empty string if there is no dot
     */
    static getNamespace(fqn): string {
        return (typeof fqn === 'string' ? memoisedEngineCall('modelUtilGetNamespace', fqn, fqn) : rust.modelUtilGetNamespace(fqn)) as never;
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
        return rust.modelUtilParseNamespace(ns, options) as ReturnType<typeof ModelUtil.parseNamespace>;
    }

    /**
     * Return the fully qualified name for an import
     * @param {object} imp - the import
     * @return {string[]} - the fully qualified names for that import
     * @private
     */
    static importFullyQualifiedNames(imp) {
        return rust.modelUtilImportFullyQualifiedNames(imp);
    }

    /**
     * Returns true if the type is a primitive type
     * @param {string} typeName - the name of the type
     * @return {boolean} - true if the type is a primitive
     * @private
     */
    static isPrimitiveType(typeName): boolean {
        return (typeof typeName === 'string' ? memoisedEngineCall('modelUtilIsPrimitiveType', typeName, typeName) : rust.modelUtilIsPrimitiveType(typeName)) as never;
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
    static isAssignableTo(modelFile, typeName, property) {
        return rust.modelUtilIsAssignableTo(modelFile, typeName, property);
    }

    /**
     * Returns the passed string with the first character capitalized
     * @param {string} string - the string
     * @return {string} the string with the first letter capitalized
     * @private
     */
    static capitalizeFirstLetter(string): string {
        return (typeof string === 'string' ? memoisedEngineCall('modelUtilCapitalizeFirstLetter', string, string) : rust.modelUtilCapitalizeFirstLetter(string)) as never;
    }

    /**
     * Returns true if the given field is an enumerated type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an enumeration
     * @private
     */
    static isEnum(field) {
        return rust.modelUtilIsEnum(field);
    }

    /**
     * Returns true if the given field is an map type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an map
     * @private
     */
    static isMap(field) {
        return rust.modelUtilIsMap(field);
    }

    /**
     * Returns true if the given field is a Scalar type
     * @param {Field} field - the Field to test
     * @return {boolean} true if the field is declared as an scalar
     * @private
     */
    static isScalar(field) {
        return rust.modelUtilIsScalar(field);
    }

    /**
     * Return true if the name is a valid Concerto identifier
     * @param {string} name - the name of the identifier to test.
     * @returns {boolean} true if the identifier is valid.
     */
    static isValidIdentifier(name: string | undefined): name is string {
        return (typeof name === 'string' ? memoisedEngineCall('modelUtilIsValidIdentifier', name, name) : rust.modelUtilIsValidIdentifier(name)) as never;
    }

    /**
     * Get the fully qualified name of a type.
     * @param {string} namespace - namespace of the type.
     * @param {string} type - short name of the type.
     * @returns {string} the fully qualified type name.
     */
    static getFullyQualifiedName(namespace, type): string {
        return (typeof namespace === 'string' && typeof type === 'string'
            ? memoisedEngineCall('modelUtilGetFullyQualifiedName', `${namespace.length}:${namespace}${type}`, namespace, type)
            : rust.modelUtilGetFullyQualifiedName(namespace, type)) as never;
    }

    /**
     * Converts a fully qualified type name to a FQN without a namespace version.
     * If the FQN is a primitive type it is returned unchanged.
     * @param {string} fqn fully qualified name of a type
     * @returns {string} the fully qualified name minus the namespace version
     */
    static removeNamespaceVersionFromFullyQualifiedName(fqn): string {
        return (typeof fqn === 'string' ? memoisedEngineCall('modelUtilRemoveNamespaceVersionFromFullyQualifiedName', fqn, fqn) : rust.modelUtilRemoveNamespaceVersionFromFullyQualifiedName(fqn)) as never;
    }

    /**
     * Returns true if the property is a system property.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    static isSystemProperty(propertyName): boolean {
        return (typeof propertyName === 'string' ? memoisedEngineCall('modelUtilIsSystemProperty', propertyName, propertyName) : rust.modelUtilIsSystemProperty(propertyName)) as never;
    }

    /**
     * Returns true if the property is an system property that can be set in serialized JSON.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    static isPrivateSystemProperty(propertyName): boolean {
        return (typeof propertyName === 'string' ? memoisedEngineCall('modelUtilIsPrivateSystemProperty', propertyName, propertyName) : rust.modelUtilIsPrivateSystemProperty(propertyName)) as never;
    }

    /**
     * Returns true if this Key is a valid Map Key.
     *
     * @param {Object} key - the Key of the Map Declaration
     * @return {boolean} true if the Key is a valid Map Key
    */
    static isValidMapKey(key) {
        return rust.modelUtilIsValidMapKey(key);
    }

    /**
     * Returns true if this Key is a valid Map Key Scalar Value.
     *
     * @param {Object} decl - the Map Key Scalar declaration
     * @return {boolean} true if the Key is a valid Map Key Scalar type
    */
    static isValidMapKeyScalar(decl) {
        return rust.modelUtilIsValidMapKeyScalar(decl);
    }

    /**
     * Returns true if this Value is a valid Map Value.
     *
     * @param {Object} value - the Value of the Map Declaration
     * @return {boolean} true if the Value is a valid Map Value
     */
    static isValidMapValue(value) {
        return rust.modelUtilIsValidMapValue(value);
    }
}

export { ModelUtil };
export default ModelUtil;
