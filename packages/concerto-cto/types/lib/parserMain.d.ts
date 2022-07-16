/**
 * Create a metamodel instance (i.e. JSON AST) object from a CTO string
 * @param {string} cto - the Concerto string
 * @param {string | Object} [options] - an optional options parameter or filename
 * @param {string} [options.skipLocationNodes] - when true location nodes will be skipped in the metamodel AST
 * @param {string} [options.fileName] - when true location nodes will be skipped in the metamodel AST
 * @return {object} the metamodel instance for the cto argument
 */
export function parse(cto: string, options?: string | any): object;
/**
 * Parses an array of model files
 * @param {string[]} files - array of cto files
 * @param {Object} [options] - an optional options parameter
 * @param {string} [options.skipLocationNodes] - when true location nodes will be skipped in the metamodel AST
 * @return {*} the AST / metamodel
 */
export function parseModels(files: string[], options?: {
    skipLocationNodes?: string;
}): any;
