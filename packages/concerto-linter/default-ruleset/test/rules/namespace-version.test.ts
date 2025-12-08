import { testRules } from '../test-rule';
import namespaceVersion from '../../src/namespace-version';

describe('Namespace Version Rule', () => {
    test('should not report any violations for namespaces with valid version', async () => {
        const results = await testRules({
            rules: {
                'namespace-version': namespaceVersion,
            }
        }, 'namespace-valid-version.cto');
        expect(results).toHaveLength(0);
    });

    test('should report a violation for namespaces without version', async () => {
        const results = await testRules({
            rules: {
                'namespace-version': namespaceVersion,
            }
        }, 'namespace-invalid-version.cto');
        expect(results).toHaveLength(1);
        expect(results[0].code).toBe('namespace-version');
        expect(results[0].message).toContain('should specify a version');
    });

    test('should not report violations when imports use wildcard semver selectors', async () => {
        const results = await testRules({
            rules: {
                'namespace-version': namespaceVersion,
            },
        }, 'namespace-wildcard-imports.cto');
        expect(results).toHaveLength(0);
    });
});
