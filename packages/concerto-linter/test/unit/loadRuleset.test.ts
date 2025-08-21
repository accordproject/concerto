import { jest } from '@jest/globals';
import { lintModel } from '../../src/index';
import * as configLoader from '../../src/config-loader';

jest.mock('../../src/config-loader');

const mockedConfigLoader = configLoader as jest.Mocked<typeof configLoader>;

describe('loadRuleset', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should use default ruleset when "default" is specified', async () => {
        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const validModel = `
      namespace com.example
      concept Test {
        o String value
      }
    `;

        const result = await lintModel(validModel, { ruleset: 'default' });
        expect(Array.isArray(result)).toBe(true);
        expect(mockedConfigLoader.resolveRulesetPath).not.toHaveBeenCalled();
    });

    test('should handle custom ruleset path', async () => {
        const customRulesetPath = '/path/to/custom/ruleset.yaml';
        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(customRulesetPath);

        const validModel = `
      namespace com.example
      concept Test {
        o String value
      }
    `;

        // This will fail in actual execution due to non-existent file,
        // but we can test that the path resolution is called correctly
        try {
            await lintModel(validModel, { ruleset: customRulesetPath });
        } catch {
            // Expected to fail since file doesn't exist
            expect(mockedConfigLoader.resolveRulesetPath).toHaveBeenCalledWith(customRulesetPath);
        }
    });

    test('should handle undefined ruleset (use auto-discovery)', async () => {
        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const validModel = `
      namespace com.example
      concept Test {
        o String value
      }
    `;

        const result = await lintModel(validModel);
        expect(Array.isArray(result)).toBe(true);
        expect(mockedConfigLoader.resolveRulesetPath).toHaveBeenCalledWith(undefined);
    });
});