import { CompareConfig, CompareConfigBuilder, CompareResult } from '../../src/compare-config';

describe('CompareConfigBuilder', () => {
    it('Should start with empty config', () => {
        const builder = new CompareConfigBuilder();

        const actual = builder.build();

        expect(actual.comparerFactories.length).toEqual(0);
        expect(Object.keys(actual.rules).length).toEqual(0);
    });

    it('Should add default config with `default`', () => {
        const builder = new CompareConfigBuilder();

        const actual = builder.default().build();
        expect(actual.comparerFactories.length).toEqual(14);
        expect(Object.keys(actual.rules).length).toEqual(29);
        expect(actual.rules['class-declaration-added']).toEqual(CompareResult.MINOR);
        expect(actual.rules['optional-property-added']).toEqual(CompareResult.PATCH);
        expect(actual.rules['map-value-type-changed']).toEqual(CompareResult.MAJOR);
    });

    it('Should extend config', () => {
        const newRules = {
            'a-new-rule': CompareResult.MAJOR
        };
        const toExtend: CompareConfig = {
            comparerFactories: [
                () => ({}),
            ],
            rules: newRules
        };
        const builder = new CompareConfigBuilder();

        const actual = builder.default().extend(toExtend).build();

        expect(actual.comparerFactories.length).toEqual(15);
        expect(Object.keys(actual.rules).length).toEqual(30);
        expect(actual.rules['a-new-rule']).toEqual(CompareResult.MAJOR);
    });

    it('Should add a new comparer factory', () => {
        const builder = new CompareConfigBuilder();

        const actual = builder.default().addComparerFactory(() => ({})).build();

        expect(actual.comparerFactories.length).toEqual(15);
        expect(Object.keys(actual.rules).length).toEqual(29);
    });

    it('Should add a new rule', () => {
        const builder = new CompareConfigBuilder();

        const actual = builder.default().addRule('a-new-rule', CompareResult.MAJOR).build();

        expect(actual.comparerFactories.length).toEqual(14);
        expect(Object.keys(actual.rules).length).toEqual(30);
        expect(actual.rules['a-new-rule']).toEqual(CompareResult.MAJOR);
    });

    it('Should remove an existing rule', () => {
        const builder = new CompareConfigBuilder();

        const actual = builder.default().removeRule('optional-property-added').build();

        expect(actual.comparerFactories.length).toEqual(14);
        expect(Object.keys(actual.rules).length).toEqual(28);
        expect(actual.rules['optional-property-added']).toBeFalsy();
    });

    it('Should throw while removing a rule that does not exist', () => {
        const builder = new CompareConfigBuilder();
        expect(() => builder.default().removeRule('does-not-exist')).toThrow('ruleKey \'does-not-exist\' does not exist');
    });
});
