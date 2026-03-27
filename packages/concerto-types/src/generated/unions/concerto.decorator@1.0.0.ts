/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: concerto.decorator@1.0.0

/**
 * Represents a generic decorator in the Concerto model.
 */
export interface IDecorator extends IConcept {
}

/**
 * Represents a .NET namespace decorator.
 */
export interface IDotNetNamespace extends IDecorator {
   /**
    * The namespace value.
    */
   namespace: string;
}
