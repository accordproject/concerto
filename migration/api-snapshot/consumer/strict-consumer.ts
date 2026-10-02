/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// P5-84 (accordproject/concerto-rust#430): a TypeScript consumer of the 14
// public methods whose return types P5-02 turned into `never`. It is only
// compiled (`tsc --strict --noEmit`, by migration/api-snapshot/v5-types.mjs
// as guardrails rule 5), never run. It must compile against both the live
// concerto-core .d.ts and the published 5.0.0 .d.ts
// (`node migration/api-snapshot/v5-types.mjs --consumer-against-v5`).
//
// Two kinds of check:
//   - ordinary use (`uri.split('#')`, `names.map(...)`, ...), which fails
//     with TS2339 when the result is `never`;
//   - `Expect<Equal<...>>`, which pins each return type to the published
//     5.0.0 declaration exactly, so a narrower or wider type fails too.

import { DecoratorManager, Identifiable, ModelManager, ModelUtil } from '@accordproject/concerto-core';
import ResourceId from '@accordproject/concerto-core/dist/model/resourceid';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;

// The exact 5.0.0 return types.
export type Checks = [
    Expect<Equal<ReturnType<Identifiable['toURI']>, string>>,
    Expect<Equal<ReturnType<ResourceId['toURI']>, string>>,
    Expect<Equal<ReturnType<typeof DecoratorManager.extractDecorators>, { modelManager: ModelManager; decoratorCommandSet: never[]; vocabularies: never[] }>>,
    Expect<Equal<ReturnType<typeof DecoratorManager.extractVocabularies>, { modelManager: ModelManager; vocabularies: never[] }>>,
    Expect<Equal<ReturnType<typeof DecoratorManager.extractNonVocabDecorators>, { modelManager: ModelManager; decoratorCommandSet: never[] }>>,
    Expect<IsAny<ReturnType<typeof DecoratorManager.falsyOrEqual>>>,
    Expect<IsAny<ReturnType<typeof ModelUtil.isEnum>>>,
    Expect<IsAny<ReturnType<typeof ModelUtil.isMap>>>,
    Expect<IsAny<ReturnType<typeof ModelUtil.isScalar>>>,
    Expect<IsAny<ReturnType<typeof ModelUtil.isAssignableTo>>>,
    Expect<Equal<ReturnType<typeof ModelUtil.isValidMapKey>, boolean>>,
    Expect<IsAny<ReturnType<typeof ModelUtil.isValidMapKeyScalar>>>,
    Expect<Equal<ReturnType<typeof ModelUtil.isValidMapValue>, boolean>>,
    Expect<Equal<ReturnType<typeof ModelUtil.importFullyQualifiedNames>, string[]>>,
];

/**
 * Ordinary use of each method's result.
 * @param {Identifiable} r - a resource
 * @param {ResourceId} id - a resource id
 * @param {ModelManager} mm - a model manager
 * @param {object} field - a field
 * @param {object} imp - an import
 * @return {string[]} values derived from every result
 */
export function use(r: Identifiable, id: ResourceId, mm: ModelManager, field: object, imp: object): string[] {
    const out: string[] = [];
    out.push(r.toURI().split('#')[0]);
    out.push(id.toURI().toUpperCase());

    const extracted = DecoratorManager.extractDecorators(mm, {});
    out.push(String(extracted.modelManager.getNamespaces().length + extracted.decoratorCommandSet.length + extracted.vocabularies.length));
    const vocab = DecoratorManager.extractVocabularies(mm, {});
    out.push(String(vocab.modelManager.getModelFiles().length + vocab.vocabularies.length));
    const nonVocab = DecoratorManager.extractNonVocabDecorators(mm, {});
    out.push(String(nonVocab.modelManager.getModelFiles().length + nonVocab.decoratorCommandSet.length));
    out.push(DecoratorManager.falsyOrEqual(null, ['a']).toString());

    out.push(ModelUtil.isEnum(field).toString());
    out.push(ModelUtil.isMap(field).toString());
    out.push(ModelUtil.isScalar(field).toString());
    out.push(ModelUtil.isAssignableTo(mm.getModelFiles()[0], 'String', field).toString());
    out.push(ModelUtil.isValidMapKey(field).toString());
    out.push(ModelUtil.isValidMapKeyScalar(field).toString());
    out.push(ModelUtil.isValidMapValue(field).toString());
    out.push(...ModelUtil.importFullyQualifiedNames(imp).map((name) => name.toLowerCase()));
    return out;
}
