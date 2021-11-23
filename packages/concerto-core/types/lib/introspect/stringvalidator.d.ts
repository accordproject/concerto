export = StringValidator;
/**
 * A Validator to enforce that a string matches a regex
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class StringValidator extends Validator {
    regex: RegExp;
    /**
     * Returns the RegExp object associated with the string validator
     * @returns {RegExp} the RegExp object
     */
    getRegex(): RegExp;
}
import Validator = require("./validator");
