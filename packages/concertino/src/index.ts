/**
 * Concertino Format Converter Utility
 *
 * This module provides a standardized way to convert between Concerto metamodel and Concertino format.
 */
import { IModels } from '@accordproject/concerto-types';
import { Concertino } from './types';
import { convertToConcertino } from './concertino';
import { convertToMetamodel } from './metamodel';
import Ajv, { ValidateFunction } from 'ajv';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Conversion options for Concertino format.
 */
export interface ConcertinoOptions {
  /**
   * Version of Concertino to use.
   */
  version?: string;
}

const schema = JSON.parse(readFileSync(join(__dirname, 'concertino.schema.json'), 'utf-8'));
const ajv = new Ajv();

/**
 * Concertino utility class for converting between Concerto metamodel and Concertino format.
 */
export class ConcertinoConverter {
    private options: ConcertinoOptions;
    private validate: ValidateFunction;

    /**
     * Creates a new instance of ConcertinoConverter.
     * @param options - Configuration options for the converter.
     */
    constructor(options: ConcertinoOptions = {}) {
        this.options = {
            version: '0.1.0-alpha.3',
            ...options
        };
        this.validate = ajv.compile(schema);
    }

    /**
     * Convert Concerto metamodel to Concertino format.
     * @param metamodel - The Concerto metamodel to convert.
     * @returns The converted Concertino representation.
     */
    public fromConcertoMetamodel(metamodel: IModels): Concertino {
        const concertino = convertToConcertino(metamodel);
        if (this.options.version) {
            concertino.metadata.concertinoVersion = this.options.version;
        }
        return concertino;
    }

    /**
     * Convert Concertino format to Concerto metamodel.
     * @param concertino - The Concertino format to convert.
     * @returns The converted Concerto metamodel.
     */
    public toConcertoMetamodel(concertino: Concertino): IModels {
        return convertToMetamodel(concertino);
    }


    public isValidateStructure(concertino: Concertino): boolean {
        return this.validate(concertino);
    }

}

// Export individual conversion functions for direct use
export { convertToConcertino, convertToMetamodel };

// Export types
export * from './types';
