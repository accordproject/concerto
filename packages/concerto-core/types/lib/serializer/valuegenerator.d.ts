export = ValueGeneratorFactory;
/**
 * Factory providing static methods to create ValueGenerator instances.
 * @private
 */
declare class ValueGeneratorFactory {
    /**
     * Create a value generator that supplies empty values.
     * @return {ValueGenerator} a value generator.
     */
    static empty(): ValueGenerator;
    /**
     * Create a value generator that supplies randomly generated sample values.
     * @return {ValueGenerator} a value generator.
     */
    static sample(): ValueGenerator;
}
