# Concerto


![Build Status](https://travis-ci.org/accordproject/concerto.svg?branch=master)
[![GitHub license](https://img.shields.io/github/license/accordproject/concerto?color=bright-green)](./LICENSE)
[![downloads](https://img.shields.io/npm/dm/@accordproject/concerto)](https://www.npmjs.com/package/@accordproject/concerto)
[![npm version](https://badge.fury.io/js/%40accordproject%2Fconcerto.svg)](https://badge.fury.io/js/%40accordproject%2Fconcerto)
[![join slack](https://img.shields.io/badge/Slack-Join%20Slack-blue)](https://accord-project-slack-signup.herokuapp.com/)


Concerto is a lightweight 100% JavaScript schema language and runtime. It works in both a Node.js process and in your browser. The browserified version of Concerto is ±280KB. We are working on making it even smaller.

Things you can do using Concerto:
- Define an object-oriented model using a domain-specific language that is much easier to read and write than JSON/XML Schema, XMI or equivalents. The metamodel gives you "just enough" expressivity to capture real-world business models, while remaining easy to map to most runtime environments.
- Optionall edit your models using a powerful [VS Code add-on](https://marketplace.visualstudio.com/items?itemName=accordproject.cicero-vscode-extension) with syntax highlighting and validation
- Create runtime instances of your model
- Serialize your instances to JSON
- Deserialize (and optionally validate) instances from JSON
- Instances are JS objects so they are easy to pass around your application
- Introspect the model using a powerful set of APIs
- Convert the model to other formats: JSON Schema, XML Schema, Java, Go, Typescript, Loopback, PlantUML using [concerto-tools](https://github.com/accordproject/concerto-tools).
- Import models from URLs
- Publish your reusable models to any website, including the Accord Project Open Source model repository, hosted at: https://models.accordproject.org

# Installation

```
npm install @accordproject/concerto --save
```

# Create a Concerto File

```
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

```
const ModelManager = require('@accordproject/concerto').ModelManager;

const modelManager = new ModelManager();
modelManager.addModelFile( concertoFileText, 'filename.cto');
```

# Create an Instance

```
const Factory = require('@accordproject/concerto').Factory;

const factory = new Factory(modelManager);
const postalAddress = factory.newConcept('org.acme.address', 'PostalAddress');
postalAddress.streetAddress = '1 Maine Street';
```

# Serialize an Instance to JSON

```
const Serializer = require('@accordproject/concerto').Serializer;

const serializer = new Serializer(factory, modelManager);
const plainJsObject = serializer.toJSON(postalAddress); // instance will be validated
console.log(JSON.stringify(plainJsObject, null, 4);
```

# Deserialize an Instance from JSON

```
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

```
namespace foo
```

Every Concerto file starts with the name of a single namespace. All the definitions within a single file therefore belong to the same namespace. The `ModelManager` will refuse to load two model files that have the same namespace.

## Imports

To reference types defined in one namespace in another namespace the types must be imported.

Imports can either be qualified, or can use wildcards.

```
import org.accordproject.address.PostalAddress
```

```
import org.accordproject.address.*
```

Imports can also use the optional `from` declaration to import a model files that has been deployed to a URL.

```
import org.accordproject.address.PostalAddress from https://models.accordproject.org/address.cto
```

Imports that use a `from` declaration can be downloaded into the model manager by calling `modelManager.updateExternalModels`.

The Model Manager will resolve all imports to ensure that the set of declarations that have been loaded are globally consistent. 

## Concepts

Concepts are similar to class declarations in most object-oriented languages, in that they may have a super-type and a set of typed properties:

```
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

```
asset Vehicle identified by vin {
  o String vin
}
```

Assets are typically used in your models for the long-lived identifiable Things (or nouns) in the model: cars, orders, shipping containers, products etc.

## Participants

An participant is a class declaration that has a single `String` property that acts as an identifier. Use the `modelManager.getParticipantDeclarations` API to look up all participants.

```
participant Customer identified by email {
  o String email
}
```

Participants are typically used in your models for the identifiable people or organizations in the model: person, customer, company, business, auditor etc.

## Transactions

An transaction is a class declaration that has a single `String` property that acts as an identifier. Use the `modelManager.getTransactionDeclarations` API to look up all transactions.

```
transaction Order identified by orderId {
  o String orderId
}
```

Transactions are typically used in your models for the identifiable business events or messages that are submitted by Participants to change the state of Assets: cart check out, change of address, identity verification, place order etc.

## Enumerations & Enumeration Values

Use enumerations to capture lists of domain values.

```
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

```
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

```
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

```
concept OrderLine {
  o String sku
}
asset Order identified by orderId {
  o String orderId
  o OrderLine[] orderlines
}
```

Whereas this model declares that an `Order` has-an array of reference to `OrderLine`s. Deleting the `Order` has no impact on the `OrderLine`. When the `Order` is serialized the JSON only the IDs of the `OrderLines` are stored within the `Order`, not the `OrderLines` themselves.

```
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

```
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

```
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
