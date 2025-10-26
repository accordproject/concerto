/**
 * FILE OVERVIEW:
 *   Purpose: Test the actual inheritance comparison bug fix
 *   Key Concepts: Tests the specific bug scenario described in issue #1067
 *   Module Type: Test Suite
 *   @ai_context: Tests that the inheritance bug is actually fixed
 */

import { ModelManager, ModelFile } from '@accordproject/concerto-core';
import { Compare } from '../../dist/compare';
import { defaultCompareConfig } from '../../dist/compare-config';
import { Parser } from '@accordproject/concerto-cto';

describe('Inheritance Bug Fix Tests', () => {
    let mm1: ModelManager;
    let mm2: ModelManager;
    let child1File: ModelFile;
    let child2File: ModelFile;
    let parentFile: ModelFile;

    // Exact scenario from the bug report
    const child1Cto = `namespace com.child.example@1.0.0

concept Child {
  o String aProperty optional
  o String bProperty
}`;

    const child2Cto = `namespace com.child.example@1.1.0

import com.parent.example@1.2.0.{ Parent }

concept Child extends Parent {
  o String bProperty
}`;

    const parentCto = `namespace com.parent.example@1.2.0

concept Parent {
  o String cProperty optional
  o String aProperty optional
}`;

    beforeEach(() => {
        // Parse CTO files
        const child1Ast = Parser.parse(child1Cto);
        const child2Ast = Parser.parse(child2Cto);
        const parentAst = Parser.parse(parentCto);

        // Create ModelManager instances (exactly as in bug report)
        mm1 = new ModelManager({strict: true});
        child1File = new ModelFile(mm1, child1Ast);
        mm1.addModelFile(child1File);

        mm2 = new ModelManager({strict: true});
        parentFile = new ModelFile(mm2, parentAst);
        child2File = new ModelFile(mm2, child2Ast);
        mm2.addModelFile(parentFile);
        mm2.addModelFile(child2File);
    });

    describe('Bug Reproduction', () => {
        it('should reproduce the original bug with default behavior', () => {
            const compare = new Compare(); // Default behavior
            const result = compare.compare(child1File, child2File);

            // This should reproduce the bug: aProperty reported as "removed"
            expect(result.result).toBe(3); // MAJOR
            expect(result.findings).toHaveLength(1);
            expect(result.findings[0].key).toBe('optional-property-removed');
            expect(result.findings[0].message).toContain('aProperty');
        });
    });

    describe('Bug Fix Verification', () => {
        it('should fix the bug with includeInherited: true', () => {
            const config = { ...defaultCompareConfig, includeInherited: true };
            const compare = new Compare(config);
            const result = compare.compare(child1File, child2File);

            // This should fix the bug: aProperty should NOT be reported as "removed"
            expect(result.result).toBe(1); // PATCH (not MAJOR)
            expect(result.findings).toHaveLength(1);
            expect(result.findings[0].key).toBe('optional-property-added');
            expect(result.findings[0].message).toContain('cProperty');
        });

        it('should show the difference between old and new behavior', () => {
            // Old behavior (buggy)
            const compareOld = new Compare();
            const resultOld = compareOld.compare(child1File, child2File);

            // New behavior (fixed)
            const config = { ...defaultCompareConfig, includeInherited: true };
            const compareNew = new Compare(config);
            const resultNew = compareNew.compare(child1File, child2File);

            // Results should be different
            expect(resultOld.result).toBe(3); // MAJOR (buggy)
            expect(resultNew.result).toBe(1); // PATCH (fixed)

            // Different findings
            expect(resultOld.findings[0].key).toBe('optional-property-removed');
            expect(resultNew.findings[0].key).toBe('optional-property-added');
        });
    });

    describe('Property Analysis', () => {
        it('should show property inheritance correctly', () => {
            // Child1 has both properties directly
            const child1Props = child1File.getAllDeclarations()[0].getOwnProperties().map(p => p.getName());
            expect(child1Props).toEqual(['aProperty', 'bProperty']);

            // Child2 has only bProperty directly
            const child2OwnProps = child2File.getAllDeclarations()[0].getOwnProperties().map(p => p.getName());
            expect(child2OwnProps).toEqual(['bProperty']);

            // Child2 has all properties including inherited
            const child2AllProps = child2File.getAllDeclarations()[0].getProperties().map(p => p.getName());
            expect(child2AllProps).toEqual(['bProperty', 'cProperty', 'aProperty']);
        });
    });
});
