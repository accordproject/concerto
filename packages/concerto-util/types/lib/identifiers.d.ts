/**
 * Function that attempts to normalize arbitrary strings, numbers or booleans
 * into valid Concerto identifiers
 *
 * @param {string|number|boolean} identifier - the input value
 * @param {number} [truncateLength] - Optionally length at which to truncate the identifier
 * @returns {string} - An identifier that meets the Concerto specification
 */
export function normalizeIdentifier(identifier: string | number | boolean, truncateLength?: number): string;
