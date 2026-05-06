import { testRules } from '../test-rule';
import noDuplicateProperties from '../../src/no-duplicate-properties';

describe('No Duplicate Properties Rule', () => {
    test('should not report any violations when all properties are unique', async () => {
        const results = await testRules({
            rules: {
                'no-duplicate-properties': noDuplicateProperties,
            }
        }, 'no-duplicate-properties-valid.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations when declarations have duplicate properties', async () => {
        const results = await testRules({
            rules: {
                'no-duplicate-properties': noDuplicateProperties,
            }
        }, 'no-duplicate-properties-invalid.cto');

        // We expect at least one violation for the duplicate property
        expect(results.length).toBeGreaterThan(0);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('no-duplicate-properties');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('duplicate property');
        expect(messageText).toContain('orderId');
    });
});
