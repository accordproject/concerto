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
 * Concerto module. Concerto is a framework for defining domain
 * specific models.
 *
 * @module concerto-core
 */

// Exceptions
module.exports.BaseException = require('./lib/baseexception');
module.exports.BaseFileException = require('./lib/basefileexception');
module.exports.ParseException = require('./lib/introspect/parseexception');
module.exports.SecurityException = require('./lib/securityexception');
module.exports.IllegalModelException = require('./lib/introspect/illegalmodelexception');
module.exports.TypeNotFoundException = require('./lib/typenotfoundexception');

// Decorated
module.exports.Decorator = require('./lib/introspect/decorator');
module.exports.DecoratorFactory = require('./lib/introspect/decoratorfactory');

// ClassDeclarations
module.exports.ClassDeclaration = require('./lib/introspect/classdeclaration');
module.exports.IdentifiedDeclaration = require('./lib/introspect/identifieddeclaration');
module.exports.AssetDeclaration = require('./lib/introspect/assetdeclaration');
module.exports.ConceptDeclaration = require('./lib/introspect/conceptdeclaration');
module.exports.EnumValueDeclaration = require('./lib/introspect/enumvaluedeclaration');
module.exports.EventDeclaration = require('./lib/introspect/eventdeclaration');
module.exports.ParticipantDeclaration = require('./lib/introspect/participantdeclaration');
module.exports.TransactionDeclaration = require('./lib/introspect/transactiondeclaration');

// Properties
module.exports.Property = require('./lib/introspect/property');
module.exports.Field = require('./lib/introspect/field');
module.exports.EnumDeclaration = require('./lib/introspect/enumdeclaration');
module.exports.RelationshipDeclaration = require('./lib/introspect/relationshipdeclaration');

// Typed
module.exports.Typed = require('./lib/model/typed');

// Identifiables
module.exports.Identifiable = require('./lib/model/identifiable');
module.exports.Relationship = require('./lib/model/relationship');
module.exports.Resource = require('./lib/model/resource');

// Writers
module.exports.Writer = require('./lib/writer');

// Factory
module.exports.Factory = require('./lib/factory');

// Globalize
module.exports.Globalize = require('./lib/globalize');

// Introspector
module.exports.Introspector = require('./lib/introspect/introspector');

// ModelFile
module.exports.ModelFile = require('./lib/introspect/modelfile');

// ModelManager
module.exports.ModelManager = require('./lib/modelmanager');

// Serializer
module.exports.Serializer = require('./lib/serializer');

// ModelUtil
module.exports.ModelUtil = require('./lib/modelutil');

// ModelFileLoaders
module.exports.DefaultModelFileLoader = require('./lib/introspect/loaders/defaultmodelfileloader');

// ModelLoader
module.exports.ModelLoader = require('./lib/modelloader');


// DateTimeUtil
module.exports.DateTimeUtil = require('./lib/datetimeutil');

// Logger
module.exports.Logger = require('./lib/logger');

// TypedStack
module.exports.TypedStack = require('./lib/serializer/typedstack');

// Concerto
module.exports.Concerto = require('./lib/concerto');

// Version
module.exports.version = require('./package.json');
