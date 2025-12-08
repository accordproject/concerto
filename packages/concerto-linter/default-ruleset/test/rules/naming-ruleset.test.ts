import { testRules } from '../test-rule';
import pascalCaseDeclarations from '../../src/pascal-case-declarations';
import camelCaseProperties from '../../src/camel-case-properties';
import upperSnakeCaseEnumConst from '../../src/upper-snake-case-enum-const';
import pascalCaseDecorators from '../../src/pascal-case-decorators';

describe('PascalCase Declarations Rule', () => {
    test('should not report any violations for correctly named declarations', async () => {
        const results = await testRules({
            rules: {
                'pascal-case-declarations': pascalCaseDeclarations,
            }
        }, 'declarations-valid-PascalCase.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations for invalid declaration names', async () => {
        const results = await testRules({
            rules: {
                'pascal-case-declarations': pascalCaseDeclarations,
            }
        }, 'declarations-violate-PascalCase.cto');

        // Check that we have the expected number of violations
        expect(results.length).toBeGreaterThan(0);
        expect(results).toHaveLength(7);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('pascal-case-declarations');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('should be PascalCase');
    });
});

describe('CamelCase Properties Rule', () => {
    test('should not report any violations for correctly named properties', async () => {
        const results = await testRules({
            rules: {
                'camel-case-properties': camelCaseProperties,
            }
        }, 'properties-valid-camelCase.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations for invalid property names', async () => {
        const results = await testRules({
            rules: {
                'camel-case-properties': camelCaseProperties,
            }
        }, 'properties-violate-camelCase.cto');

        // Check that we have the expected number of violations
        expect(results.length).toBeGreaterThan(0);
        expect(results).toHaveLength(6);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('camel-case-properties');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('should be camelCase');
    });
});

describe('UPPER_SNAKE_CASE Enum Constants Rule', () => {
    test('should not report any violations for correctly named enum constants', async () => {
        const results = await testRules({
            rules: {
                'upper-snake-case-enum-constants': upperSnakeCaseEnumConst,
            }
        }, 'ENUM_Constans-vaild.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations for invalid enum constant names', async () => {
        const results = await testRules({
            rules: {
                'upper-snake-case-enum-constants': upperSnakeCaseEnumConst,
            }
        }, 'ENUM_Constans-invaild.cto');

        // Check that we have the expected number of violations
        expect(results.length).toBeGreaterThan(0);
        expect(results).toHaveLength(3);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('upper-snake-case-enum-constants');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('should be UPPER_SNAKE_CASE');
    });
});

describe('PascalCase Decorators Rule', () => {
    test('should not report any violations for correctly named decorators', async () => {
        const results = await testRules({
            rules: {
                'pascal-case-decorators': pascalCaseDecorators,
            }
        }, 'decorators-valid-PascalCase.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations for invalid decorator names', async () => {
        const results = await testRules({
            rules: {
                'pascal-case-decorators': pascalCaseDecorators,
            }
        }, 'decorators-violate-PascalCase.cto');

        // Check that we have the expected number of violations
        expect(results.length).toBeGreaterThan(0);
        expect(results).toHaveLength(3);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('pascal-case-decorators');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('should be PascalCase');
    });
});