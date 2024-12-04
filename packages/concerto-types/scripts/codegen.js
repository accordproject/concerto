'use strict';

const { ModelManager } = require('@accordproject/concerto-core');
const { CodeGen: { TypescriptVisitor }} = require('@accordproject/concerto-codegen');
const { FileWriter } = require('@accordproject/concerto-util');
const path = require('path');
const { DCS_MODEL }= require('@accordproject/concerto-core');

/**
 * Generate TypeScript files from the metamodel.
 */
async function main() {
    const modelManager = new ModelManager({addMetamodel:true, strict: true});
    modelManager.addCTOModel(DCS_MODEL, 'decoratorcommands@0.4.0.cto');
    const visitor = new TypescriptVisitor();

    const fileWriter = new FileWriter(path.resolve(__dirname, '..', 'src', 'generated'));
    modelManager.accept(visitor, { fileWriter });

    const fileWriter2 = new FileWriter(path.resolve(__dirname, '..', 'src', 'generated/unions'));
    modelManager.accept(visitor, { fileWriter: fileWriter2, flattenSubclassesToUnion: true });
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
