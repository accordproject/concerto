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
 * Concertino Format Converter Utility
 *
 * This module provides a standardized way to convert between Concerto metamodel and Concertino format.
 */
import { IModels } from '@accordproject/concerto-metamodel';
import { IConcertino } from './spec/concertino.metamodel@4.0.0-alpha.0';
import { convertToConcertino } from './concertinoSerializer';
import { convertToMetamodel } from './metamodelSerializer';
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

const schema = JSON.parse(readFileSync(join(__dirname, 'spec/concertino.schema.json'), 'utf-8'));

/**
 * Concertino utility class for converting between Concerto metamodel and Concertino format.
 */
export class ConcertinoConverter {
    private options: ConcertinoOptions;
    private validate: ValidateFunction;
    private ajv: Ajv;

    /**
     * Creates a new instance of ConcertinoConverter.
     * @param options - Configuration options for the converter.
     */
    constructor(options: ConcertinoOptions = {}) {
        this.options = {
            version: '4.0.0-alpha.0',
            ...options
        };
        this.ajv = new Ajv();
        this.validate = this.ajv.compile(schema);
    }

    /**
     * Convert Concerto metamodel to Concertino format.
     * @param metamodel - The Concerto metamodel to convert.
     * @returns The converted Concertino representation.
     */
    public fromConcertoMetamodel(metamodel: IModels): IConcertino {
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
    public toConcertoMetamodel(concertino: IConcertino): IModels {
        return convertToMetamodel(concertino);
    }

    public isValid(concertino: IConcertino): boolean {
        return this.validate(concertino);
    }

    public getValidationErrors() {
        return this.validate.errors;
    }

}

// Export individual conversion functions for direct use
export { convertToConcertino, convertToMetamodel };

// Export types
export * from './spec/concertino.metamodel@4.0.0-alpha.0';
