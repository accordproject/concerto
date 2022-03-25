/**
 * Create decorator argument string from a metamodel
 * @param {string} cto - the Concerto string
 * @param {string} [fileName] - an optional file name
 * @return {object} the string for the decorator argument
 */
export function parse(cto: string, fileName?: string): object;
/**
 * Parses an array of model files
 * @param {string[]} files - array of cto files
 * @return {*} the AST / metamodel
 */
export function parseModels(files: string[]): any;
