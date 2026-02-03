/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: concerto@1.0.0

// imports

// Warning: Beware of circular dependencies when modifying these imports
import type {
    IPosition,
    IRange,
    ITypeIdentifier,
    IDecoratorLiteral,
    IDecorator,
    IIdentified,
    IDeclaration,
    IMapKeyType,
    IMapValueType,
    IEnumProperty,
    IProperty,
    IStringRegexValidator,
    IStringLengthValidator,
    IDoubleDomainValidator,
    IIntegerDomainValidator,
    ILongDomainValidator,
    IAliasedType,
    IImport,
    IModel,
    IModels
} from './concerto.metamodel@1.0.0';
import type {
    IConcertino,
    IMetadata,
    IModelMetadata,
    IConcertinoDeclaration,
    Prototype,
    IConcertinoEnumValue,
    IMapKey,
    IMapValue,
    IConcertinoProperty,
    IVocabulary,
    IDecoratorValues,
    IDecoratorValue
} from './concertino.metamodel@4.0.0-alpha.2';

// interfaces
export interface IConcept {
   $class?: string;
}

export type ConceptUnion = IPosition |
IRange |
ITypeIdentifier |
IDecoratorLiteral |
IDecorator |
IIdentified |
IDeclaration |
IMapKeyType |
IMapValueType |
IEnumProperty |
IProperty |
IStringRegexValidator |
IStringLengthValidator |
IDoubleDomainValidator |
IIntegerDomainValidator |
ILongDomainValidator |
IAliasedType |
IImport |
IModel |
IModels |
IConcertino |
IMetadata |
IModelMetadata |
IConcertinoDeclaration |
IConcertinoEnumValue |
IMapKey |
IMapValue |
IConcertinoProperty |
IVocabulary |
IDecoratorValues |
IDecoratorValue;

export interface IAsset extends IConcept {
   $identifier: string;
}

export interface IParticipant extends IConcept {
   $identifier: string;
}

export interface ITransaction extends IConcept {
   $timestamp: Date;
}

export interface IEvent extends IConcept {
   $timestamp: Date;
}

