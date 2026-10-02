/*
 * P5-78 spike (accordproject/concerto-rust#420): the Concertino converter
 * entry point after the cleanup in item 3. Not shipped.
 *
 * Differences from packages/concertino/src/index.ts:
 * - no `ajv` import: the JSON-schema check moved to the `./schema` subpath
 *   (schema.ts), backed by a validator precompiled at build time, so this
 *   entry needs no `new Function` and tree-shakes to the converter alone;
 * - the metamodel serializer takes getShortName/getNamespace from ../names
 *   instead of concerto-core's ModelUtil, so there is no runtime dependency
 *   on concerto-core (or, on the integration branch, on the WASM engine);
 * - IConcertino is the 5.0.0 type throughout (the published index imports
 *   it from the 4.0.0-alpha.2 spec file but exports the 5.0.0 types).
 */
/* eslint-disable valid-jsdoc */
import type { IModels } from '@accordproject/concerto-metamodel';
import type { IConcertino } from './spec/concertino.metamodel@5.0.0';
import { convertToConcertino } from './concertinoSerializer';
import { convertToMetamodel } from './metamodelSerializer';

export const CONCERTINO_VERSION = '5.0.0';

export interface ConcertinoOptions {
    /** Version written to metadata.concertinoVersion. */
    version?: string;
}

/**
 * Converter between the resolved Concerto metamodel and Concertino. Same
 * API as the published class, minus isValid/getValidationErrors (see ./schema).
 */
export class ConcertinoConverter {
    private options: ConcertinoOptions;

    constructor(options: ConcertinoOptions = {}) {
        this.options = { version: CONCERTINO_VERSION, ...options };
    }

    public fromConcertoMetamodel(metamodel: IModels): IConcertino {
        const concertino = convertToConcertino(metamodel);
        if (this.options.version) {
            concertino.metadata.concertinoVersion = this.options.version;
        }
        return concertino;
    }

    public toConcertoMetamodel(concertino: IConcertino): IModels {
        return convertToMetamodel(concertino);
    }
}

export { convertToConcertino, convertToMetamodel };
export * from './spec/concertino.metamodel@5.0.0';
