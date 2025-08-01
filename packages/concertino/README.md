# Concertino - A Lightweight Concerto Format Converter

Concertino is a lightweight variant of the Concerto metamodel format, optimized for client applications that need to programmatically introspect declarations without taking a dependency on the full Concerto SDK.

## Features

- **Fully Resolved Type References**: No ambiguous shortnames
- **Flattened Declarations**: Declarations are not nested within models, enabling easier type lookup
- **Denormalized Properties**: Inherited properties are fully denormalized with references to their source types
- **Extended Inheritance Chain**: Concepts list their full inheritance chain, not just immediate parent
- **Scalar Type Denormalization**: For convenience in client applications
- **Strict Mode By Default**: Namespaces are always versioned.

## Lossless Conversion

Concertino is designed for 100% lossless roundtrip conversion:

Concerto (Metamodel) → Concertino → Concerto (Metamodel)

Note that namespaces in the source Concerto model should be fully resolved (including for local type references).

## Installation

```bash
npm install @accordproject/concertino
```

## Usage

### Using the ConcertinoConverter Class

```javascript
const { ConcertinoConverter } = require('@accordproject/concertino');

// Create a converter with custom options
const converter = new ConcertinoConverter({
  version: '0.1.0-alpha.3' // Specify concertino version
});

// Convert from Concerto metamodel to Concertino
const concertino = converter.fromConcertoMetamodel(concertoMetamodel);

// Convert from Concertino back to Concerto metamodel
const metamodel = converter.toConcertoMetamodel(concertino);

```

### Using Individual Functions

```javascript
const { convertToConcertino, convertToMetamodel } = require('@accordproject/concertino');

// Convert from Concerto metamodel to Concertino
const concertino = convertToConcertino(concertoMetamodel);

// Convert from Concertino back to Concerto metamodel
const metamodel = convertToMetamodel(concertino);
```

## File Size Reduction

Basic testing with pretty-printed, uncompressed files shows a 70-80% reduction in file size without loss of expressiveness.

## Example Concertino JSON Format

Below is an example of how a simple Concerto model is represented in the Concertino format:

```json
{
  "declarations": {
    "org.example.models@1.0.0.Person": {
      "type": "ConceptDeclaration",
      "name": {
        "namespace": "org.example.models",
        "localName": "Person",
        "version": "1.0.0"
      },
      "properties": {
        "firstName": {
          "name": "firstName",
          "type": "String",
        },
        "lastName": {
          "name": "lastName",
          "type": "String",
        },
        "age": {
          "name": "age",
          "type": "Integer",
          "isOptional": true,
          "range": [0, 120]
        },
        "email": {
          "name": "email",
          "type": "String",
          "isOptional": true,
          "regex": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        "address": {
          "name": "address",
          "type": "org.example.models@1.0.0.Address",
          "isOptional": true
        }
      }
    },
    "org.example.models@1.0.0.Address": {
      "type": "ConceptDeclaration",
      "name": {
        "namespace": "org.example.models",
        "localName": "Address",
        "version": "1.0.0"
      },
      "properties": {
        "street": {
          "name": "street",
          "type": "String",
          "isOptional": false
        },
        "city": {
          "name": "city",
          "type": "String",
          "isOptional": false
        },
        "zipCode": {
          "name": "zipCode",
          "type": "String",
          "isOptional": false
        },
        "country": {
          "name": "country",
          "type": "String",
          "isOptional": false
        }
      }
    }
  },
  "metadata": {
    "concertinoVersion": "0.1.0-alpha.3",
    "models": {
      "org.example.models@1.0.0": {
        "concertoVersion": "1.0.0",
        "sourceUri": "org/example/models.cto"
      }
    }
  }
}
```

This example demonstrates how Concertino represents:

1. Fully qualified type names as object keys
2. Denormalized properties with their constraints
3. Flattened declarations outside of their model nesting
4. Metadata including versioning information

The equivalent Concerto CTO file would be:

```cs
namespace org.example.models@1.0.0

concept Person {
  o String firstName
  o String lastName
  o Integer age optional range=[0, 120]
  o String email optional regex=/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  o Address address optional
}

concept Address {
  o String street
  o String city
  o String zipCode
  o String country
}
```
