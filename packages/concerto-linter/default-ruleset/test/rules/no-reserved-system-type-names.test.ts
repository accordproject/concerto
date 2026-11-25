import { testRules } from '../test-rule';
import noReservedSystemTypeNames from '../../src/no-reserved-system-type-names';
import concertoRuleset from '../../src/ruleset-main';

describe('No Reserved System Type Names Rule', () => {
    const ruleset = {
        rules: {
            'no-reserved-system-type-names': noReservedSystemTypeNames,
        }
    };

    test('should report every declaration named after a system type', async () => {
        const results = await testRules(ruleset, 'no-reserved-system-type-names-invalid.cto');

        expect(results.map(r => r.path.join('.'))).toEqual([
            'models.0.declarations.0.name',
            'models.0.declarations.1.name',
            'models.0.declarations.2.name',
            'models.0.declarations.3.name',
            'models.0.declarations.4.name',
        ]);
        results.forEach(result => {
            expect(result.code).toBe('no-reserved-system-type-names');
            expect(result.severity).toBe(0);
        });
    });

    test('should explain the clash and how to fix it', async () => {
        const results = await testRules(ruleset, 'no-reserved-system-type-names-invalid.cto');

        expect(results[1].message).toContain('Declaration "Asset" clashes with the Concerto system type concerto@1.0.0.Asset');
        expect(results[1].message).toContain('dangerouslyAllowReservedSystemTypeNamesInUserModels');
        expect(results[1].message).toContain('Rename the declaration, for example to "MyAsset"');
    });

    test('should not report similar names, properties or enum values', async () => {
        const results = await testRules(ruleset, 'no-reserved-system-type-names-valid.cto');
        expect(results).toHaveLength(0);
    });

    test('should report a system type name once with the default ruleset', async () => {
        const results = await testRules(concertoRuleset, 'no-reserved-keywords-system-type-names.cto');
        const declarationName = results.filter(r => r.path.join('.') === 'models.0.declarations.0.name');

        expect(declarationName.map(r => r.code)).toEqual(['no-reserved-system-type-names']);
    });
});
