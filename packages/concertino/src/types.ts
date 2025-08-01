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

// TODO generate these from the model-spec

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

export interface DecoratorTypeLiteral {
  type: string;
  isArray?: boolean
}

/**
 * Represents a metadata map.
 */
export interface MetadataMap {
  [key: string]: (string | number | boolean | DecoratorTypeLiteral)[];
}

export type EnumValue = { vocabulary?: Vocabulary; metadata?: MetadataMap }

/**
 * Unique identifier for a declaration.
 */
export interface FullyQualifiedName {
  namespace: string;
  localName: string;
  version: string;
}

/**
 * Represents a generic declaration.
 */
export interface Declaration {
  type: string;
  name: FullyQualifiedName;
  vocabulary?: Vocabulary;
  metadata?: MetadataMap;
}

/**
 * Represents the Concertino format.
 */
export interface Concertino {
  declarations: Record<string, Declaration>;
  metadata: Metadata;
}

/**
 * Represents an EnumDeclaration.
 */
export interface EnumDeclaration extends Declaration {
  type: 'EnumDeclaration';
  values: Record<string, EnumValue>;
}

export type ScalarType = 'StringScalar' | 'IntegerScalar' | 'BooleanScalar' | 'DoubleScalar' | 'LongScalar' | 'DateTimeScalar';

/**
 * Represents a generic scalar declaration.
 */
export interface ScalarDeclaration extends Declaration {
  type: ScalarType;
}

/**
 * String scalar declaration
 */
export interface StringScalarDeclaration extends ScalarDeclaration {
  type: 'StringScalar';
  regex?: string;
  length?: [number | null, number | null];
  default?: string;
}

/**
 * Integer scalar declaration
 */
export interface IntegerScalarDeclaration extends ScalarDeclaration {
  type: 'IntegerScalar';
  range?: [number | null, number | null];
  default?: number;
}

/**
 * Boolean scalar declaration
 */
export interface BooleanScalarDeclaration extends ScalarDeclaration {
  type: 'BooleanScalar';
  default?: boolean;
}

/**
 * Double scalar declaration
 */
export interface DoubleScalarDeclaration extends ScalarDeclaration {
  type: 'DoubleScalar';
  range?: [number | null, number | null];
  default?: number;
}

/**
 * Long scalar declaration
 */
export interface LongScalarDeclaration extends ScalarDeclaration {
  type: 'LongScalar';
  range?: [number | null, number | null];
  default?: number;
}

/**
 * DateTime scalar declaration
 */
export interface DateTimeScalarDeclaration extends ScalarDeclaration {
  type: 'DateTimeScalar';
  default?: string;
}

/**
 * Represents a Key type in a MapDeclaration.
 */
export interface MapKey {
  type: string; // e.g., "String", "DateTime"
  vocabulary?: Vocabulary;
  metadata?: MetadataMap;
}

/**
 * Represents a Value type in a MapDeclaration.
 */
export interface MapValue {
  type: string; // e.g., "String", "Boolean", "com.test.models@1.2.3.Xyc"
  vocabulary?: Vocabulary;
  metadata?: MetadataMap;
  isRelationship?: boolean; // For relationship map values
}

/**
 * Represents a MapDeclaration.
 */
export interface MapDeclaration extends Declaration {
  type: 'MapDeclaration';
  key: MapKey;
  value: MapValue;
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

}

/**
 * String property
 */
export interface StringProperty extends Property {
  type: 'String';
  regex?: string;
  length?: [number | null, number | null];
  default?: string;
}

/**
 * Integer property
 */
export interface IntegerProperty extends Property {
  type: 'Integer';
  range?: [number | null, number | null];
  default?: number;
}

/**
 * Boolean property
 */
export interface BooleanProperty extends Property {
  type: 'Boolean';
  default?: boolean;
}

/**
 * Double property
 */
export interface DoubleProperty extends Property {
  type: 'Double';
  range?: [number | null, number | null];
  default?: number;
}

/**
 * Long property
 */
export interface LongProperty extends Property {
  type: 'Long';
  range?: [number | null, number | null];
  default?: number;
}

/**
 * DateTime property
 */
export interface DateTimeProperty extends Property {
  type: 'DateTime';
  default?: string;
}

/**
 * Object property (for non-primitive types)
 */
export type ObjectProperty = Property

/**
 * Relationship property
 */
export interface RelationshipProperty extends Property {
  isRelationship: true;
}

/**
 * Represents a ConceptDeclaration.
 */
export interface ConceptDeclaration extends Declaration {
  type: 'ConceptDeclaration';
  properties?: Record<string,
    StringProperty |
    IntegerProperty |
    BooleanProperty |
    DoubleProperty |
    LongProperty |
    DateTimeProperty |
    ObjectProperty |
    RelationshipProperty
  >;
  extends?: string[];
  isAbstract?: boolean;
  prototype?: string;
}

export type DeclarationUnion =
  | ConceptDeclaration
  | EnumDeclaration
  | StringScalarDeclaration
  | IntegerScalarDeclaration
  | BooleanScalarDeclaration
  | DoubleScalarDeclaration
  | LongScalarDeclaration
  | DateTimeScalarDeclaration
  | MapDeclaration;
