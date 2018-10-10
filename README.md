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

## License <a name="license"></a>
Hyperledger Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Hyperledger Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
