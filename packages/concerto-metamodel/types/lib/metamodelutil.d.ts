/**
 * The metamodel itself, as an AST.
 * @type unknown
 */
export const metaModelAst: unknown;
/**
 * The metamodel itself, as a CTO string
 */
export const metaModelCto: "namespace concerto.metamodel\n\nconcept Position {\n  o Integer line\n  o Integer column\n  o Integer offset\n}\nconcept Range {\n  o Position start\n  o Position end\n  o String source optional\n}\n\nconcept TypeIdentifier {\n  o String name\n  o String namespace optional\n}\n\nabstract concept DecoratorLiteral {\n  o Range location optional\n}\n\nconcept DecoratorString extends DecoratorLiteral {\n  o String value\n}\n\nconcept DecoratorNumber extends DecoratorLiteral {\n  o Double value\n}\n\nconcept DecoratorBoolean extends DecoratorLiteral {\n  o Boolean value\n}\n\nconcept DecoratorTypeReference extends DecoratorLiteral {\n  o TypeIdentifier type\n  o Boolean isArray default=false\n}\n\nconcept Decorator {\n  o String name\n  o DecoratorLiteral[] arguments optional\n  o Range location optional\n}\n\nconcept Identified {\n}\n\nconcept IdentifiedBy extends Identified {\n  o String name\n}\n\nabstract concept Declaration {\n  o String name regex=/^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*$/u\n  o Decorator[] decorators optional\n  o Range location optional\n}\n\nconcept EnumDeclaration extends Declaration {\n  o EnumProperty[] properties\n}\n\nconcept EnumProperty {\n  o String name regex=/^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*$/u\n  o Decorator[] decorators optional\n  o Range location optional\n}\n\nconcept ConceptDeclaration extends Declaration {\n  o Boolean isAbstract default=false\n  o Identified identified optional\n  o TypeIdentifier superType optional\n  o Property[] properties\n}\n\nconcept AssetDeclaration extends ConceptDeclaration {\n}\n\nconcept ParticipantDeclaration extends ConceptDeclaration {\n}\n\nconcept TransactionDeclaration extends ConceptDeclaration {\n}\n\nconcept EventDeclaration extends ConceptDeclaration {\n}\n\nabstract concept Property {\n  o String name regex=/^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*$/u\n  o Boolean isArray default=false\n  o Boolean isOptional default=false\n  o Decorator[] decorators optional\n  o Range location optional\n}\n\nconcept RelationshipProperty extends Property {\n  o TypeIdentifier type\n}\n\nconcept ObjectProperty extends Property {\n  o String defaultValue optional\n  o TypeIdentifier type\n}\n\nconcept BooleanProperty extends Property {\n  o Boolean defaultValue optional\n}\n\nconcept DateTimeProperty extends Property {\n}\n\nconcept StringProperty extends Property {\n  o String defaultValue optional\n  o StringRegexValidator validator optional\n}\n\nconcept StringRegexValidator {\n  o String pattern\n  o String flags\n}\n\nconcept DoubleProperty extends Property {\n  o Double defaultValue optional\n  o DoubleDomainValidator validator optional\n}\n\nconcept DoubleDomainValidator {\n  o Double lower optional\n  o Double upper optional\n}\n\nconcept IntegerProperty extends Property {\n  o Integer defaultValue optional\n  o IntegerDomainValidator validator optional\n}\n\nconcept IntegerDomainValidator {\n  o Integer lower optional\n  o Integer upper optional\n}\n\nconcept LongProperty extends Property {\n  o Long defaultValue optional\n  o LongDomainValidator validator optional\n}\n\nconcept LongDomainValidator {\n  o Long lower optional\n  o Long upper optional\n}\n\nabstract concept Import {\n  o String namespace\n  o String uri optional\n}\n\nconcept ImportAll extends Import {\n}\n\nconcept ImportType extends Import {\n  o String name\n}\n\nconcept Model {\n  o String namespace\n  o String sourceUri optional\n  o String concertoVersion optional\n  o Import[] imports optional\n  o Declaration[] declarations optional\n}\n\nconcept Models {\n  o Model[] models\n}\n";
/**
 * Resolve the namespace for names in the metamodel
 * @param {*} priorModels - known models
 * @param {object} metaModel - the MetaModel
 * @return {object} the resolved metamodel
 */
export function resolveLocalNames(priorModels: any, metaModel: object): object;
/**
 * Resolve the namespace for names in the metamodel
 * @param {*} allModels - known models
 * @return {object} the resolved metamodel
 */
export function resolveLocalNamesForAll(allModels: any): object;
/**
 * Return the fully qualified name for an import
 * @param {object} imp - the import
 * @return {string[]} - the fully qualified names for that import
 * @private
 */
export function importFullyQualifiedNames(imp: object): string[];
/**
 * Returns an object that maps from the import declarations to the URIs specified
 * @param {*} ast - the model ast
 * @return {Object} keys are import declarations, values are URIs
 * @private
 */
export function getExternalImports(ast: any): any;
