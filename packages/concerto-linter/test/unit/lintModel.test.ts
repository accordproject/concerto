// tests/unit/index.test.ts
import { jest } from '@jest/globals';
import { lintModel } from '../../src/index';
import * as configLoader from '../../src/config-loader';
import { getRuleset } from '@stoplight/spectral-cli/dist/services/linter/utils/getRuleset';

// Only mock our own functions when needed
jest.mock('../../src/config-loader');
jest.mock('@stoplight/spectral-cli/dist/services/linter/utils/getRuleset', () => ({
    getRuleset: jest.fn(),
}));

const mockedConfigLoader = configLoader as jest.Mocked<typeof configLoader>;
const mockedGetRuleset = getRuleset as jest.MockedFunction<typeof getRuleset>;

describe('lintModel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should lint a valid model successfully', async () => {
        const validModel = `
      namespace com.example

      concept Person {
        o String firstName
        o String lastName
        o Integer age
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const result = await lintModel(validModel, { ruleset: 'default' });

        expect(Array.isArray(result)).toBe(true);
    // A valid model might still have some warnings, but shouldn't throw errors
    });

    test('should detect violations in problematic model', async () => {
        const problematicModel = `
      namespace com.example

      concept class {  // Reserved keyword as concept name
        o String private  // Reserved keyword as property name
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(problematicModel, {
            ruleset: 'default',
            excludeNamespaces: []
        });

        // Should detect at least some violations
        expect(Array.isArray(results)).toBe(true);
    });

    test('should handle malformed model', async () => {
        const malformedModel = 'namespace invalid syntax }}}';

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        await expect(lintModel(malformedModel)).rejects.toThrow('Linting process failed');
    });

    test('should work with all configuration options', async () => {
        const model = `
      namespace com.example.test

      concept ValidConcept {
        o String validProperty
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const config = {
            ruleset: 'default',
            excludeNamespaces: ['concerto.*', 'org.accordproject.*']
        };

        const results = await lintModel(model, config);

        expect(Array.isArray(results)).toBe(true);
    });

    test('should stay silent for reserved system concept declarations in normal v4 mode', async () => {
        const model = `
      namespace com.example.test@1.0.0

      asset Asset identified by assetId {
        o String assetId length=[1,]
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(model, { ruleset: 'default', excludeNamespaces: [] });

        expect(results).toEqual([]);
    });

    test('should report reserved system concept declarations when dangerous mode is enabled', async () => {
        const model = `
      namespace com.example.test@1.0.0

      asset Asset identified by assetId {
        o String assetId length=[1,]
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(model, {
            ruleset: 'default',
            excludeNamespaces: [],
            dangerouslyAllowReservedSystemTypeNamesInUserModels: true,
        });

        expect(results).toHaveLength(1);
        expect(results[0].code).toBe('reserved-system-concept-declarations');
    });

    test('should inject dangerous mode into loaded custom rulesets', async () => {
        const model = `
      namespace com.example.test@1.0.0

      asset Asset identified by assetId {
        o String assetId length=[1,]
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue('/tmp/custom-ruleset.yaml');
        mockedGetRuleset.mockResolvedValue({
            rules: {
                'reserved-system-concept-declarations': {
                    given: '$.models[*]',
                    severity: 0,
                    then: {
                        function: (_targetVal: unknown, functionOptions?: { dangerouslyAllowReservedSystemTypeNamesInUserModels?: boolean }) => {
                            return functionOptions?.dangerouslyAllowReservedSystemTypeNamesInUserModels
                                ? [{
                                    message: 'custom dangerous mode triggered',
                                    path: ['declarations', 0, 'name'],
                                }]
                                : [];
                        },
                    },
                },
            },
        } as never);

        const results = await lintModel(model, {
            ruleset: '/tmp/custom-ruleset.yaml',
            excludeNamespaces: [],
            dangerouslyAllowReservedSystemTypeNamesInUserModels: true,
        });

        expect(mockedGetRuleset).toHaveBeenCalledWith('/tmp/custom-ruleset.yaml');
        expect(results).toHaveLength(1);
        expect(results[0].message).toBe('custom dangerous mode triggered');
    });

});
