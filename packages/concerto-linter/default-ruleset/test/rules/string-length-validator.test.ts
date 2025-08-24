import { testRules } from '../test-rule';
import stringLengthValidator from '../../src/string-length-validator';

describe('String Length Validator Rule', () => {
    test('should not report any violations when all strings have length validators', async () => {
        const results = await testRules({
            rules: {
                'string-length-validator': stringLengthValidator,
            }
        }, 'string-length-validator-valid.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations when strings are missing length validators', async () => {
        const results = await testRules({
            rules: {
                'string-length-validator': stringLengthValidator,
            }
        }, 'string-length-validator-invalid.cto');

        // We expect multiple violations - one for each string without a length validator
        expect(results.length).toBeGreaterThan(0);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('string-length-validator');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('must have a length validator');
    });
});
