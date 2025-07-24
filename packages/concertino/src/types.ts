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

import {
    IDecorator,
    IImport
} from '@accordproject/concerto-types';

/**
 * Metadata for the Concertino format.
 */
export interface Metadata {
  concertinoVersion: string;
  models: Record<string, {
    concertoVersion?: string;
    sourceUri?: string;
    imports?: IImport[],
    decorators?: IDecorator[];
  }>;
}
/**
 * Represents a vocabulary object.
 */
export interface Vocabulary {
  label?: string;
  path?: { [key: string]: string | null };
  additionalTerms?: Record<string, string>;
}

/**
 * Represents a metadata map.
 */
export interface MetadataMap {
  [key: string]: (string | number | boolean | object)[];
}

export type EnumOption = { vocabulary?: Vocabulary; metadata?: MetadataMap }

/**
 * Unique identifier for a declaration.
 */
export interface FullyQualifiedName {
  namespace: string;
  localName: string;
  version: string;
}

/**
 * Represents the Concertino format.
 */
export interface Concertino {
  declarations: Record<string, Declaration>;
  metadata: Metadata;
}

/**
 * Represents a generic declaration.
 */
export type Declaration =
  | ConceptDeclaration
  | EnumDeclaration
  | ScalarDeclaration
  | MapDeclaration;

/**
 * Represents a ConceptDeclaration.
 */
export interface ConceptDeclaration {
  type: 'ConceptDeclaration';
  properties?: Record<string, Property>;
  extends?: string[];
  isAbstract?: boolean;
  vocabulary?: Vocabulary;
  metadata?: MetadataMap;
  prototype?: string;
  name?: FullyQualifiedName;
}

/**
 * Represents an EnumDeclaration.
 */
export interface EnumDeclaration {
  type: 'EnumDeclaration';
  values: Record<string, EnumOption>;
  vocabulary?: Vocabulary;
  metadata?: MetadataMap;
  name?: FullyQualifiedName;
}

export type ScalarType = 'StringScalar' | 'IntegerScalar' | 'BooleanScalar' | 'DoubleScalar' | 'LongScalar' | 'DateTimeScalar';

/**
 * Represents a ScalarDeclaration.
 */
export interface ScalarDeclaration {
  type: ScalarType;
  vocabulary?: Vocabulary;
  metadata?: MetadataMap;
  regex?: string; // For StringScalar
  length?: [number | undefined, number | undefined]; // For StringScalar
  range?: [number | undefined, number | undefined]; // For IntegerScalar, DoubleScalar, LongScalar
  default?: string | number | boolean; // Default value for scalars
  name?: FullyQualifiedName;
}

/**
 * Represents a MapDeclaration.
 */
export interface MapDeclaration {
  type: 'MapDeclaration';
  keyType: string; // e.g., "String", "DateTime"
  valueType: string; // e.g., "String", "Boolean", "com.test.models@1.2.3.Xyc"
  isRelationshipValue?: boolean; // For relationship map values
  vocabulary?: Vocabulary;
  metadata?: MetadataMap;
  name?: FullyQualifiedName;
}

/**
 * Represents a property in a ConceptDeclaration.
 */
export interface Property {
 /**
   * Property identifier, unique within a Concept declaration
   */
  name: string;

  /**
   * Primitive Concerto type, or fully qualified name for Enum declarations,
   * Relationships, Map Declarations & Scalar declarations
   */
  type: string;

  /**
   * Primitive Concerto type for true primitives and scalar declarations
   */
  scalarType?: string;

  /**
   * Opinionated projection of "@Term" and "@Term_XXXXXXX" decorators
   */
  vocabulary?: Vocabulary;

  /**
   * Structural hints, implicitly false when not specified
   */
  isCircular?: boolean;
  isEnum?: boolean;

  /**
   * Modifiers, implicitly false when not specified
   */
  isOptional?: boolean;
  isArray?: boolean;
  isRelationship?: boolean;
  isIdentifier?: boolean;
  inheritedFrom?: string; // For inherited properties

  /**
   * Decorators
   */
  metadata?: MetadataMap;

  /**
   * Metaproperties
   */
  regex?: string; // For String properties
  length?: [number | undefined , number | undefined]; // For String properties
  range?: [number | undefined , number | undefined]; // Only for Integer, Double & Long types
  default?: string | number | boolean; // // Only for Integer, Double & Long types
}
