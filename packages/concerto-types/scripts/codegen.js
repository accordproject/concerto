import { CodeGen } from '@accordproject/concerto-codegen';
import { MetaModelUtil }  from '@accordproject/concerto-metamodel';
import { ModelLoader } from '@accordproject/concerto-core';
import { FileWriter } from '@accordproject/concerto-util';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';


const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Generate TypeScript files from the metamodel.
 */
async function main() {
    const modelManager = await ModelLoader.loadModelManagerFromModelFiles([MetaModelUtil.metaModelCto], {strict: true});
    const visitor = new CodeGen.TypescriptVisitor();

    const fileWriter = new FileWriter(path.resolve(__dirname, '..', 'src', 'generated'));
    modelManager.accept(visitor, { fileWriter });

    const fileWriter2 = new FileWriter(path.resolve(__dirname, '..', 'src', 'generated/unions'));
    modelManager.accept(visitor, { fileWriter: fileWriter2, flattenSubclassesToUnion: true });
}

main().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
