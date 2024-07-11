/**
 * Emits DeprecationWaring to stderr only once and can be caught using an warning event listener as well, please define the code
 * and document the deprecation code on https://concerto.accordproject.org/deprecation
 * @param {string} message - message of the deprecation warning
 * @param {string} type - type of the deprecation warning
 * @param {string} code - code of the deprecation warning
 * @param {string} detail - detail of the deprecation warning
 */
export function printDeprecationWarning(message: string, type: string, code: string, detail: string): void;
