<h1 align="center">Concerto
</h1> 
<p align="center">
  <a href="https://travis-ci.org/accordproject/concerto"><img src="https://travis-ci.org/accordproject/concerto.svg?branch=master" alt="Build Status"></a>
  <a href="https://coveralls.io/github/accordproject/concerto?branch=master"><img src="https://coveralls.io/repos/github/accordproject/concerto/badge.svg?branch=master" alt="Coverage Status"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/accordproject/concerto?color=bright-green" alt="GitHub license"></a>
  <a href="https://www.npmjs.com/package/@accordproject/concerto-cli"><img src="https://img.shields.io/npm/dm/@accordproject/concerto-cli" alt="downloads"></a>
  <a href="https://badge.fury.io/js/%40accordproject%2Fconcerto-cli"><img src="https://badge.fury.io/js/%40accordproject%2Fconcerto-cli.svg" alt="npm version"></a>
  <a href="https://accord-project-slack-signup.herokuapp.com/"><img src="https://img.shields.io/badge/Slack-Join%20Slack-blue" alt="join slack"></a>
  <a href="https://lerna.js.org"><img src="https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg" alt="lerna"></a>
</p>

Concerto is a lightweight 100% JavaScript schema language and runtime. It works in both a Node.js process and in your browser. The browserified version of Concerto is ±280KB. We are working on making it even smaller.

This is why you should care: https://www.accordproject.org/news/strongly-typed-data-for-javascript-and-beyond/

