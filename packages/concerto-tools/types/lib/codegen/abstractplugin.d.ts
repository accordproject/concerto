export = AbstractPlugin;
/**
 * Simple plug-in class for code-generation. This lists functions that can be passed to extend the default code-generation behavior.
 */
declare class AbstractPlugin {
    /**
     * Additional imports to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} options  - the visitor options
     */
    addClassImports(clazz: ClassDeclaration, parameters: any, options: any): void;
    /**
     * Additional annotations to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} options  - the visitor options
     */
    addClassAnnotations(clazz: ClassDeclaration, parameters: any, options: any): void;
    /**
     * Additional methods to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} options  - the visitor options
     */
    addClassMethods(clazz: ClassDeclaration, parameters: any, options: any): void;
    /**
     * Additional annotations to generate in enums
     * @param {EnumDeclaration} enumDecl - the enum being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} options  - the visitor options
     */
    addEnumAnnotations(enumDecl: EnumDeclaration, parameters: any, options: any): void;
}
