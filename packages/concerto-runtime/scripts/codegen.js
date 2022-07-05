'use strict';

const { CodeGen: { NodeVisitor }} = require('@accordproject/concerto-tools');
const { ModelManager } = require('@accordproject/concerto-core');
const { FileWriter } = require('@accordproject/concerto-util');
const path = require('path');

/**
 * Generate TypeScript files from the metamodel.
 */
async function main() {
    const modelManager = new ModelManager();
    modelManager.deleteModelFile('concerto');
    const visitor = new NodeVisitor();
    const fileWriter = new FileWriter(path.resolve(__dirname, '..', 'src', 'generated'));
    const parameters = { fileWriter, runtimeImport: '../internal', skipConcerto: false };
    modelManager.accept(visitor, parameters);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
