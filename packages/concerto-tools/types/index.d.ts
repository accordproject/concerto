import { AssetDeclaration, ClassDeclaration, ConceptDeclaration, EnumDeclaration, EnumValueDeclaration, ModelManager, ModelFile, Field, Relationship, RelationshipDeclaration, TransactionDeclaration } from '@accordproject/concerto';

declare module '@accordproject/concerto-tools' {
  export abstract class AbstractPlugin {
    addClassImports(clazz: ClassDeclaration, parameters: any, options: any): void;
    addClassAnnotations(clazz: ClassDeclaration, parameters: any, options: any): void;
    addClassMethods(clazz: ClassDeclaration, parameters: any, options: any): void;
    addEnumAnnotations(enumDecl: EnumDeclaration, parameters: any, options: any): void;
  }
  
  export class GoLangVisitor {
    visit(thing: any, parameters: any): any | null;
    visitModelManager(modelManager: ModelManager, parameters: any): any | null;
    visitModelFile(modelFile: ModelFile, parameters: any): any | null;
    visitEnumDeclaration(enumDeclaration: EnumDeclaration, parameters: any): any | null;
    visitClassDeclaration(classDeclaration: ClassDeclaration, parameters: any): any | null;
    visitField(field: Field, parameters: any): any | null;
    visitEnumValueDeclaration(enumValueDeclaration: EnumValueDeclaration, parameters: any): any | null;
    visitRelationship(relationship: Relationship, parameters: any): any | null;
    containsDateTimeField(modelFile: ModelFile): boolean;
    toGoType(type: string): string;
    toGoPackageName(namespace: string): string;
  }
  
  export class JSONSchemaVisitor {
    visit(thing: any, parameters: any): any | null;
    visitModelManager(modelManager: ModelManager, parameters: any): any | null;
    visitModelFile(modelFile: ModelFile, parameters: any): any | null;
    visitAssetDeclaration(assetDeclaration: AssetDeclaration, parameters: any): any | null;
    visitTransactionDeclaration(transactionDeclaration: TransactionDeclaration, parameters: any): any | null;
    visitConceptDeclaration(conceptDeclaration: ConceptDeclaration, parameters: any): any | null;
    visitClassDeclaration(classDeclaration: ClassDeclaration, parameters: any): any | null;
    visitClassDeclarationCommon(classDeclaration: ClassDeclaration, parameters: any, jsonSchema: any): any | null;
    visitField(field: Field, parameters: any): any | null;
    visitEnumValueDeclaration(enumValueDeclaration: EnumValueDeclaration, parameters: any): any | null;
    visitRelationshipDeclaration(relationshipDeclaration: RelationshipDeclaration, parameters: any): any | null;
  }
  
  export class XmlSchemaVisitor {
    visit(thing: any, parameters: any): any | null;
    visitModelManager(modelManager: ModelManager, parameters: any): any | null;
    visitModelFile(modelFile: ModelFile, parameters: any): any | null;
    visitEnumDeclaration(enumDeclaration: EnumDeclaration, parameters: any): any | null;
    visitClassDeclaration(classDeclaration: ClassDeclaration, parameters: any): any | null;
    visitField(field: Field, parameters: any): any | null;
    visitEnumValueDeclaration(enumValueDeclaration: EnumValueDeclaration, parameters: any): any | null;
    visitRelationship(relationship: Relationship, parameters: any): any | null;
    toXsType(type: string): string;
  }
  
  export class PlantUMLVisitor {
    visit(thing: any, parameters: any): any | null;
    visitModelManager(modelManager: ModelManager, parameters: any): any | null;
    visitModelFile(modelFile: ModelFile, parameters: any): any | null;
    visitAssetDeclaration(assetDeclaration: AssetDeclaration, parameters: any): any | null;
    visitEnumDeclaration(enumDeclaration: EnumDeclaration, parameters: any): any | null;
    visitParticipantDeclaration(classDeclaration: ClassDeclaration, parameters: any): any | null;
    visitTransactionDeclaration(transactionDeclaration: TransactionDeclaration, parameters: any): any | null;
    visitClassDeclaration(classDeclaration: ClassDeclaration, parameters: any): any | null;
    visitField(field: Field, parameters: any): any | null;
    visitEnumValueDeclaration(enumValueDeclaration: EnumValueDeclaration, parameters: any): any | null;
    visitRelationship(relationship: Relationship, parameters: any): any | null;
  }
  
  export class TypescriptVisitor {
    visit(thing: any, parameters: any): any | null;
    visitModelManager(modelManager: ModelManager, parameters: any): any | null;
    visitModelFile(modelFile: ModelFile, parameters: any): any | null;
    visitEnumDeclaration(enumDeclaration: EnumDeclaration, parameters: any): any | null;
    visitClassDeclaration(classDeclaration: ClassDeclaration, parameters: any): any | null;
    visitField(field: Field, parameters: any): any | null;
    visitEnumValueDeclaration(enumValueDeclaration: EnumValueDeclaration, parameters: any): any | null;
    visitRelationship(relationship: Relationship, parameters: any): any | null;
    toTsType(type: string): string;
  }
  
  export class JavaVisitor {
    visit(thing: any, parameters: any): any | null;
    visitModelManager(modelManager: ModelManager, parameters: any): any | null;
    visitModelFile(modelFile: ModelFile, parameters: any): any | null;
    startClassFile(classDeclaration: ClassDeclaration, parameters: any): any | null;
    endClassFile(classDeclaration: ClassDeclaration, parameters: any): any | null;
    visitEnumDeclaration(enumDeclaration: EnumDeclaration, parameters: any): any | null;
    visitClassDeclaration(classDeclaration: ClassDeclaration, parameters: any): any | null;
    visitField(field: Field, parameters: any): any | null;
    visitEnumValueDeclaration(enumValueDeclaration: EnumValueDeclaration, parameters: any): any | null;
    visitRelationship(relationship: Relationship, parameters: any): any | null;
    toJavaType(type: string): string;
    capitalizeFirstLetter(s: string): string;
  }
  
  export const version: any;
}
