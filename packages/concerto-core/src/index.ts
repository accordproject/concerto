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

/**
 * Concerto core module. Concerto is a framework for defining domain
 * specific models.
 *
 * @module concerto-core
 */

import SecurityException = require("./securityexception");
import IllegalModelException = require("./introspect/illegalmodelexception");
import TypeNotFoundException = require("./typenotfoundexception");
import MetamodelException = require("./metamodelexception");
import Decorator = require("./introspect/decorator");
import DecoratorFactory = require("./introspect/decoratorfactory");
import DecoratorManager = require("./decoratormanager");
import Declaration = require("./introspect/declaration");
import ClassDeclaration = require("./introspect/classdeclaration");
import IdentifiedDeclaration = require("./introspect/identifieddeclaration");
import AssetDeclaration = require("./introspect/assetdeclaration");
import ConceptDeclaration = require("./introspect/conceptdeclaration");
import EnumValueDeclaration = require("./introspect/enumvaluedeclaration");
import EventDeclaration = require("./introspect/eventdeclaration");
import ParticipantDeclaration = require("./introspect/participantdeclaration");
import TransactionDeclaration = require("./introspect/transactiondeclaration");
import ScalarDeclaration = require("./introspect/scalardeclaration");
import MapDeclaration = require("./introspect/mapdeclaration");
import MapKeyType = require("./introspect/mapkeytype");
import MapValueType = require("./introspect/mapvaluetype");
import Property = require("./introspect/property");
import Field = require("./introspect/field");
import EnumDeclaration = require("./introspect/enumdeclaration");
import RelationshipDeclaration = require("./introspect/relationshipdeclaration");
import Validator = require("./introspect/validator");
import NumberValidator = require("./introspect/numbervalidator");
import StringValidator = require("./introspect/stringvalidator");
import Typed = require("./model/typed");
import Identifiable = require("./model/identifiable");
import Relationship = require("./model/relationship");
import Resource = require("./model/resource");
import Factory = require("./factory");
import Globalize = require("./globalize");
import Introspector = require("./introspect/introspector");
import ModelFile = require("./introspect/modelfile");
export import ModelManager = require("./modelmanager");
import Serializer = require("./serializer");
import ModelUtil = require("./modelutil");
import ModelLoader = require("./modelloader");
import DateTimeUtil = require("./datetimeutil");
import MetaModel = require("./introspect/metamodel");
export type version = {
    name: string;
    version: string;
};
export { SecurityException, IllegalModelException, TypeNotFoundException, MetamodelException, Decorator, DecoratorFactory, DecoratorManager, Declaration, ClassDeclaration, IdentifiedDeclaration, AssetDeclaration, ConceptDeclaration, EnumValueDeclaration, EventDeclaration, ParticipantDeclaration, TransactionDeclaration, ScalarDeclaration, MapDeclaration, MapKeyType, MapValueType, Property, Field, EnumDeclaration, RelationshipDeclaration, Validator, NumberValidator, StringValidator, Typed, Identifiable, Relationship, Resource, Factory, Globalize, Introspector, ModelFile, Serializer, ModelUtil, ModelLoader, DateTimeUtil, MetaModel };