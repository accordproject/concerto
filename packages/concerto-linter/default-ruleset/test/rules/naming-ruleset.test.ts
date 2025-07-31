import { testRules } from '../test-rule';
import pascalCaseDeclarations from '../../src/pascal-case-declarations';
import camelCaseProperties from '../../src/camel-case-properties';
import upperSnakeCaseEnumConst from '../../src/upper-snake-case-enum-const';

describe ('Naming Convention Linting Rules' , () => {
    test ('should not report any PascalCase naming violations for correctly named declarations', async () => {
        const results = await testRules({
            rules: {
                'pascal-case-declarations': pascalCaseDeclarations,
            }
        }, 'declarations-valid-PascalCase.cto');
        expect(results).toHaveLength(0);
    });

    test ('should report a PascalCase naming violation for an invalid declaration name', async ()=>
    {
        const results = await testRules({
            rules: {
                'pascal-case-declarations': pascalCaseDeclarations,
            }
        }, 'declarations-violate-PascalCase.cto');
        expect(results).toHaveLength(7);
    });

    test ('should not report any camelCase naming violations for correctly named properties', async () => {
        const results = await testRules({
            rules: {
                'camel-case-properties': camelCaseProperties,
            }
        }, 'properties-valid-camelCase.cto');
        expect(results).toHaveLength(0);
    });
    test ('should report a camelCase naming violation for an invalid property name', async ()=>
    {
        const results = await testRules({
            rules: {
                'camel-case-properties': camelCaseProperties,
            }
        }, 'properties-violate-camelCase.cto');
        expect(results).toHaveLength(6);
    });

    test ('should not report any UPPER_SNAKE_CASE naming violations for correctly named enum constants', async () => {
        const results = await testRules({
            rules: {
                'upper-snake-case-enum-constants': upperSnakeCaseEnumConst,
            }
        }, 'ENUM_Constans-vaild.cto');
        expect(results).toHaveLength(0);
    });

    test ('should report a UPPER_SNAKE_CASE naming violation for an invalid enum constants', async ()=>
    {
        const results = await testRules({
            rules: {
                'upper-snake-case-enum-constants': upperSnakeCaseEnumConst,
            }
        }, 'ENUM_Constans-invaild.cto');
        expect(results).toHaveLength(3);
    });
});