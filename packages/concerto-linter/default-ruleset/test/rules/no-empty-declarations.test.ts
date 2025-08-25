import { testRules } from '../test-rule';
import noEmptyDeclarations from '../../src/no-empty-declarations';

describe('No Empty Declarations Rule', () => {
    test('should not report any violations when all declarations have properties', async () => {
        const results = await testRules({
            rules: {
                'no-empty-declarations': noEmptyDeclarations,
            }
        }, 'no-empty-declarations-valid.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations when declarations are empty', async () => {
        const results = await testRules({
            rules: {
                'no-empty-declarations': noEmptyDeclarations,
            }
        }, 'no-empty-declarations-invalid.cto');

        // We expect multiple violations - one for each empty declaration
        expect(results.length).toBeGreaterThan(0);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('no-empty-declarations');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('should not be empty');
    });
});
