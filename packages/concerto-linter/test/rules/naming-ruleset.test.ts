import { lintAST } from '../../src/index';
import { ModelManager } from '@accordproject/concerto-core';
import * as fs from 'fs/promises';
import * as path from 'path';

async function getModelAST(fileName: string)
{
    const filePath = path.resolve(__dirname,'../fixtures/',fileName);
    const model = await fs.readFile(filePath, 'utf-8');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(model);

    const ast = modelManager.getAst();
    const jsonString = JSON.stringify(ast);

    const results = await lintAST(jsonString);

    return results;
}

describe ('Naming Convention Linting Rules' , () => {
    test ('should not report any camelCase naming violations for correctly named declarations', async () => {

        const results = await getModelAST('declarations-valid-camelCase.cto');
        expect(results).toHaveLength(0);

    });

    test ('should report a camelCase naming violation for an invalid declaration name', async ()=>
    {
        const results = await getModelAST('declarations-violate-camelCase.cto');
        expect(results).toHaveLength(6);

    });

    test ('should not report any pascal naming violations for correctly named properties', async () => {

        const results = await getModelAST('properties-valid-PascalCase.cto');
        expect(results).toHaveLength(0);

    });

    test ('should report a pascalCase naming violation for an invalid declaration name', async ()=>
    {
        const results = await getModelAST('declarations-violate-camelCase.cto');
        expect(results).toHaveLength(6);

    });

    test ('should not report any UPPER_SNAKE_CASE naming violations for correctly named enum constants', async () => {

        const results = await getModelAST('ENUM_Constans-vaild.cto');
        expect(results).toHaveLength(0);

    });

    test ('should report a UPPER_SNAKE_CASE naming violation for an invalid enum constants', async ()=>
    {
        const results = await getModelAST('ENUM_Constans-invaild.cto');
        expect(results).toHaveLength(3);

    });

} );
