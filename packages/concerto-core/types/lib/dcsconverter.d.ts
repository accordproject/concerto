/**
 * converts DCS JSON string or object to YAML string
 * @param {string|object} dcsJson the DCS JSON as string or parsed object
 * @returns {string} the DCS YAML string
 * @throws {Error} if the input is not a valid DCS JSON
 */
export function jsonToYaml(dcsJson: string | object): string;
