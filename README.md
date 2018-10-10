# Concerto

Concerto is a lightweight 100% JavaScript schema language and runtime. It works in both a Node.js process and in your browser. The browserified version of Concerto is ±50KB.

> Note that this module originated as part of Hyperleger Composer, but it no longer has **any** dependencies on any blockchain technology.

Things you can do using Concerto:
- Define an object-oriented model using a domain-specific language that is much easier to read and write than JSON/XML Schema, XMI or equivalents. The metamodel gives you "just enough" expressivity to capture real-world business models, while remaining easy to map to most runtime environments.
- Use a powerful VS Code add-on with syntax highlighting and validation
- Create runtime instances of your model
- Serialize your instances to JSON
- Deserialize (and optionally validate) instances from JSON
- Introspect the model using a powerful set of APIs
- Convert the model to other formats: JSON Schema, XML Schema, Java, Go, Typescript, Loopback, PlantUML...
- Import models from URLs
- Publish your models to the Accord Project Open Source model repository, hosted at: https://models.accordproject.org

# Projects using Concerto
- Hyperleger Composer
- Accord Project Cicero and Ergo
- Clause.io

# Installation

```
npm install composer-concerto --save
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
const ModelManager = require('composer-concerto').ModelManager;

const modelManager = new ModelManager();
modelManager.addModelFile( concertoFileText, 'filename.cto');
```

# Create an Instance

```
const Factory = require('composer-concerto').Factory;

const factory = new Factory(modelManager);
const postalAddress = factory.newConcept('org.acme.address', 'PostalAddress');
postalAddress.streetAddress = '1 Maine Street';
```

# Serialize an Instance to JSON

```
const Serializer = require('composer-concerto').Serializer;

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
- Namespaces
- Imports
- Concepts
- Assets
- Participants
- Transactions
- Enumerations & Enumeration Values
- Properties & Meta Properties
- Relationships
- Decorators

## Namespaces

```
namespace foo
```

Every Concerto file starts with the name of a single namespace. All the definitions within a single file therefore belong to the same namespace. The `ModelManager` will refuse to load to model files that have the same namespace.

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
asbtract concept Animal {
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

## Participants

An participant is a class declaration that has a single `String` property that acts as an identifier. Use the `modelManager.getParticipantDeclarations` API to look up all participants.

```
participant Customer identified by email {
  o String email
}
```

## Transactions

An transaction is a class declaration that has a single `String` property that acts as an identifier. Use the `modelManager.getTransactionDeclarations` API to look up all transactions.

```
transaction Order identified by orderId {
  o String orderId
}
```

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
- DateTime
- String
- Boolean
- Double
- Long
- Integer

### Meta Properties
- [] : declares that the property is an array
- optional : declares that the property is not required for the instance to be valid
- default : declares a default value for the property, if not value is specified
- range : declares a valid range for numeric properties
- regex : declares a validation regex for string properties

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


## License <a name="license"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
