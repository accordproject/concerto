/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: org.accordproject.decoratorcommands@0.4.0

// imports
import {IDecorator} from './concerto.metamodel@1.0.0';
import {IConcept} from './concerto@1.0.0';

// interfaces
export interface IDecoratorCommandSetReference extends IConcept {
   name: string;
   version: string;
}

export enum CommandType {
   UPSERT = 'UPSERT',
   APPEND = 'APPEND',
}

export interface ICommandTarget extends IConcept {
   namespace?: string;
   declaration?: string;
   property?: string;
   properties?: string[];
   type?: string;
   mapElement?: MapElement;
}

export enum MapElement {
   KEY = 'KEY',
   VALUE = 'VALUE',
   KEY_VALUE = 'KEY_VALUE',
}

export interface ICommand extends IConcept {
   target: ICommandTarget;
   decorator: IDecorator;
   type: CommandType;
   decoratorNamespace?: string;
}

export interface IDecoratorCommandSet extends IConcept {
   name: string;
   version: string;
   includes?: IDecoratorCommandSetReference[];
   commands: ICommand[];
}

