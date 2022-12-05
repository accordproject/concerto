export = inferModelFile;
/**
 * Infers a Concerto model from a JSON Schema.
 * @param {string} defaultNamespace a fallback namespace to use for the model if it can't be infered
 * @param {string} defaultType a fallback name for the root concept if it can't be infered
 * @param {object} schema the input json object
 * @param {object} options processing options for inference
 * @returns {string} the Concerto model
 */
declare function inferModelFile(defaultNamespace: string, defaultType: string, schema: object, options?: object): string;
