/*
 * Validation test for Issue #1023
 * Checks for:
 * 1. Duplicate imports from the same namespace.
 * 2. Name conflicts between local declarations and imported types.
 */

const ModelManager = require('../lib/modelmanager');

test('Issue #1023: Should throw error for duplicate namespace imports', () => {
    const mm = new ModelManager();

    // 1. Define the external file
    const importedCTO = `
    namespace org.external.types
    enum Type { o VALUE }
    enum AnotherType { o VALUE }
    `;

    // 2. Define the bad file (imports the same namespace twice)
    const badCTO = `
    namespace org.example.bad
    import org.external.types.Type
    import org.external.types.AnotherType 
    
    enum Thing {
      o ISSUE
    }
    `;

    mm.addCTOModel(importedCTO, 'imported.cto');
    mm.addCTOModel(badCTO, 'bad.cto');

    // Should throw error
    expect(() => {
        mm.validateModelFiles();
    }).toThrow(/duplicate import from namespace/); 
});

test('Issue #1023: Should throw error when local declaration conflicts with imported type', () => {
    const mm = new ModelManager();

    // 1. Define the external file
    const importedCTO = `
    namespace org.external.types
    enum Type { o VALUE }
    `;

    // 2. Define the conflicting file (Imports 'Type' but also defines 'Type')
    const conflictCTO = `
    namespace org.example.conflict
    import org.external.types.Type
    
    enum Type { 
      o OTHER
    }
    `;

    mm.addCTOModel(importedCTO, 'imported.cto');
    mm.addCTOModel(conflictCTO, 'conflict.cto');

    // Should throw error regarding conflict
    expect(() => {
        mm.validateModelFiles();
    }).toThrow(/conflicts with imported type/); 
});