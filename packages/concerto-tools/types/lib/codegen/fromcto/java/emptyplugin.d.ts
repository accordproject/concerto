export = EmptyPlugin;
/**
 * Simple plug-in class for code-generation. This lists functions that can be passed to extend the default code-generation behavior.
 */
declare class EmptyPlugin extends AbstractPlugin {
    /**
     * Additional imports to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     */
    addClassImports(clazz: ClassDeclaration, parameters: any): void;
    /**
     * Additional annotations to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     */
    addClassAnnotations(clazz: ClassDeclaration, parameters: any): void;
    /**
     * Additional methods to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     */
    addClassMethods(clazz: ClassDeclaration, parameters: any): void;
    /**
     * Additional annotations to generate in enums
     * @param {EnumDeclaration} enumDecl - the enum being visited
     * @param {Object} parameters  - the parameter
     */
    addEnumAnnotations(enumDecl: EnumDeclaration, parameters: any): void;
}
import AbstractPlugin = require("../../abstractplugin");
