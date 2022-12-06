/**
 * The metamodel itself, as an AST.
 * @type unknown
 */
export const metaModelAst: unknown;
import metaModelCto = require("./metamodel.js");
/**
 * Resolve the namespace for names in the metamodel
 * @param {*} priorModels - known models
 * @param {object} metaModel - the MetaModel
 * @return {object} the resolved metamodel
 */
export function resolveLocalNames(priorModels: any, metaModel: object): object;
/**
 * Resolve the namespace for names in the metamodel
 * @param {*} allModels - known models
 * @return {object} the resolved metamodel
 */
export function resolveLocalNamesForAll(allModels: any): object;
/**
 * Return the fully qualified name for an import
 * @param {object} imp - the import
 * @return {string[]} - the fully qualified names for that import
 * @private
 */
export function importFullyQualifiedNames(imp: object): string[];
/**
 * Returns an object that maps from the import declarations to the URIs specified
 * @param {*} ast - the model ast
 * @return {Object} keys are import declarations, values are URIs
 * @private
 */
export function getExternalImports(ast: any): any;
export { metaModelCto };
