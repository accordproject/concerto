'use strict';

const { CodeGen: { TypescriptVisitor }} = require('@accordproject/concerto-codegen');
const { MetaModelUtil: {metaModelCto} } = require('@accordproject/concerto-metamodel');
const { ModelLoader } = require('@accordproject/concerto-core');
const { FileWriter } = require('@accordproject/concerto-util');
const path = require('path');

/**
 * Generate TypeScript files from the metamodel.
 */
async function main() {
    const modelManager = await ModelLoader.loadModelManagerFromModelFiles([metaModelCto], {strict: true});
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
