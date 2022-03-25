export = EnumDeclaration;
/**
 * EnumDeclaration defines an enumeration of static values.
 *
 * @extends ClassDeclaration
 * @see See {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class EnumDeclaration extends ClassDeclaration {
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
}
import ClassDeclaration = require("./classdeclaration");
