import { testRules } from '../test-rule';
import noReservedKeywords from '../../src/no-reserved-keywords';

describe('No Reserved Keywords Rule', () => {
    test('should not report any violations when no reserved keywords are used', async () => {
        const results = await testRules({
            rules: {
                'no-reserved-keywords': noReservedKeywords,
            }
        }, 'no-reserved-keywords-valid.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations when reserved keywords are used', async () => {
        const results = await testRules({
            rules: {
                'no-reserved-keywords': noReservedKeywords,
            }
        }, 'no-reserved-keywords-invalid.cto');

        // We expect multiple violations - for declaration names and property names
        expect(results.length).toBeGreaterThan(0);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('no-reserved-keywords');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('is a reserved keyword');
    });
});
