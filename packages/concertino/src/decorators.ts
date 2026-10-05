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

/**
 * How a 5.1.0 reader reads the decorators of a decorated Concertino element.
 *
 * Format 5.1.0 writes `vocabulary` and `metadata` as 5.0.0 did, so a 5.0.0
 * reader reads them as before. 5.0.0 kept a vocabulary term that is not in
 * leading position (`@Foo @Term("x")`, say) in `metadata` under its own
 * name; 5.1.0 also writes every term to `fullVocabulary`, with
 * `decoratorOrder`. A 5.1.0 reader reads the vocabulary from
 * `fullVocabulary` when it is there, and leaves the 5.0.0 copies of its
 * terms out of the metadata.
 */
/* eslint-disable valid-jsdoc */
import type { IVocabulary, MetadataMap } from './spec/concertino.metamodel@5.1.0';

/** The decorator fields of a decorated Concertino element. */
export interface Decorated {
    vocabulary?: IVocabulary;
    metadata?: MetadataMap;
    decoratorOrder?: string[];
    fullVocabulary?: IVocabulary;
}

/**
 * The decorator names of a vocabulary's terms: `Term` for the label, then
 * `Term_key` for each additional term.
 * @param vocabulary The vocabulary.
 * @returns The names.
 */
export function termNames(vocabulary: IVocabulary | undefined): string[] {
    return [
        ...(vocabulary && 'label' in vocabulary ? ['Term'] : []),
        ...Object.keys(vocabulary?.additionalTerms ?? {}).map((key) => `Term_${key}`),
    ];
}

/**
 * The vocabulary of an element: every `@Term` and `@Term_*` decorator.
 * @param element The element.
 * @returns `fullVocabulary` when the element has one, else `vocabulary`.
 */
export function vocabularyOf(element: Decorated | undefined): IVocabulary | undefined {
    return element?.fullVocabulary ?? element?.vocabulary;
}

/**
 * The metadata of an element: its decorators other than the vocabulary
 * terms. A `metadata` entry for a term that `fullVocabulary` holds and
 * `vocabulary` does not is the 5.0.0 copy of that term, unless
 * `decoratorOrder` names it more than once (then the entry is a repeated
 * decorator of that name, as 5.0.0 kept it); the copies are left out.
 * @param element The element.
 * @returns The metadata, or undefined when there is none.
 */
export function metadataOf(element: Decorated | undefined): MetadataMap | undefined {
    const metadata = element?.metadata;
    if (!metadata || !element?.fullVocabulary) {
        return metadata;
    }
    const kept = new Set(termNames(element.vocabulary));
    const order = element.decoratorOrder ?? [];
    const copies = new Set(termNames(element.fullVocabulary)
        .filter((name) => !kept.has(name) && order.filter((n) => n === name).length <= 1));
    if (!Object.keys(metadata).some((name) => copies.has(name))) {
        return metadata;
    }
    const result: MetadataMap = {};
    Object.entries(metadata).forEach(([name, values]) => {
        if (!copies.has(name)) {
            result[name] = values;
        }
    });
    return Object.keys(result).length > 0 ? result : undefined;
}
