export = MetaModel;
/**
 * Class to work with the Concerto metamodel
 */
declare class MetaModel {
    /**
     * Returns the metamodel CTO
     * @returns {string} the metamodel as a CTO string
     */
    static getMetaModelCto(): string;
    /**
     * Create a metamodel manager (for validation against the metamodel)
     * @return {*} the metamodel manager
     */
    static createMetaModelManager(): any;
    /**
     * Validate against the metamodel
     * @param {object} input - the metamodel in JSON
     * @return {object} the validated metamodel in JSON
     */
    static validateMetaModel(input: object): object;
    /**
     * Resolve the namespace for names in the metamodel
     * @param {object} modelManager - the ModelManager
     * @param {object} metaModel - the MetaModel
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the resolved metamodel
     */
    static resolveMetaModel(modelManager: object, metaModel: object, validate?: boolean): object;
    /**
     * Export metamodel from a model file
     * @param {object} modelFile - the ModelFile
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model
     */
    static modelFileToMetaModel(modelFile: object, validate?: boolean): object;
    /**
     * Export metamodel from a model manager
     * @param {object} modelManager - the ModelManager
     * @param {boolean} [resolve] - whether to resolve names
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model manager
     */
    static modelManagerToMetaModel(modelManager: object, resolve?: boolean, validate?: boolean): object;
    /**
     * Import metamodel to a model manager
     * @param {object} metaModel - the metamodel
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model manager
     */
    static modelManagerFromMetaModel(metaModel: object, validate?: boolean): object;
}
