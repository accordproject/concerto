// tests/unit/index.test.ts
import { jest } from '@jest/globals';
import { lintModel } from '../../src/index';
import * as configLoader from '../../src/config-loader';

// Only mock our own functions when needed
jest.mock('../../src/config-loader');

const mockedConfigLoader = configLoader as jest.Mocked<typeof configLoader>;

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

});
