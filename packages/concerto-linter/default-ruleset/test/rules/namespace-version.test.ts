import { testRules } from '../test-rule';
import namespaceVersion from '../../src/namespace-version';
import { Spectral, Document } from '@stoplight/spectral-core';
import { Json as JsonParsers } from '@stoplight/spectral-parsers';

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

    test('should validate all models, not just the first one', async () => {
        // Construct a multi-model AST where the first model has a valid version
        // but the second model does not — this verifies the rule checks all models.
        const multiModelAST = {
            $class: 'concerto.metamodel@1.0.0.Models',
            models: [
                {
                    $class: 'concerto.metamodel@1.0.0.Model',
                    namespace: 'org.valid@1.0.0',
                    declarations: []
                },
                {
                    $class: 'concerto.metamodel@1.0.0.Model',
                    namespace: 'org.invalid',
                    declarations: []
                }
            ]
        };

        const spectral = new Spectral();
        spectral.setRuleset({
            rules: {
                'namespace-version': namespaceVersion,
            }
        });

        const document = new Document(JSON.stringify(multiModelAST), JsonParsers);
        const results = await spectral.run(document);

        expect(results).toHaveLength(1);
        expect(results[0].code).toBe('namespace-version');
        expect(results[0].message).toContain('org.invalid');
        expect(results[0].message).toContain('should specify a version');
    });
});
