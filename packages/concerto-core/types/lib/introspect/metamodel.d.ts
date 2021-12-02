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
     * Create a name resolution table
     * @param {*} modelManager - the model manager
     * @param {object} metaModel - the metamodel (JSON)
     * @return {object} mapping from a name to its namespace
     */
    static createNameTable(modelManager: any, metaModel: object): object;
    /**
     * Resolve a name using the name table
     * @param {string} name - the name of the type to resolve
     * @param {object} table - the name table
     * @return {string} the namespace for that name
     */
    static resolveName(name: string, table: object): string;
    /**
     * Name resolution for metamodel
     * @param {object} metaModel - the metamodel (JSON)
     * @param {object} table - the name table
     * @return {object} the metamodel with fully qualified names
     */
    static resolveTypeNames(metaModel: object, table: object): object;
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
