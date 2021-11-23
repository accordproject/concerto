export = ConfigMediator;
/**
 * Mediates beween the NPM config module and the codebase
 * Enables our isomorphic codebase to work in webpack
 *
 * @private
 */
declare class ConfigMediator {
    /**
     * Get a value with the 'name', giving back the acceptable 'init' value if the name is not present
     * @param {String} name key of config value to look up, this will have the defined prefix added to it
     * @param {Object} init if the config doesn't have the value (or can't be found for whatever reason) the default value to return
     *
     * @return {Object} supplied object or the init value if needed
     */
    static get(name: string, init: any): any;
}
