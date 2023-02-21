/**
 * Function that attempts to normalize arbitrary strings
 * into valid Concerto identifiers
 *
 * @param {string} identifier - the input value
 * @param {number} [truncateLength] - Length at which to truncate the identifier
 * @returns {string} - An identifier that meets the Concerto specification
 */
export function normalizeIdentifier(identifier: string, truncateLength?: number): string;
export const ID_REGEX: RegExp;
