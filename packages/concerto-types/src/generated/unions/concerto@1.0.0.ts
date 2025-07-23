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
	IDecoratorCommandSetReference,
	CommandType,
	ICommandTarget,
	MapElement,
	ICommand,
	IDecoratorCommandSet
} from './org.accordproject.decoratorcommands@0.4.0';

// interfaces
export interface IConcept {
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
IModels | 
IDecoratorCommandSetReference | 
ICommandTarget | 
ICommand | 
IDecoratorCommandSet;

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

