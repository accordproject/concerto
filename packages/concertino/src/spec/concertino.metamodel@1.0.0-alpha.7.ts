/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: concertino.metamodel@1.0.0-alpha.7

// imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports
import {IImport,IDecorator} from './concerto.metamodel@1.0.0';
import {IConcept} from './concerto@1.0.0';

// interfaces
export interface IConcertino extends IConcept {
   declarations: DeclarationMap;
   metadata: IMetadata;
}

export type DeclarationMap = Record<string, IConcertinoDeclaration>;

export type PropertyMap = Record<string, IConcertinoProperty>;

export interface IMetadata extends IConcept {
   concertinoVersion: string;
   models: ModelMetadataMap;
}

export type ModelMetadataMap = Record<string, IModelMetadata>;

export interface IModelMetadata extends IConcept {
   concertoVersion?: string;
   sourceUri?: string;
   imports?: IImport[];
   decorators?: IDecorator[];
}

export interface IConcertinoDeclaration extends IConcept {
   type: string;
   vocabulary?: IVocabulary;
   metadata?: MetadataMap;
}

export type ConcertinoDeclarationUnion = IConcertinoConceptDeclaration | 
IConcertinoEnumDeclaration | 
IConcertinoScalarDeclaration | 
IConcertinoMapDeclaration;

export interface IConcertinoConceptDeclaration extends IConcertinoDeclaration {
   properties: PropertyMap;
   extends?: string[];
   isAbstract?: boolean;
   prototype?: Prototype;
}

export enum Prototype {
   AssetDeclaration = 'AssetDeclaration',
   EventDeclaration = 'EventDeclaration',
   TransactionDeclaration = 'TransactionDeclaration',
   ParticipantDeclaration = 'ParticipantDeclaration',
}

export interface IConcertinoEnumDeclaration extends IConcertinoDeclaration {
   values: EnumValueMap;
}

export type EnumValueMap = Record<string, IConcertinoEnumValue>;

export interface IConcertinoEnumValue extends IConcept {
   vocabulary?: IVocabulary;
   metadata?: MetadataMap;
}

export interface IConcertinoScalarDeclaration extends IConcertinoDeclaration {
}

export type ConcertinoScalarDeclarationUnion = IConcertinoStringScalarDeclaration | 
IConcertinoIntegerScalarDeclaration | 
IConcertinoBooleanScalarDeclaration | 
IConcertinoDoubleScalarDeclaration | 
IConcertinoLongScalarDeclaration | 
IConcertinoDateTimeScalarDeclaration;

export interface IConcertinoStringScalarDeclaration extends IConcertinoScalarDeclaration {
   regex?: string;
   length: [number | null, number | null];
   default?: string;
}

export interface IConcertinoIntegerScalarDeclaration extends IConcertinoScalarDeclaration {
   range: [number | null, number | null];
   default?: number;
}

export interface IConcertinoBooleanScalarDeclaration extends IConcertinoScalarDeclaration {
   default?: boolean;
}

export interface IConcertinoDoubleScalarDeclaration extends IConcertinoScalarDeclaration {
   range: [number | null, number | null];
   default?: number;
}

export interface IConcertinoLongScalarDeclaration extends IConcertinoScalarDeclaration {
   range: [number | null, number | null];
   default?: number;
}

export interface IConcertinoDateTimeScalarDeclaration extends IConcertinoScalarDeclaration {
   default?: string;
}

export interface IConcertinoMapDeclaration extends IConcertinoDeclaration {
   key: IMapKey;
   value: IMapValue;
}

export interface IMapKey extends IConcept {
   type: string;
   vocabulary?: IVocabulary;
   metadata?: MetadataMap;
}

export interface IMapValue extends IConcept {
   type: string;
   vocabulary?: IVocabulary;
   metadata?: MetadataMap;
   isRelationship?: boolean;
}

export interface IConcertinoProperty extends IConcept {
   name: string;
   type: string;
   scalarType?: string;
   isArray?: boolean;
   isOptional?: boolean;
   isRelationship?: boolean;
   isIdentifier?: boolean;
   inheritedFrom?: string;
   isCircular?: boolean;
   isEnum?: boolean;
   vocabulary?: IVocabulary;
   metadata?: MetadataMap;
}

export type ConcertinoPropertyUnion = IConcertinoStringProperty | 
IConcertinoIntegerProperty | 
IConcertinoBooleanProperty | 
IConcertinoDoubleProperty | 
IConcertinoLongProperty | 
IConcertinoDateTimeProperty;

export interface IConcertinoStringProperty extends IConcertinoProperty {
   regex?: string;
   length: [number | null, number | null];
   default?: string;
}

export interface IConcertinoIntegerProperty extends IConcertinoProperty {
   range: [number | null, number | null];
   default?: number;
}

export interface IConcertinoBooleanProperty extends IConcertinoProperty {
   default?: boolean;
}

export interface IConcertinoDoubleProperty extends IConcertinoProperty {
   range: [number | null, number | null];
   default?: number;
}

export interface IConcertinoLongProperty extends IConcertinoProperty {
   range: [number | null, number | null];
   default?: number;
}

export interface IConcertinoDateTimeProperty extends IConcertinoProperty {
   default?: string;
}

export interface IVocabulary extends IConcept {
   label?: string;
   path?: PathTerms;
   additionalTerms?: AdditionalTermMap;
}

export type PathTerms = Record<string, string>;

export type AdditionalTermMap = Record<string, string>;

export type MetadataMap = Record<string, IDecoratorValue[]>;
export interface IDecoratorValues extends IConcept {
   values: IDecoratorValue[];
}

export interface IDecoratorValue extends IConcept {
}

export type DecoratorValueUnion = IStringDecoratorValue | 
INumberDecoratorValue | 
IBooleanDecoratorValue | 
IDecoratorTypeLiteral;

export interface IStringDecoratorValue extends IDecoratorValue {
   value: string;
}

export interface INumberDecoratorValue extends IDecoratorValue {
   value: number;
}

export interface IBooleanDecoratorValue extends IDecoratorValue {
   value: boolean;
}

export interface IDecoratorTypeLiteral extends IDecoratorValue {
   type: string;
   isArray?: boolean;
}

