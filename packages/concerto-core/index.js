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

'use strict';

/**
 * Concerto core module. Concerto is a framework for defining domain
 * specific models.
 *
 * @module concerto-core
 */

// Exceptions
export const SecurityException = require('./lib/securityexception');
export const IllegalModelException = require('./lib/introspect/illegalmodelexception');
export const TypeNotFoundException = require('./lib/typenotfoundexception');
export const MetamodelException = require('./lib/metamodelexception');

// Decorated
export const Decorator = require('./lib/introspect/decorator');
export const DecoratorFactory = require('./lib/introspect/decoratorfactory');

// ClassDeclarations
export const ClassDeclaration = require('./lib/introspect/classdeclaration');
export const IdentifiedDeclaration = require('./lib/introspect/identifieddeclaration');
export const AssetDeclaration = require('./lib/introspect/assetdeclaration');
export const ConceptDeclaration = require('./lib/introspect/conceptdeclaration');
export const EnumValueDeclaration = require('./lib/introspect/enumvaluedeclaration');
export const EventDeclaration = require('./lib/introspect/eventdeclaration');
export const ParticipantDeclaration = require('./lib/introspect/participantdeclaration');
export const TransactionDeclaration = require('./lib/introspect/transactiondeclaration');
export const ScalarDeclaration = require('./lib/introspect/scalardeclaration');

// MapDeclaration
export const MapDeclaration = require('./lib/introspect/mapdeclaration');
export const MapKeyType = require('./lib/introspect/mapkeytype');
export const MapValueType = require('./lib/introspect/mapvaluetype');

// Properties
export const Property = require('./lib/introspect/property');
export const Field = require('./lib/introspect/field');
export const EnumDeclaration = require('./lib/introspect/enumdeclaration');
export const RelationshipDeclaration = require('./lib/introspect/relationshipdeclaration');

// Validators
export const Validator = require('./lib/introspect/validator');
export const NumberValidator = require('./lib/introspect/numbervalidator');
export const StringValidator = require('./lib/introspect/stringvalidator');

// Typed
export const Typed = require('./lib/model/typed');

// Identifiables
export const Identifiable = require('./lib/model/identifiable');
export const Relationship = require('./lib/model/relationship');
export const Resource = require('./lib/model/resource');

// Factory
export const Factory = require('./lib/factory');

// Globalize
export const Globalize = require('./lib/globalize');

// Introspector
export const Introspector = require('./lib/introspect/introspector');

// ModelFile
export const ModelFile = require('./lib/introspect/modelfile');

// ModelManager
export const ModelManager = require('./lib/modelmanager');

// Serializer
export const Serializer = require('./lib/serializer');

// ModelUtil
export const ModelUtil = require('./lib/modelutil');

// ModelLoader
export const ModelLoader = require('./lib/modelloader');

// DecoratorManager
export const DecoratorManager = require('./lib/decoratormanager');

// DateTimeUtil
export const DateTimeUtil = require('./lib/datetimeutil');

// Concerto
export const Concerto = require('./lib/concerto');

// MetaModel
export const MetaModel = require('./lib/introspect/metamodel');

// Version
/** @type {{ name: string, version: string }} */
export const version = require('./package.json');
