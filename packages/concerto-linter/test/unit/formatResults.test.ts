// tests/unit/index.test.ts
import { jest } from '@jest/globals';
import { lintModel } from '../../src/index';
import * as configLoader from '../../src/config-loader';

// Only mock our own functions when needed
jest.mock('../../src/config-loader');

const mockedConfigLoader = configLoader as jest.Mocked<typeof configLoader>;


describe('formatResults', () => {
    test('should format spectral results correctly', async () => {
    // Create a model that will likely trigger some linting results
        const modelWithIssues = `
      namespace com.example
      
      concept class {  // 'class' is a reserved keyword
        o String value
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(modelWithIssues, {
            ruleset: 'default',
            excludeNamespaces: [] // Don't exclude anything to see all results
        });

        if (results.length > 0) {
            const result = results[0];
            expect(result).toHaveProperty('code');
            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('severity');
            expect(result).toHaveProperty('path');
            expect(result).toHaveProperty('namespace');
            expect(typeof result.code).toBe('string');
            expect(typeof result.message).toBe('string');
            expect(['error', 'warning', 'info', 'hint']).toContain(result.severity);
            expect(Array.isArray(result.path)).toBe(true);
            expect(typeof result.namespace).toBe('string');
        }
    });

    test('should exclude specified namespaces', async () => {
        const modelWithMultipleNamespaces = `
      namespace concerto.test
      
      concept TestConcept {
        o String value
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(modelWithMultipleNamespaces, {
            ruleset: 'default',
            excludeNamespaces: ['concerto.*']
        });

        // All results should be filtered out due to namespace exclusion
        results.forEach(result => {
            expect(result.namespace).not.toMatch(/^concerto\./);
        });
    });

    test('should handle wildcard exclusion patterns', async () => {
        const model = `
      namespace org.accordproject.test
      
      concept TestConcept {
        o String value
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(model, {
            ruleset: 'default',
            excludeNamespaces: ['org.accordproject.*']
        });

        results.forEach(result => {
            expect(result.namespace).not.toMatch(/^org\.accordproject\./);
        });
    });

    test('should handle exact namespace exclusion', async () => {
        const model = `
      namespace exact.match
      
      concept TestConcept {
        o String value
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(model, {
            ruleset: 'default',
            excludeNamespaces: ['exact.match']
        });

        results.forEach(result => {
            expect(result.namespace).not.toBe('exact.match');
        });
    });

    test('should handle string exclusion pattern', async () => {
        const model = `
      namespace test.namespace
      
      concept TestConcept {
        o String value
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(model, {
            ruleset: 'default',
            excludeNamespaces: 'test.*'
        });

        results.forEach(result => {
            expect(result.namespace).not.toMatch(/^test\./);
        });
    });

    test('should use default exclusion patterns when none specified', async () => {
        const concertoModel = `
      namespace concerto.test
      
      concept TestConcept {
        o String value
      }
    `;

        mockedConfigLoader.resolveRulesetPath.mockResolvedValue(null);

        const results = await lintModel(concertoModel, { ruleset: 'default' });

        // Default exclusions should filter out concerto.* namespaces
        results.forEach(result => {
            expect(result.namespace).not.toMatch(/^concerto\./);
            expect(result.namespace).not.toMatch(/^org\.accordproject\./);
        });
    });
});
