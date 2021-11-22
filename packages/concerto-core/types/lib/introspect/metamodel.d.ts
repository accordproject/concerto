export = MetaModel;
/**
 * Class to work with the Concerto metamodel
 */
declare class MetaModel {
    /**
     * The metamodel itself, as a CTO string
     */
    static metaModelCto: string;
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
    * @return {object} the resolved metamodel
    */
    static resolveMetaModel(modelManager: object, metaModel: object): object;
    /**
    * Create metamodel for an enum property
    * @param {object} ast - the AST for the property
    * @return {object} the metamodel for this property
    */
    static enumPropertyToMetaModel(ast: object): object;
    /**
    * Create metamodel for a decorator argument
    * @param {object} ast - the AST for the decorator argument
    * @return {object} the metamodel for this decorator argument
    */
    static decoratorArgToMetaModel(ast: object): object;
    /**
    * Create metamodel for a decorator
    * @param {object} ast - the AST for the decorator
    * @return {object} the metamodel for this decorator
    */
    static decoratorToMetaModel(ast: object): object;
    /**
    * Create metamodel for a list of decorators
    * @param {object} ast - the AST for the decorators
    * @return {object} the metamodel for the decorators
    */
    static decoratorsToMetaModel(ast: object): object;
    /**
    * Create metamodel for a property
    * @param {object} ast - the AST for the property
    * @return {object} the metamodel for this property
    */
    static propertyToMetaModel(ast: object): object;
    /**
    * Create metamodel for a relationship
    * @param {object} ast - the AST for the relationtion
    * @return {object} the metamodel for this relationship
    */
    static relationshipToMetaModel(ast: object): object;
    /**
    * Create metamodel for an enum declaration
    * @param {object} ast - the AST for the enum declaration
    * @return {object} the metamodel for this enum declaration
    */
    static enumDeclToMetaModel(ast: object): object;
    /**
    * Create metamodel for a concept declaration
    * @param {object} ast - the AST for the concept declaration
    * @return {object} the metamodel for this concept declaration
    */
    static conceptDeclToMetaModel(ast: object): object;
    /**
    * Create metamodel for a declaration
    * @param {object} ast - the AST for the declaration
    * @return {object} the metamodel for this declaration
    */
    static declToMetaModel(ast: object): object;
    /**
    * Export metamodel from an AST
    * @param {object} ast - the AST for the model
    * @param {boolean} [validate] - whether to perform validation
    * @return {object} the metamodel for this model
    */
    static modelToMetaModel(ast: object, validate?: boolean): object;
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
    * Create decorator argument string from a metamodel
    * @param {object} mm - the metamodel
    * @return {string} the string for the decorator argument
    */
    static decoratorArgFromMetaModel(mm: object): string;
    /**
    * Create decorator string from a metamodel
    * @param {object} mm - the metamodel
    * @return {string} the string for the decorator
    */
    static decoratorFromMetaModel(mm: object): string;
    /**
    * Create decorators string from a metamodel
    * @param {object} mm - the metamodel
    * @param {string} prefix - indentation
    * @return {string} the string for the decorators
    */
    static decoratorsFromMetaModel(mm: object, prefix: string): string;
    /**
    * Create a property string from a metamodel
    * @param {object} mm - the metamodel
    * @return {string} the string for that property
    */
    static propertyFromMetaModel(mm: object): string;
    /**
    * Create a declaration string from a metamodel
    * @param {object} mm - the metamodel
    * @return {string} the string for that declaration
    */
    static declFromMetaModel(mm: object): string;
    /**
    * Create a model string from a metamodel
    * @param {object} metaModel - the metamodel
    * @param {boolean} [validate] - whether to perform validation
    * @return {string} the string for that model
    */
    static ctoFromMetaModel(metaModel: object, validate?: boolean): string;
    /**
    * Import metamodel to a model manager
    * @param {object} metaModel - the metamodel
    * @param {boolean} [validate] - whether to perform validation
    * @return {object} the metamodel for this model manager
    */
    static modelManagerFromMetaModel(metaModel: object, validate?: boolean): object;
    /**
    * Export metamodel from a model string
    * @param {string} model - the string for the model
    * @param {boolean} [validate] - whether to perform validation
    * @return {object} the metamodel for this model
    */
    static ctoToMetaModel(model: string, validate?: boolean): object;
    /**
    * Export metamodel from a model string and resolve names
    * @param {*} modelManager - the model manager
    * @param {string} model - the string for the model
    * @param {boolean} [validate] - whether to perform validation
    * @return {object} the metamodel for this model
    */
    static ctoToMetaModelAndResolve(modelManager: any, model: string, validate?: boolean): object;
}
