/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: concerto.metamodel@1.0.0

// imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports

// Warning: Beware of circular dependencies when modifying these imports
import {IConcept} from './concerto@1.0.0';

// interfaces
export interface IPosition extends IConcept {
   line: number;
   column: number;
   offset: number;
}

export interface IRange extends IConcept {
   start: IPosition;
   end: IPosition;
   source?: string;
}

export interface ITypeIdentifier extends IConcept {
   name: string;
   resolvedName?: string;
   namespace?: string;
}

export interface IDecoratorLiteral extends IConcept {
   location?: IRange;
}

export type DecoratorLiteralUnion = IDecoratorString | 
IDecoratorNumber | 
IDecoratorBoolean | 
IDecoratorTypeReference;

export interface IDecoratorString extends IDecoratorLiteral {
   value: string;
}

export interface IDecoratorNumber extends IDecoratorLiteral {
   value: number;
}

export interface IDecoratorBoolean extends IDecoratorLiteral {
   value: boolean;
}

export interface IDecoratorTypeReference extends IDecoratorLiteral {
   type: ITypeIdentifier;
   isArray: boolean;
}

export interface IDecorator extends IConcept {
   name: string;
   arguments?: IDecoratorLiteral[];
   location?: IRange;
}

export interface IIdentified extends IConcept {
}

export type IdentifiedUnion = IIdentifiedBy;

export interface IIdentifiedBy extends IIdentified {
   name: string;
}

export interface IDeclaration extends IConcept {
   name: string;
   decorators?: IDecorator[];
   location?: IRange;
}

export type DeclarationUnion = IMapDeclaration | 
IEnumDeclaration | 
IConceptDeclaration | 
IScalarDeclaration;

export interface IMapKeyType extends IConcept {
   decorators?: IDecorator[];
   location?: IRange;
}

export type MapKeyTypeUnion = IStringMapKeyType | 
IDateTimeMapKeyType | 
IObjectMapKeyType;

export interface IMapValueType extends IConcept {
   decorators?: IDecorator[];
   location?: IRange;
}

export type MapValueTypeUnion = IBooleanMapValueType | 
IDateTimeMapValueType | 
IStringMapValueType | 
IIntegerMapValueType | 
ILongMapValueType | 
IDoubleMapValueType | 
IObjectMapValueType | 
IRelationshipMapValueType;

export interface IMapDeclaration extends IDeclaration {
   key: IMapKeyType;
   value: IMapValueType;
}

export interface IStringMapKeyType extends IMapKeyType {
}

export interface IDateTimeMapKeyType extends IMapKeyType {
}

export interface IObjectMapKeyType extends IMapKeyType {
   type: ITypeIdentifier;
}

export interface IBooleanMapValueType extends IMapValueType {
}

export interface IDateTimeMapValueType extends IMapValueType {
}

export interface IStringMapValueType extends IMapValueType {
}

export interface IIntegerMapValueType extends IMapValueType {
}

export interface ILongMapValueType extends IMapValueType {
}

export interface IDoubleMapValueType extends IMapValueType {
}

export interface IObjectMapValueType extends IMapValueType {
   type: ITypeIdentifier;
}

export interface IRelationshipMapValueType extends IMapValueType {
   type: ITypeIdentifier;
}

export interface IEnumDeclaration extends IDeclaration {
   properties: IEnumProperty[];
}

export interface IEnumProperty extends IConcept {
   name: string;
   decorators?: IDecorator[];
   location?: IRange;
}

export interface IConceptDeclaration extends IDeclaration {
   isAbstract: boolean;
   identified?: IIdentified;
   superType?: ITypeIdentifier;
   properties: IProperty[];
}

export type ConceptDeclarationUnion = IAssetDeclaration | 
IParticipantDeclaration | 
ITransactionDeclaration | 
IEventDeclaration;

export interface IAssetDeclaration extends IConceptDeclaration {
}

export interface IParticipantDeclaration extends IConceptDeclaration {
}

export interface ITransactionDeclaration extends IConceptDeclaration {
}

export interface IEventDeclaration extends IConceptDeclaration {
}

export interface IProperty extends IConcept {
   name: string;
   isArray: boolean;
   isOptional: boolean;
   decorators?: IDecorator[];
   location?: IRange;
}

export type PropertyUnion = IRelationshipProperty | 
IObjectProperty | 
IBooleanProperty | 
IDateTimeProperty | 
IStringProperty | 
IDoubleProperty | 
IIntegerProperty | 
ILongProperty;

export interface IRelationshipProperty extends IProperty {
   type: ITypeIdentifier;
}

export interface IObjectProperty extends IProperty {
   defaultValue?: string;
   type: ITypeIdentifier;
}

export interface IBooleanProperty extends IProperty {
   defaultValue?: boolean;
}

export interface IDateTimeProperty extends IProperty {
}

export interface IStringProperty extends IProperty {
   defaultValue?: string;
   validator?: IStringRegexValidator;
   lengthValidator?: IStringLengthValidator;
}

export interface IStringRegexValidator extends IConcept {
   pattern: string;
   flags: string;
}

export interface IStringLengthValidator extends IConcept {
   minLength?: number;
   maxLength?: number;
}

export interface IDoubleProperty extends IProperty {
   defaultValue?: number;
   validator?: IDoubleDomainValidator;
}

export interface IDoubleDomainValidator extends IConcept {
   lower?: number;
   upper?: number;
}

export interface IIntegerProperty extends IProperty {
   defaultValue?: number;
   validator?: IIntegerDomainValidator;
}

export interface IIntegerDomainValidator extends IConcept {
   lower?: number;
   upper?: number;
}

export interface ILongProperty extends IProperty {
   defaultValue?: number;
   validator?: ILongDomainValidator;
}

export interface ILongDomainValidator extends IConcept {
   lower?: number;
   upper?: number;
}

export interface IAliasedType extends IConcept {
   name: string;
   aliasedName: string;
}

export interface IImport extends IConcept {
   namespace: string;
   uri?: string;
}

export type ImportUnion = IImportAll | 
IImportType | 
IImportTypes;

export interface IImportAll extends IImport {
}

export interface IImportType extends IImport {
   name: string;
}

export interface IImportTypes extends IImport {
   types: string[];
   aliasedTypes?: IAliasedType[];
}

export interface IModel extends IConcept {
   namespace: string;
   sourceUri?: string;
   concertoVersion?: string;
   imports?: IImport[];
   declarations?: IDeclaration[];
   decorators?: IDecorator[];
}

export interface IModels extends IConcept {
   models: IModel[];
}

export interface IScalarDeclaration extends IDeclaration {
}

export type ScalarDeclarationUnion = IBooleanScalar | 
IIntegerScalar | 
ILongScalar | 
IDoubleScalar | 
IStringScalar | 
IDateTimeScalar;

export interface IBooleanScalar extends IScalarDeclaration {
   defaultValue?: boolean;
}

export interface IIntegerScalar extends IScalarDeclaration {
   defaultValue?: number;
   validator?: IIntegerDomainValidator;
}

export interface ILongScalar extends IScalarDeclaration {
   defaultValue?: number;
   validator?: ILongDomainValidator;
}

export interface IDoubleScalar extends IScalarDeclaration {
   defaultValue?: number;
   validator?: IDoubleDomainValidator;
}

export interface IStringScalar extends IScalarDeclaration {
   defaultValue?: string;
   validator?: IStringRegexValidator;
   lengthValidator?: IStringLengthValidator;
}

export interface IDateTimeScalar extends IScalarDeclaration {
   defaultValue?: string;
}

