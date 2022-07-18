/**
 * Create a metamodel instance (i.e. JSON AST) object from a CTO string
 * @param {string} cto - the Concerto string
 * @param {string} [fileName] - an optional file name
 * @param {Object} [options] - an optional options parameter or filename
 * @param {boolean} [options.skipLocationNodes] - when true location nodes will be skipped in the metamodel AST
 * @return {object} the metamodel instance for the cto argument
 */
export function parse(cto: string, fileName?: string, options?: {
    skipLocationNodes?: boolean;
}): object;
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