Things you can do using Concerto:
- Define an object-oriented model using a domain-specific language that is much easier to read and write than JSON/XML Schema, XMI or equivalents. The metamodel gives you "just enough" expressivity to capture real-world business models, while remaining easy to map to most runtime environments.
- Optionally edit your models using a powerful [VS Code add-on](https://marketplace.visualstudio.com/items?itemName=accordproject.cicero-vscode-extension) with syntax highlighting and validation
- Create runtime instances of your model
- Serialize your instances to JSON
- Deserialize (and optionally validate) instances from JSON
- Instances are JS objects so they are easy to pass around your application
- Introspect the model using a powerful set of APIs
- Convert the model to other formats: JSON Schema, XML Schema, Java, Go, Typescript, Loopback, PlantUML using [concerto-tools](https://github.com/accordproject/concerto/tree/master/packages/concerto-tools).
- Import models from URLs
- Publish your reusable models to any website, including the Accord Project Open Source model repository, hosted at: https://models.accordproject.org

## Documentation

This mono-repo contains the following packages:

* [concerto-core](https://github.com/accordproject/concerto/tree/master/packages/concerto-core) : core library for model management/parsing/validation/serialization
* [concerto-tools](https://github.com/accordproject/concerto/tree/master/packages/concerto-tools) : model converters and tools for Concerto model files
* [concerto-cli](https://github.com/accordproject/concerto/tree/master/packages/concerto-cli) : command-line interface for Concerto

### Ecosystem


#### Core libraries:
<table>
  <tr>
    <th headers="blank">Projects</th>
    <th headers="blank">Package name</th>
    <th headers="blank">Version</th>
    <th headers="blank">Description</th>
  </tr>
  <tr>
    <td headers><a href="https://github.com/accordproject/cicero">Cicero</a></td>
    <td headers> <a href="https://github.com/accordproject/cicero/tree/master/packages/cicero-core">cicero-core</a></td>
    <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fcicero-core"><img src="https://badge.fury.io/js/%40accordproject%2Fcicero-core.svg" alt="npm version"></a></td>
    <td headers>Templates Core</td>
  </tr>
    <tr>
      <td headers></td>
    <td headers> <a href="https://github.com/accordproject/cicero/tree/master/packages/cicero-cli">cicero-cli</a></td>
      <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fcicero-cli"><img src="https://badge.fury.io/js/%40accordproject%2Fcicero-cli.svg" alt="npm version"></a></td>
      <td headers> Cicero CLI </td>
    </tr>
    <tr>
    <td headers></td>
    <td headers> <a href="https://github.com/accordproject/cicero/tree/master/packages/cicero-engine">cicero-engine</a></td>
    <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fcicero-engine"><img src="https://badge.fury.io/js/%40accordproject%2Fcicero-engine.svg" alt="npm version"></a></td>
    <td headers>Node.js VM based implementation of Accord Protcol Template Specification execution</td>
    </tr>
    <tr>
    <td headers></td>
    <td headers> <a href="https://github.com/accordproject/cicero/tree/master/packages/cicero-server">cicero-server</a></td>
    <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fcicero-server"><img src="https://badge.fury.io/js/%40accordproject%2Fcicero-server.svg" alt="npm version"></a></td>
    <td headers>Wraps the Cicero Engine and exposes it as a RESTful service<td>
    </tr>
    <tr>
    <td headers></td>
    <td headers> <a href="https://github.com/accordproject/cicero/tree/master/packages/cicero-test">cicero-test</a></td>
    <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fcicero-test"><img src="https://badge.fury.io/js/%40accordproject%2Fcicero-test.svg" alt="npm version"></a></td>
    <td headers> Testing support for Cicero based on cucumber</td>
    </tr>
     <tr>
     <td headers></td>
     <td headers> <a href="https://github.com/accordproject/cicero/tree/master/packages/cicero-tools">cicero-tools</a></td>
     <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fcicero-tools"><img src="https://badge.fury.io/js/%40accordproject%2Fcicero-tools.svg" alt="npm version"></a></td>
     <td headers>Cicero Tools</td>
     </tr>
      <tr>
      <td headers="co1 c1"></td>
      <td headers="co2 c1"> <a href="https://github.com/accordproject/cicero/tree/master/packages/generator-cicero-template">generator-cicero-template</a></td>
      <td headers="co3 c1"> <a href="https://badge.fury.io/js/%40accordproject%2Fgenerator-cicero-template"><img src="https://badge.fury.io/js/%40accordproject%2Fgenerator-cicero-template.svg" alt="npm version"></a></td>
      <td headers="co4 c1">Code generator for a Cicero Template</td>
      </tr>
      <tr>
      <td headers><a href="https://github.com/accordproject/concerto">Concerto</a></td>
      <td headers><a href="https://github.com/accordproject/concerto/tree/master/packages/concerto-core">concerto-core</a></td>
      <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fconcerto-core"><img src="https://badge.fury.io/js/%40accordproject%2Fconcerto-core.svg" alt="npm version"></a></td>
      <td headers> Core Implementation for the Concerto Modeling Language</td>
      </tr>
      <tr>
      <td headers></td>
      <td headers><a href="https://github.com/accordproject/concerto/tree/master/packages/concerto-tools">concerto-tools</a></td>
      <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fconcerto-tools"><img src="https://badge.fury.io/js/%40accordproject%2Fconcerto-tools.svg" alt="npm version"></a></td>
      <td headers> Tools for the Concerto Modeling Language</td>
  </tr>
  <tr>
   <td headers></td>
   <td headers><a href="https://github.com/accordproject/concerto/tree/master/packages/concerto-cli">concerto-cli</a></td>
   <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fconcerto-cli"><img src="https://badge.fury.io/js/%40accordproject%2Fconcerto-cli.svg" alt="npm version"></a></td>
   <td headers>command-line interface for Concerto</td>
  </tr>
  <tr>
    <td headers><a href="https://github.com/accordproject/ergo">Ergo</a></td>
    <td headers><a href="https://github.com/accordproject/ergo/tree/master/packages/ergo-cli">ergo-cli</a></td>
    <td headers><a href="https://badge.fury.io/js/%40accordproject%2Fergo-cli"><img src="https://badge.fury.io/js/%40accordproject%2Fergo-cli.svg" alt="npm version"></a></td>
    <td headers>Ergo CLI</td>
  </tr>
  <tr>
    <th id="blank"></th>
    <td headers><a href="https://github.com/accordproject/ergo/tree/master/packages/ergo-compiler">ergo-compiler</a></td>
    <td headers><a href="https://badge.fury.io/js/%40accordproject%2Fergo-compiler"><img src="https://badge.fury.io/js/%40accordproject%2Fergo-compiler.svg" alt="npm version"></a></td>
    <td headers>Ergo compiler</td>
  </tr>
  <tr>
   <th id="blank"></th>
   <td headers><a href="https://github.com/accordproject/ergo/tree/master/packages/ergo-test">ergo-test</a></td>
   <td headers><a href="https://badge.fury.io/js/%40accordproject%2ergo-test"><img src="https://badge.fury.io/js/%40accordproject%2Fergo-test.svg" alt="npm version"></a></td>
   <td headers>Ergo test</td>
   </tr>
    <tr>
    <th id="blank"></th>
    <td headers><a href="https://github.com/accordproject/ergo/tree/master/packages/ergo-engine">ergo-engine</a></td>
    <td headers><a href="https://badge.fury.io/js/%40accordproject%2Fergo-engine"><img src="https://badge.fury.io/js/%40accordproject%2Fergo-engine.svg" alt="npm version"></a></td>
    <td headers>Ergo engine</td>
    </tr>
    <tr>
     <td headers><a href="https://docs.accordproject.org/docs/next/markup-cicero.html">Markdown</a></td>
     <td headers><a href="https://github.com/accordproject/markdown-transform/tree/master/packages/markdown-common">markdown-common</a></td>
     <td headers><a href="https://badge.fury.io/js/%40accordproject%2Fmarkdown-common"><img src="https://badge.fury.io/js/%40accordproject%2Fmarkdown-common.svg" alt="npm version"></a></td>
     <td headers>A framework for transforming markdown</td>
    </tr>
     <tr>
     <th id="blank"></th>
     <td headers><a href="https://github.com/accordproject/markdown-transform/tree/master/packages/markdown-slate">markdown-slate</a></td>
     <td headers><a href="https://badge.fury.io/js/%40accordproject%2Fmarkdown-slate"><img src="https://badge.fury.io/js/%40accordproject%2Fmarkdown-slate.svg" alt="npm version"></a></td>
     <td headers>Transform markdown to/from CommonMark DOM</td>
     </tr>
     <tr>
     <td headers></td>
     <td headers><a href="https://github.com/accordproject/markdown-transform/tree/master/packages/markdown-cli"> markdown-cli </a></td>
     <td headers> <a href="https://badge.fury.io/js/%40accordproject%2Fmarkdown-cli"><img src="https://badge.fury.io/js/%40accordproject%2Fmarkdown-cli.svg" alt="npm version"></a></td>
     <td headers> CLI for markdown transformations.</td>
    </tr>
     <tr>
      <th id="blank"></th>
      <td headers><a href="https://github.com/accordproject/markdown-transform/tree/master/packages/markdown-cicero">markdown-cicero</a></td>
      <td headers><a href="https://badge.fury.io/js/%40accordproject%2Fmarkdown-cicero"><img src="https://badge.fury.io/js/%40accordproject%2Fmarkdown-cicero.svg" alt="npm version"></a></td>
      <td headers>CiceroDOM: Markdown extensions for contracts, clauses, variables etc.</td>
      </tr>
       <tr>
      <th id="blank"></th>
       <td headers><a href="https://github.com/accordproject/markdown-transform/tree/master/packages/markdown-html">markdown-html</a></td>
       <td headers><a href="https://badge.fury.io/js/%40accordproject%2Fmarkdown-html"><img src="https://badge.fury.io/js/%40accordproject%2Fmarkdown-html.svg" alt="npm version"></a></td>
       <td headers>Transform CiceroDOM to HTML</td>
       </tr>
 
</table>

#### UI Components:

<table>
  <tr>
    <th  headers="blank">Projects</th>
    <th  headers="blank">Package name</th>
    <th  headers="blank">Version</th>
    <th  headers="blank">Description</th>
  </tr>
    <tr>
      <td headers>Markdown Editor</td>
      <td headers><a href="https://github.com/accordproject/markdown-editor">markdown-editor</a></td>
      <td headers><img src="https://badge.fury.io/js/%40accordproject%2Fmarkdown-editor.svg" alt="npm version"></a></td>
      <td headers>WYSIWYG rich text web editor that persists text as markdown. Based on Slate.js</td>
    </tr>
     <tr>
     <td headers="co1 c1">Cicero UI</td>
      <td headers="co2 c1"><a href="https://github.com/accordproject/cicero-ui">cicero-ui</a></td>
      <td headers="co3 c1"> <a href="https://badge.fury.io/js/%40accordproject%2Fcicero-ui"><img src="https://badge.fury.io/js/%40accordproject%2Fcicero-ui.svg" alt="npm version"></a></td>
       <td headers="co4 c1">WYSIWYG contract editor, template libary browser, error panel component</td>
     </tr>
     <tr>
     <td headers="co1 c1">Concerto UI</td>
      <td headers="co2 c1"><a href="https://github.com/accordproject/concerto-ui">concerto-ui</a></td>
      <td headers="co3 c1"> <a href="https://badge.fury.io/js/%40accordproject%2Fconcerto-ui-react"><img src="https://badge.fury.io/js/%40accordproject%2Fconcerto-ui-react.svg" alt="npm version"></a></td>
       <td headers="co4 c1">Dynamic web forms generated from Concerto models</td>
     </tr>
</table>
  

#### Template Editors:

<table>
  <tr>
    <th headers="blank">Projects</th>
    <th headers="blank">Cicero ver.</th>
    <th headers="blank">Description</th>
  </tr>
  <tr>
    <td headers><a href="https://github.com/accordproject/template-studio">Template Studio v1</a></td>
    <td headers> <b>0.13.4</b></td>
    <td headers>Web UI for creating, editing and testing Accord Project templates</td>
  </tr>
  <tr>
    <td headers><a href="https://github.com/accordproject/template-studio-v2">Template Studio v2</a></td>
    <td headers> <b>0.13.4</b></td>
    <td headers>Web UI for creating, editing and testing Accord Project templates</td>
  </tr>
   <tr>
    <td headers><a href="https://github.com/accordproject/cicero-vscode-extension">VSCode Extension</a></td>
    <td headers><b>0.13.4</b></td>
    <td headers>VS Code extension for editing Cicero templates and Ergo logic</td>
   </tr>
</table>


#### Public templates and models:

<table>
  <tr>
    <th headers="blank">Projects</th>
    <th headers="blank">Description</th>
  </tr>
  <tr>
    <td headers><a href="https://github.com/accordproject/models">Models</a></td>
    <td headers>Accord Project Model Library </td>
  </tr>
   <tr>
     <td headers><a href="https://github.com/accordproject/cicero-template-library">Template Library</a></td>
     <td headers>Accord Project Template Library </td>
   </tr>
 
</table>


#### Documentation:

<table>
  <tr>
    <th headers="blank">Project</th>
    <th headers="blank">Repo</th>
  </tr>
  <tr>
    <td headers><a href="https://docs.accordproject.org/">Documentation</a></td>
    <td headers><a href="https://github.com/accordproject/techdocs">techdocs</a></td>
  </tr>
 </table>

# Installation

To install the command-line interface:

```
npm install -g @accordproject/concerto-cli
```

To install the core model library in your project:
```
npm install @accordproject/concerto-core --save
```

To install the tools library in your project:
```
npm install @accordproject/concerto-tools --save
```

# Create a Concerto File

```js
namespace org.acme.address

/**
 * This is a concept
 */
concept PostalAddress {
  o String streetAddress optional
  o String postalCode optional
  o String postOfficeBoxNumber optional
  o String addressRegion optional
  o String addressLocality optional
  o String addressCountry optional
}
```

# Create a Model Manager

```js
const ModelManager = require('@accordproject/concerto-core').ModelManager;

const modelManager = new ModelManager();
modelManager.addModelFile( concertoFileText, 'filename.cto');
```

# Create an Instance

```js
const Factory = require('@accordproject/concerto-core').Factory;

const factory = new Factory(modelManager);
const postalAddress = factory.newConcept('org.acme.address', 'PostalAddress');
postalAddress.streetAddress = '1 Maine Street';
```

# Serialize an Instance to JSON

```js
const Serializer = require('@accordproject/concerto-core').Serializer;

const serializer = new Serializer(factory, modelManager);
const plainJsObject = serializer.toJSON(postalAddress); // instance will be validated
console.log(JSON.stringify(plainJsObject, null, 4);
```

# Deserialize an Instance from JSON

```js
const postalAddress = serializer.fromJSON(plainJsObject); // JSON will be validated
console.log(postalAddress.streetAddress);
```

# Metamodel

The Concerto metamodel contains:
- [Namespaces](#namespaces)
- [Imports](#imports)
- [Concepts](#concepts)
- [Assets](#assets)
- [Participants](#participants)
- [Transactions](#transactions)
- [Enumerations & Enumeration Values](#enumerations--enumeration-values)
- [Properties & Meta Properties](#properties-and-meta-properties)
- [Relationships](#relationships)
- [Decorators](#decorators)

## Namespaces

```js
namespace foo
```

Every Concerto file starts with the name of a single namespace. All the definitions within a single file therefore belong to the same namespace. The `ModelManager` will refuse to load two model files that have the same namespace.

## Imports

To reference types defined in one namespace in another namespace the types must be imported.

Imports can either be qualified, or can use wildcards.

```js
import org.accordproject.address.PostalAddress
```

```js
import org.accordproject.address.*
```

Imports can also use the optional `from` declaration to import a model files that has been deployed to a URL.

```js
import org.accordproject.address.PostalAddress from https://models.accordproject.org/address.cto
```

Imports that use a `from` declaration can be downloaded into the model manager by calling `modelManager.updateExternalModels`.

The Model Manager will resolve all imports to ensure that the set of declarations that have been loaded are globally consistent. 

## Concepts

Concepts are similar to class declarations in most object-oriented languages, in that they may have a super-type and a set of typed properties:

```js
abstract concept Animal {
  o DateTime dob
}

concept Dog extends Animal {
 o String breed
}
```

A concept can be declared `abstract` is it should not be instantiated (must be subclassed).

## Assets

An asset is a class declaration that has a single `String` property that acts as an identifier. Use the `modelManager.getAssetDeclarations` API to look up all assets.

```js
asset Vehicle identified by vin {
  o String vin
}
```

Assets are typically used in your models for the long-lived identifiable Things (or nouns) in the model: cars, orders, shipping containers, products etc.

## Participants

A participant is a class declaration that has a single `String` property that acts as an identifier. Use the `modelManager.getParticipantDeclarations` API to look up all participants.

```js
participant Customer identified by email {
  o String email
}
```

Participants are typically used in your models for the identifiable people or organizations in the model: person, customer, company, business, auditor etc.

## Transactions

A transaction is a class declaration that has a single `String` property that acts as an identifier. Use the `modelManager.getTransactionDeclarations` API to look up all transactions.

```js
transaction Order identified by orderId {
  o String orderId
}
```

Transactions are typically used in your models for the identifiable business events or messages that are submitted by Participants to change the state of Assets: cart check out, change of address, identity verification, place order etc.

## Enumerations & Enumeration Values

Use enumerations to capture lists of domain values.

```js
enum Gender {
  o MALE
  o FEMALE
  o OTHER
  o UNKNOWN
}
```

## Properties and Meta Properties

Class declarations contain properties. Each property has a type which can either be a type defined in the same namespace, an imported type or a primitive type.

### Primitive types

Concerto supports the following primitive types:

   |Type | Description|
   |--- | ---|   
|String | a UTF8 encoded String.
|Double | a double precision 64 bit numeric value.
|Integer | a 32 bit signed whole number.
|Long | a 64 bit signed whole number.
|DateTime | an ISO-8601 compatible time instance, with optional time zone and UTZ offset.
|Boolean | a Boolean value, either true or false.

### Meta Properties

|Property|Description|
|---|---|
|[] | declares that the property is an array|
|optional | declares that the property is not required for the instance to be valid|
| default | declares a default value for the property, if not value is specified|
| range | declares a valid range for numeric properties|
| regex | declares a validation regex for string properties|

String fields may include an optional regular expression, which is used to validate the contents of the field. Careful use of field validators allows Concerto to perform rich data validation, leading to fewer errors and less boilerplate application code.

The example below declares that the Farmer participant contains a field postcode that must conform to the regular expression for valid UK postcodes.

```js
participant Farmer extends Participant {
    o String firstName default="Old"
    o String lastName default="McDonald"
    o String address1
    o String address2
    o String county
    o String postcode regex=/(GIR 0AA)|((([A-Z-[QVf]][0-9][0-9]?)|(([A-Z-[QVf]][A-Z-[IJZ]][0-9][0-9]?)|(([A-Z-[QVf]][0-9][A-HJKPSTUW])|([A-Z-[QVf]][A-Z-[IJZ]][0-9][ABEHMNPRVWfY])))) [0-9][A-Z-[CIKMOV]]{2})/
}
```

Double, Long or Integer fields may include an optional range expression, which is used to validate the contents of the field.

The example below declared that the Vehicle asset has an Integer field year which defaults to 2016 and must be 1990, or higher. Range expressions may omit the lower or upper bound if checking is not required.

```js
asset Vehicle extends Base {
  // An asset contains Fields, each of which can have an optional default value
  o String model default="F150"
  o String make default="FORD"
  o String reg default="ABC123"
  // A numeric field can have a range validation expression
  o Integer year default=2016 range=[1990,] optional // model year must be 1990 or higher
  o Integer[] integerArray
  o State state
  o Double value
  o String colour
  o String V5cID regex=/^[A-z][A-z][0-9]{7}/
  o String LeaseContractID
  o Boolean scrapped default=false
  o DateTime lastUpdate optional
  --> Participant owner //relationship to a Participant, with the field named 'owner'.
  --> Participant[] previousOwners optional // Nary relationship
  o Customer customer
}
```

## Relationships

A property of a class may be declared as a relationship using the `-->` syntax instead of the `o` syntax. The `o` syntax declares that the class contains (has-a) property of that type, whereas the `-->` syntax declares a typed pointer to an external identifiable instance.

This model declares that an `Order` has-an array of `OrderLine` concepts. When the `Order` is deleted all the `OrderLines` will also be deleted.

```js
concept OrderLine {
  o String sku
}
asset Order identified by orderId {
  o String orderId
  o OrderLine[] orderlines
}
```

Whereas this model declares that an `Order` has-an array of reference to `OrderLine`s. Deleting the `Order` has no impact on the `OrderLine`. When the `Order` is serialized the JSON only the IDs of the `OrderLines` are stored within the `Order`, not the `OrderLines` themselves.

```js
asset OrderLine identified by orderLineId {
  o String orderLineId
  o String sku
}

asset Order identified by orderId {
  o String orderId
  --> OrderLine[] orderlines
}
```

A relationship is a tuple composed of:

The namespace of the type being referenced
The type name of the type being referenced
The identifier of the instance being referenced

Hence a relationship could be to: `org.example.Vehicle#123456`

This would be a relationship to the `Vehicle` type declared in the `org.example` namespace with the identifier `123456`.

Relationships are unidirectional and deletes do not cascade, ie. removing the relationship has no impact on the thing that is being pointed to. Removing the thing being pointed to does not invalidate the relationship.

Relationships must be resolved to retrieve an instance of the object being referenced. The act of resolution may result in null, if the object no longer exists or the information in the relationship is invalid. Resolution of relationships is outside of the scope of the Model Manager.

## Decorators

Model elements may have arbitrary decorators (aka annotations) placed on them. These are available via API and can be useful for tools to extend the model.

```js
@foo("arg1", 2)
asset Order identified by orderId {
  o String orderId
}
```

Decorators have an arbitrary number of arguments. They support arguments of type:
- String
- Boolean
- Number
- Type reference

Resource definitions and properties may be decorated with 0 or more decorations. Note that only a single instance of a decorator is allowed on each element type. I.e. it is invalid to have the @bar decorator listed twice on the same element.

Decorators are accessible at runtime via the `ModelManager` introspect APIs. This allows tools and utilities to use Concerto to describe a core model, while decorating it with sufficient metadata for their own purposes.

The example below retrieves the 3rd argument to the foo decorator attached to the myField property of a class declaration:

```js
const val = myField.getDecorator('foo').getArguments()[2];
```

## License <a name="license"></a>

Accord Project source code files are made available under the [Apache License, Version 2.0][apache].
Accord Project documentation files are made available under the [Creative Commons Attribution 4.0 International License][creativecommons] (CC-BY-4.0).

Copyright 2018-2019 Clause, Inc. All trademarks are the property of their respective owners. See [LF Projects Trademark Policy](https://lfprojects.org/policies/trademark-policy/).

[linuxfound]: https://www.linuxfoundation.org
[charter]: https://github.com/accordproject/cicero/blob/master/CHARTER.md
[apmain]: https://accordproject.org/ 
[apworkgroup]: https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=MjZvYzIzZHVrYnI1aDVzbjZnMHJqYmtwaGlfMjAxNzExMTVUMjEwMDAwWiBkYW5AY2xhdXNlLmlv&tmsrc=dan%40clause.io
[apblog]: https://medium.com/@accordhq
[apnews]: https://www.accordproject.org/news/
[apgit]:  https://github.com/accordproject/
[apdoc]: https://docs.accordproject.org/
[apslack]: https://accord-project-slack-signup.herokuapp.com

[docspec]: https://docs.accordproject.org/docs/spec-overview.html
[docwelcome]: https://docs.accordproject.org/docs/accordproject.html
[dochighlevel]: https://docs.accordproject.org/docs/spec-concepts.html
[docergo]: https://docs.accordproject.org/docs/logic-ergo.html
[docstart]: https://docs.accordproject.org/docs/accordproject.html
[doccicero]: https://docs.accordproject.org/docs/basic-use.html
[docstudio]: https://docs.accordproject.org/docs/advanced-latedelivery.html

[contributing]: https://github.com/accordproject/cicero/blob/master/CONTRIBUTING.md
[developers]: https://github.com/accordproject/cicero/blob/master/DEVELOPERS.md

[apache]: https://github.com/accordproject/template-studio-v2/blob/master/LICENSE
[creativecommons]: http://creativecommons.org/licenses/by/4.0/
