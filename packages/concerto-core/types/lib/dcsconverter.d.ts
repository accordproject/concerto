/**
 * converts DCS JSON to YAML string
 * @param {object} dcsJson the DCS JSON as parsed object
 * @returns {string} the DCS YAML string
 */
export function jsonToYaml(dcsJson: object): string;
/**
 * converts DCS YAML string to JSON format
 * @param {string} yamlString the YAML string to convert
 * @returns {object} the DCS JSON
 */
export function yamlToJson(yamlString: string): object;
