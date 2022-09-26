import AbstractPlugin = require("./abstractplugin");
import GoLangVisitor = require("./fromcto/golang/golangvisitor");
import JSONSchemaVisitor = require("./fromcto/jsonschema/jsonschemavisitor");
import XmlSchemaVisitor = require("./fromcto/xmlschema/xmlschemavisitor");
import PlantUMLVisitor = require("./fromcto/plantuml/plantumlvisitor");
import TypescriptVisitor = require("./fromcto/typescript/typescriptvisitor");
import JavaVisitor = require("./fromcto/java/javavisitor");
import GraphQLVisitor = require("./fromcto/graphql/graphqlvisitor");
import CSharpVisitor = require("./fromcto/csharp/csharpvisitor");
import ODataVisitor = require("./fromcto/odata/odatavisitor");
export declare namespace formats {
    export { GoLangVisitor as golang };
    export { JSONSchemaVisitor as jsonschema };
    export { XmlSchemaVisitor as xmlschema };
    export { PlantUMLVisitor as plantuml };
    export { TypescriptVisitor as typescript };
    export { JavaVisitor as java };
    export { GraphQLVisitor as graphql };
    export { CSharpVisitor as csharp };
    export { ODataVisitor as odata };
}
export { AbstractPlugin, GoLangVisitor, JSONSchemaVisitor, XmlSchemaVisitor, PlantUMLVisitor, TypescriptVisitor, JavaVisitor, GraphQLVisitor, CSharpVisitor, ODataVisitor };
