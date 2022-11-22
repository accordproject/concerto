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

const AbstractPlugin = require('./abstractplugin');

const GoLangVisitor = require('./fromcto/golang/golangvisitor');
const JSONSchemaVisitor = require('./fromcto/jsonschema/jsonschemavisitor');
const XmlSchemaVisitor = require('./fromcto/xmlschema/xmlschemavisitor');
const PlantUMLVisitor = require('./fromcto/plantuml/plantumlvisitor');
const TypescriptVisitor = require('./fromcto/typescript/typescriptvisitor');
const JavaVisitor = require('./fromcto/java/javavisitor');
const GraphQLVisitor = require('./fromcto/graphql/graphqlvisitor');
const CSharpVisitor = require('./fromcto/csharp/csharpvisitor');
const ODataVisitor = require('./fromcto/odata/odatavisitor');
const MermaidVisitor = require('./fromcto/mermaid/mermaidvisitor');
const MarkdownVisitor = require('./fromcto/markdown/markdownvisitor');
const ProtobufVisitor = require('./fromcto/protobuf/protobufvisitor');
const InferFromJsonSchema = require('./fromJsonSchema/cto/inferModel');
const JsonataVisitor = require('./fromcto/jsonata/jsonatavisitor');

module.exports = {
    AbstractPlugin,
    GoLangVisitor,
    JSONSchemaVisitor,
    XmlSchemaVisitor,
    PlantUMLVisitor,
    TypescriptVisitor,
    JavaVisitor,
    GraphQLVisitor,
    CSharpVisitor,
    ODataVisitor,
    MermaidVisitor,
    MarkdownVisitor,
    ProtobufVisitor,
    InferFromJsonSchema,
    JsonataVisitor,
    formats: {
        golang: GoLangVisitor,
        jsonschema: JSONSchemaVisitor,
        xmlschema: XmlSchemaVisitor,
        plantuml: PlantUMLVisitor,
        typescript: TypescriptVisitor,
        java: JavaVisitor,
        graphql: GraphQLVisitor,
        csharp: CSharpVisitor,
        odata: ODataVisitor,
        mermaid: MermaidVisitor,
        markdown: MarkdownVisitor,
        protobuf: ProtobufVisitor,
        jsonata: JsonataVisitor,
    }
};
