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

    test('should not report violations for transitive inheritance hierarchies with concrete subclass', async () => {
        const results = await testRules({
            rules: {
                'abstract-must-subclassed': abstractMustSubclassed,
            }
        }, 'abstract-must-subclassed-transitive-valid.cto');
        expect(results).toHaveLength(0);
    });

    test('should not report violations for deep multi-level inheritance hierarchies with concrete subclass', async () => {
        const results = await testRules({
            rules: {
                'abstract-must-subclassed': abstractMustSubclassed,
            }
        }, 'abstract-must-subclassed-deep-valid.cto');
        expect(results).toHaveLength(0);
    });

    test('should report only un-subclassed branch in a branching hierarchy', async () => {
        const results = await testRules({
            rules: {
                'abstract-must-subclassed': abstractMustSubclassed,
            }
        }, 'abstract-must-subclassed-branching.cto');

        expect(results).toHaveLength(1);
        expect(results[0].code).toBe('abstract-must-subclassed');
        expect(results[0].message).toBe('Abstract declaration \'Mammal\' must have concrete subclasses');
    });

    test('should report all abstract declarations when no concrete descendant exists in multi-level hierarchy', async () => {
        const results = await testRules({
            rules: {
                'abstract-must-subclassed': abstractMustSubclassed,
            }
        }, 'abstract-must-subclassed-multi-invalid.cto');

        expect(results).toHaveLength(2);
        results.forEach(result => {
            expect(result.code).toBe('abstract-must-subclassed');
        });
        const messages = results.map(r => r.message);
        expect(messages).toContain('Abstract declaration \'A\' must have concrete subclasses');
        expect(messages).toContain('Abstract declaration \'B\' must have concrete subclasses');
    });
});
