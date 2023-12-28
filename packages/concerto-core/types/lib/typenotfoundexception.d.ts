export = TypeNotFoundException;
/**
 * Error thrown when a Concerto type does not exist.
 * @extends BaseException
 * @see see {@link BaseException}
 * @class
 * @memberof module:concerto-core
 */
declare class TypeNotFoundException extends BaseException {
    typeName: string;
    /**
     * Get the name of the type that was not found.
     * @returns {string} fully qualified type name.
     */
    getTypeName(): string;
}
import { BaseException } from "@accordproject/concerto-util";
