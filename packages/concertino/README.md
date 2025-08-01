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
    "readme@1.0.0.Address": {
      "name": {
        "localName": "Address",
        "namespace": "readme",
        "version": "1.0.0",
      },
      "properties": {
        "city": {
          "name": "city",
          "scalarType": "String",
          "type": "String",
          "vocabulary": {
            "label": "City/Town",
          },
        },
        "country": {
          "name": "country",
          "scalarType": "String",
          "type": "String",
        },
        "street": {
          "name": "street",
          "scalarType": "String",
          "type": "String",
          "vocabulary": {
            "label": "Street Address",
          },
        },
        "zipCode": {
          "name": "zipCode",
          "scalarType": "String",
          "type": "String",
        },
      },
      "type": "ConceptDeclaration",
      "vocabulary": {
        "label": "Physical Address",
      },
    },
    "readme@1.0.0.Email": {
      "name": {
        "localName": "Email",
        "namespace": "readme",
        "version": "1.0.0",
      },
      "regex": "/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/",
      "type": "StringScalar",
    },
    "readme@1.0.0.Person": {
      "name": {
        "localName": "Person",
        "namespace": "readme",
        "version": "1.0.0",
      },
      "properties": {
        "address": {
          "isOptional": true,
          "name": "address",
          "type": "readme@1.0.0.Address",
          "vocabulary": {
            "label": "Mailing Address",
          },
        },
        "age": {
          "isOptional": true,
          "name": "age",
          "range": [
            0,
            null,
          ],
          "scalarType": "Integer",
          "type": "Integer",
        },
        "email": {
          "isOptional": true,
          "metadata": {
            "sensitive": null,
          },
          "name": "email",
          "regex": "/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/",
          "scalarType": "readme@1.0.0.Email",
          "type": "String",
        },
        "firstName": {
          "name": "firstName",
          "scalarType": "String",
          "type": "String",
          "vocabulary": {
            "label": "Given Name",
          },
        },
        "lastName": {
          "name": "lastName",
          "scalarType": "String",
          "type": "String",
          "vocabulary": {
            "label": "Family Name",
          },
        },
      },
      "type": "ConceptDeclaration",
      "vocabulary": {
        "additionalTerms": {
          "plural": "People",
        },
        "label": "Individual",
      },
    },
  },
  "metadata": {
    "concertinoVersion": "0.1.0-alpha.3",
    "models": {
      "org.example.models@1.0.0": {
        "concertoVersion": "1.0.0",
        "sourceUri": "org/example/models.cto",
        "decorators": [
          {
            "name": "license",
            "arguments": ["Apache-2.0"]
          }
        ]
      }
    }
  }
}
```
```

This example demonstrates how Concertino represents:

1. Fully qualified type names as object keys
2. Denormalized properties with their constraints
3. Flattened declarations outside of their model nesting
4. Metadata including versioning information
5. Decorators at the model, concept, and property level
6. Vocabulary with labels and additional terms

The equivalent Concerto CTO file would be:

```cto
@license("Apache-2.0")
namespace org.example.models@1.0.0

@Term("Individual")
@Term_plural("People")
concept Person {
  @Term("Given Name")
  o String firstName
  
  @Term("Family Name")
  o String lastName
  
  o Integer age optional range=[0, 120]
  
  @sensitive
  o String email optional regex=/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  
  @Term("Mailing Address")
  o Address address optional
}

@Term("Physical Address")
concept Address {
  @Term("Street Address")
  o String street
  
  @Term("City/Town")
  o String city
  
  o String zipCode
  o String country
}
```
