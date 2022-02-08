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
/**
 * Downloads all ModelFiles that are external dependencies and adds or
 * updates them in this ModelManager.
 * @param {*} models - the AST for all the known models
 * @param {Object} [options] - Options object passed to ModelFileLoaders
 * @param {FileDownloader} [fileDownloader] - an optional FileDownloader
 * @throws {IllegalModelException} if the models fail validation
 * @return {Promise} a promise when the download and update operation is completed.
 */
export function resolve(models: any, options?: any, fileDownloader?: typeof import("@accordproject/concerto-util/types/lib/filedownloader")): Promise<any>;
