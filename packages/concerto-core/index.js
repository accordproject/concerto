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
const SecurityException = require('./lib/securityexception');
const IllegalModelException = require('./lib/introspect/illegalmodelexception');
const TypeNotFoundException = require('./lib/typenotfoundexception');

// Decorated
const Decorator = require('./lib/introspect/decorator');
const DecoratorFactory = require('./lib/introspect/decoratorfactory');

// ClassDeclarations
const ClassDeclaration = require('./lib/introspect/classdeclaration');
const IdentifiedDeclaration = require('./lib/introspect/identifieddeclaration');
const AssetDeclaration = require('./lib/introspect/assetdeclaration');
const ConceptDeclaration = require('./lib/introspect/conceptdeclaration');
const EnumValueDeclaration = require('./lib/introspect/enumvaluedeclaration');
const EventDeclaration = require('./lib/introspect/eventdeclaration');
const ParticipantDeclaration = require('./lib/introspect/participantdeclaration');
const TransactionDeclaration = require('./lib/introspect/transactiondeclaration');

// Properties
const Property = require('./lib/introspect/property');
const Field = require('./lib/introspect/field');
const EnumDeclaration = require('./lib/introspect/enumdeclaration');
const RelationshipDeclaration = require('./lib/introspect/relationshipdeclaration');

// Typed
const Typed = require('./lib/model/typed');

// Identifiables
const Identifiable = require('./lib/model/identifiable');
const Relationship = require('./lib/model/relationship');
const Resource = require('./lib/model/resource');

// Factory
const Factory = require('./lib/factory');

// Globalize
const Globalize = require('./lib/globalize');

// Introspector
const Introspector = require('./lib/introspect/introspector');

// ModelFile
const ModelFile = require('./lib/introspect/modelfile');

// ModelManager
const ModelManager = require('./lib/modelmanager');

// Serializer
const Serializer = require('./lib/serializer');

// ModelUtil
const ModelUtil = require('./lib/modelutil');

// ModelLoader
const ModelLoader = require('./lib/modelloader');


// DateTimeUtil
const DateTimeUtil = require('./lib/datetimeutil');

// Concerto
const Concerto = require('./lib/concerto');

// MetaModel
const MetaModel = require('./lib/introspect/metamodel');

// Version
const version = require('./package.json');

module.exports = {
    SecurityException,
    IllegalModelException,
    TypeNotFoundException,
    Decorator,
    DecoratorFactory,
    ClassDeclaration,
    IdentifiedDeclaration,
    AssetDeclaration,
    ConceptDeclaration,
    EnumValueDeclaration,
    EventDeclaration,
    ParticipantDeclaration,
    TransactionDeclaration,
    Property,
    Field,
    EnumDeclaration,
    RelationshipDeclaration,
    Typed,
    Identifiable,
    Relationship,
    Resource,
    Factory,
    Globalize,
    Introspector,
    ModelFile,
    ModelManager,
    Serializer,
    ModelUtil,
    ModelLoader,
    DateTimeUtil,
    Concerto,
    MetaModel,
    version
};
