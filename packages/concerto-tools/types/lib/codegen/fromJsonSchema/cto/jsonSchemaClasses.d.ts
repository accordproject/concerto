/**
 * A visitable class to be used by the JsonSchemaVisitor.
 *
 * @class
 */
export class Visitable {
    /**
     * @param {Object} body - the body.
     * @param {String[]} path - the location inside the JSON Schema model.
     *
     */
    constructor(body: any, path: string[]);
    body: any;
    path: string[];
    /**
     * @param {Object} visitor - the JSON Schema model visitor.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the result of visiting or undefined.
     */
    accept(visitor: any, parameters: any): any;
}
/**
 * A local reference visitable class.
 *
 * @class
 */
export class LocalReference extends Visitable {
    isLocalReference: boolean;
}
/**
 * A reference visitable class.
 *
 * @class
 */
export class Reference extends Visitable {
    isReference: boolean;
}
/**
 * An array property visitable class.
 *
 * @class
 */
export class ArrayProperty extends Visitable {
    isArrayProperty: boolean;
}
/**
 * A property visitable class.
 *
 * @class
 */
export class Property extends Visitable {
    isProperty: boolean;
}
/**
 * A properties visitable class.
 *
 * @class
 */
export class Properties extends Visitable {
    isProperties: boolean;
}
/**
 * A non-enum definition visitable class.
 *
 * @class
 */
export class NonEnumDefinition extends Visitable {
    isNonEnumDefinition: boolean;
}
/**
 * An enum definition visitable class.
 *
 * @class
 */
export class EnumDefinition extends Visitable {
    isEnumDefinition: boolean;
}
/**
 * An definition visitable class.
 *
 * @class
 */
export class Definition extends Visitable {
    isDefinition: boolean;
}
/**
 * A definitions visitable class.
 *
 * @class
 */
export class Definitions extends Visitable {
    isDefinitions: boolean;
}
/**
 * A JsonSchemaModel visitable class.
 *
 * @class
 */
export class JsonSchemaModel extends Visitable {
    /**
     * @param {Object} body - the body.
     *
     */
    constructor(body: any);
    isJsonSchemaModel: boolean;
}
