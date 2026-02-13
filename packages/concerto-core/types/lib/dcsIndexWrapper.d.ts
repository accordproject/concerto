export = DcsIndexWrapper;
declare class DcsIndexWrapper {
    constructor(command: any, index: any);
    command: any;
    index: any;
    /**
     * Get the command
     * @return {*} the command
     */
    getCommand(): any;
    /**
     * Get the index
     * @return {number} the index
     */
    getIndex(): number;
}
