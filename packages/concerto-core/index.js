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

module.exports.AssetDeclaration = require('./lib/introspect/assetdeclaration');
module.exports.BaseException = require('./lib/baseexception');
module.exports.BaseFileException = require('./lib/basefileexception');
module.exports.ClassDeclaration = require('./lib/introspect/classdeclaration');
module.exports.ConceptDeclaration = require('./lib/introspect/conceptdeclaration');
module.exports.EnumDeclaration = require('./lib/introspect/enumdeclaration');
module.exports.EnumValueDeclaration = require('./lib/introspect/enumvaluedeclaration');
module.exports.EventDeclaration = require('./lib/introspect/eventdeclaration');
module.exports.Field = require('./lib/introspect/field');
module.exports.Writer = require('./lib/writer');
module.exports.Factory = require('./lib/factory');
module.exports.Globalize = require('./lib/globalize');
module.exports.Introspector = require('./lib/introspect/introspector');
module.exports.Logger = require('./lib/logger');
module.exports.ModelFile = require('./lib/introspect/modelfile');
module.exports.ModelLoader = require('./lib/modelloader');
module.exports.ModelManager = require('./lib/modelmanager');
module.exports.DefaultModelFileLoader = require('./lib/introspect/loaders/defaultmodelfileloader');
module.exports.ParseException = require('./lib/introspect/parseexception');
module.exports.ParticipantDeclaration = require('./lib/introspect/participantdeclaration');
module.exports.Property = require('./lib/introspect/property');
module.exports.Relationship = require('./lib/model/relationship');
module.exports.RelationshipDeclaration = require('./lib/introspect/relationshipdeclaration');
module.exports.Resource = require('./lib/model/resource');
module.exports.SecurityException = require('./lib/securityexception');
module.exports.Serializer = require('./lib/serializer');
module.exports.TransactionDeclaration = require('./lib/introspect/transactiondeclaration');
module.exports.Typed = require('./lib/model/typed');
module.exports.TypedStack = require('./lib/serializer/typedstack');
module.exports.ModelUtil = require('./lib/modelutil');
module.exports.version = require('./package.json');
module.exports.Concerto = require('./lib/concerto');