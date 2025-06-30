import { readFileSync } from 'fs';
import { join } from 'path';

import { ModelManager } from '@accordproject/concerto-core';
import { Parser } from '@accordproject/concerto-cto';
import { ConcertinoConverter } from '../src/';
import { determineScalarType, dispatchDeclaration, getInheritanceChain, determinePropertyType } from '../src/concertino';
import { readdirSync, statSync } from 'fs';
import { IModel, IModels } from '@accordproject/concerto-types';
import { it, expect, describe } from 'vitest';

const loadAllCtoFiles = (dir: string, models: object[]): void => {
    const files = readdirSync(dir);

    files.forEach((file) => {
        const fullPath = join(dir, file);
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
            loadAllCtoFiles(fullPath, models);
        } else if (file.endsWith('.cto')) {
            const ctoContent = readFileSync(fullPath, 'utf-8');
            try {
                models.push(Parser.parse(ctoContent, fullPath, { skipLocationNodes: true }));
            } catch (error: any) {
                if ('message' in error && !error.message.includes('is already declared')) {
                    // throw error;
                }
                console.warn(`Skipping. Parsing ${file} failed`);
            }
        }
    });
};

describe('concertino roundtripping (sample models)', () => {
    const models: IModel[] = [];

    const modelManager = new ModelManager({
        strict: true,
        importAliasing: true,
        enableMapType: true,
    });
    loadAllCtoFiles(join(__dirname, './cto/'), models);
    modelManager.fromAst({ models });
    const ast: IModels = modelManager.getAst(true);

    const converter = new ConcertinoConverter();
    const concertino = converter.fromConcertoMetamodel(ast);
    const metamodel = converter.toConcertoMetamodel(concertino);

    it('should produce valid concertino', () => {
        expect(converter.isValidateStructure(concertino)).toBe(true);
        expect(concertino).toMatchSnapshot();
    });

    ast.models.forEach((model: IModel) => {
        it(`should roundtrip ${model.namespace}`, () => {
            const generatedModel = metamodel.models.find((m: IModel) => m.namespace === model.namespace);
            expect(generatedModel).toStrictEqual(model);
        });
    });
});

describe('concertino edge cases and error handling', () => {
    it('should roundtrip sourceUri', () => {
        const converter = new ConcertinoConverter();
        const ast = {
            $class: 'concerto.metamodel@1.0.0.Models',
            models: [{
                $class: 'concerto.metamodel@1.0.0.Model',
                namespace: 'sourceUriTest@1.0.0',
                sourceUri: 'uri'
            }],
        };
        const concertino = converter.fromConcertoMetamodel(ast);
        const metamodel = converter.toConcertoMetamodel(concertino);
        expect(converter.isValidateStructure(concertino)).toBe(true);
        expect(concertino).toMatchSnapshot();
        expect(metamodel).toStrictEqual(ast);
    });

    it('should throw for unsupported scalar type', () => {
        expect(() => {
            // @ts-expect-error purposely invalid
            determineScalarType({ $class: 'concerto.metamodel@1.0.0.UnsupportedScalar' });
        }).toThrow(/Unsupported scalar type/);
    });

    it('should throw for unsupported property class', () => {
        expect(() => {
            // @ts-expect-error purposely invalid
            determinePropertyType({ $class: 'concerto.metamodel@1.0.0.UnsupportedProperty' }, { modelNamespace: 'foo' });
        }).toThrow(/Unsupported property class/);
    });

    it('should throw for missing $class in dispatchDeclaration', () => {
        expect(() => {
            dispatchDeclaration({}, { modelNamespace: 'foo' });
        }).toThrow(/Missing \$class property/);
    });

    it('should throw for unsupported object type in dispatchDeclaration', () => {
        expect(() => {
            dispatchDeclaration({ $class: 'concerto.metamodel@1.0.0.Foo' }, { modelNamespace: 'foo' });
        }).toThrow(/Unsupported object type/);
    });

    it('should throw for missing superType namespace', () => {
        expect(() => {
            dispatchDeclaration({
                $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                name: 'Test',
                properties: [],
                decorators: [],
                superType: { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'Foo' },
            }, { modelNamespace: 'foo' });
        }).toThrow(/Missing namespace for superType/);
    });

    it('should throw for parent === undefined in getInheritanceChain', () => {
        expect(() => {
            // @ts-expect-error purposely invalid
            getInheritanceChain({ extends: [undefined] }, { declarations: {} });
        }).toThrow(/Parent is undefined/);
    });

    it('should throw for unsupported scalar type', () => {
        const converter = new ConcertinoConverter();
        expect(() => {
            converter.toConcertoMetamodel({
                metadata: {
                    concertinoVersion: '0.0.1-alpha.3',
                    models: {}
                },
                declarations: {
                    'com.test.models@1.2.3.Bar': {
                        'metadata': {
                            // @ts-expect-error purposely invalid
                            'Decorated': [null],
                        },
                        'name': {
                            'localName': 'Bar',
                            'namespace': 'com.test.models',
                            'version': '1.2.3',
                        },
                        'properties': {},
                        'type': 'ConceptDeclaration',
                    }
                },
            });
        }).toThrow(/Unsupported argument type: object/);
    });
});
