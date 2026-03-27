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

// interfaces
/**
 * Base interface representing a Concerto concept.
 */
export interface IConcept {
   /**
    * Fully qualified class name of the concept.
    */
   $class: string;
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
IModels;

/**
 * Represents an asset entity in the Concerto model.
 */
export interface IAsset extends IConcept {
   /**
    * Unique identifier of the asset.
    */
   $identifier: string;
}

/**
 * Represents a participant in the Concerto model.
 */
export interface IParticipant extends IConcept {
   /**
    * Unique identifier of the participant.
    */
   $identifier: string;
}

/**
 * Represents a transaction in the Concerto model.
 */
export interface ITransaction extends IConcept {
   /**
    * Timestamp of the transaction.
    */
   $timestamp: Date;
}

/**
 * Represents an event emitted by the Concerto model.
 */
export interface IEvent extends IConcept {
   /**
    * Timestamp of the event.
    */
   $timestamp: Date;
}

