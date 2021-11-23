export = NumberValidator;
/**
 * A Validator to enforce that non null numeric values are between two values.
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class NumberValidator extends Validator {
    lowerBound: any;
    upperBound: any;
    /**
     * Returns the lower bound for this validator, or null if not specified
     * @returns {number} the lower bound or null
     */
    getLowerBound(): number;
    /**
     * Returns the upper bound for this validator, or null if not specified
     * @returns {number} the upper bound or null
     */
    getUpperBound(): number;
}
import Validator = require("./validator");
