import { testRules } from '../test-rule';
import abstractMustSubclassed from '../../src/abstract-must-subclassed';

describe('Abstract Must Be Subclassed Rule', () => {
    test('should not report any violations when all abstract declarations have concrete subclasses', async () => {
        const results = await testRules({
            rules: {
                'abstract-must-subclassed': abstractMustSubclassed,
            }
        }, 'abstract-must-subclassed-valid.cto');
        expect(results).toHaveLength(0);
    });

    test('should report violations when abstract declarations have no concrete subclasses', async () => {
        const results = await testRules({
            rules: {
                'abstract-must-subclassed': abstractMustSubclassed,
            }
        }, 'abstract-must-subclassed-invalid.cto');

        // We expect multiple violations - one for each abstract declaration without concrete subclass
        expect(results.length).toBeGreaterThan(0);

        // Check that the rule code is correct
        results.forEach(result => {
            expect(result.code).toBe('abstract-must-subclassed');
        });

        // Check that the message contains the expected text
        const messageText = results.map(r => r.message).join(' ');
        expect(messageText).toContain('must have concrete subclasses');
    });
});
