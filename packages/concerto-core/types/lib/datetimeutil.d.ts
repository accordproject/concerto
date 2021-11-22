/**
 * Ensures there is a proper current time
 *
 * @param {string} [currentTime] - the definition of 'now'
 * @param {number} [utcOffset] - UTC Offset for this execution
 * @returns {object} if valid, the dayjs object for the current time
 */
export function setCurrentTime(currentTime?: string, utcOffset?: number): object;
