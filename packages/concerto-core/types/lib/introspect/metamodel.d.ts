/**
 * Create a metamodel manager (for validation against the metamodel)
 * @return {*} the metamodel manager
 */
export function newMetaModelManager(): any;
/**
 * Validate metamodel instance against the metamodel
 * @param {object} input - the metamodel instance in JSON
 * @return {object} the validated metamodel instance in JSON
 */
export function validateMetaModel(input: object): object;
/**
 * Import metamodel to a model manager
 * @param {object} metaModel - the metamodel
 * @param {boolean} [validate] - whether to perform validation
 * @return {object} the metamodel for this model manager
 */
export function modelManagerFromMetaModel(metaModel: object, validate?: boolean): object;
