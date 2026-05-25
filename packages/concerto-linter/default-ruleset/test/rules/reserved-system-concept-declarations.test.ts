import reservedSystemConceptDeclarations from '../../src/reserved-system-concept-declarations';
import { testRules } from '../test-rule';

function createRule(dangerouslyAllowReservedSystemTypeNamesInUserModels = false) {
    const ruleFunction = reservedSystemConceptDeclarations.then.function;
    return {
        rules: {
            'reserved-system-concept-declarations': {
                ...reservedSystemConceptDeclarations,
                then: {
                    function: (targetVal: unknown, _options: unknown, context: unknown) => ruleFunction(
                        targetVal,
                        { dangerouslyAllowReservedSystemTypeNamesInUserModels },
                        context as never
                    ),
                },
            },
        },
    };
}

describe('Reserved System Concept Declarations Rule', () => {
    test('should report violations for v3 models with reserved system concept declarations', async () => {
        const results = await testRules(
            createRule(),
            'reserved-system-concept-declarations-v3-invalid.cto'
        );

        expect(results).toHaveLength(2);
        results.forEach(result => {
            expect(result.code).toBe('reserved-system-concept-declarations');
            expect(result.message).toContain('collides with a reserved Concerto system concept');
        });
    });

    test('should report violations for legacy models when concertoVersion metadata is absent', async () => {
        const results = await testRules(
            createRule(),
            'reserved-system-concept-declarations-legacy-invalid.cto'
        );

        expect(results).toHaveLength(1);
        expect(results[0].code).toBe('reserved-system-concept-declarations');
    });

    test('should stay silent for normal v4 models when dangerous mode is disabled', async () => {
        const results = await testRules(
            createRule(),
            'reserved-system-concept-declarations-v4-invalid.cto'
        );

        expect(results).toHaveLength(0);
    });

    test('should report one violation per reserved declaration when dangerous mode is enabled in v4', async () => {
        const results = await testRules(
            createRule(true),
            'reserved-system-concept-declarations-v4-invalid.cto'
        );

        expect(results).toHaveLength(2);
        results.forEach(result => {
            expect(result.code).toBe('reserved-system-concept-declarations');
        });
    });

    test('should not report non-reserved declarations', async () => {
        const results = await testRules(
            createRule(true),
            'reserved-system-concept-declarations-v4-valid.cto'
        );

        expect(results).toHaveLength(0);
    });
});
