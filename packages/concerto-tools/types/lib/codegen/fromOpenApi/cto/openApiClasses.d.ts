/**
 * An OpenApiDefinition visitable class.
 *
 * @class
 */
export class OpenApiDefinition extends Visitable {
    /**
     * @param {Object} body - the body.
     *
     */
    constructor(body: any);
    isOpenApiDefinition: boolean;
}
import { Visitable } from "../../fromJsonSchema/cto/jsonSchemaClasses.js";
