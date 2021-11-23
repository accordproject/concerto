export = Globalize;
/**
 * Dummy globalize replacement.
 * @param {string} locale The locale.
 * @return {Object} A mock globalize instance.
 * @private
 */
declare function Globalize(locale: string): any;
declare namespace Globalize {
    export { messageFormatter };
    export { formatMessage };
}
/**
 * Dummy globalize replacement.
 * @param {string} message The message.
 * @return {function} A function for formatting the message.
 * @private
 */
declare function messageFormatter(message: string): Function;
/**
 * Dummy globalize replacement.
 * @param {string} message The message.
 * @return {function} The formatted message.
 * @private
 */
declare function formatMessage(message: string): Function;
