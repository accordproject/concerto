# Concertino - A Lightweight Concerto Format Converter

Concertino is a lightweight variant of the Concerto metamodel format, optimized for client applications that need to programmatically introspect declarations without taking a dependency on the full Concerto SDK.

## Benefits of the Concertino Format
The Concertino format provides several advantages:

- Flatter structure: By denormalizing the inheritance hierarchy, consumers don't need to traverse the hierarchy to understand a definition.

- More explicit metadata: Additional metadata makes it clearer how properties should be interpreted.

- Ready for consumption: The transformation prepares the data for easier consumption by tools and renderers, without requiring additional processing.

## Features

- **Fully Resolved Type References**: No ambiguous shortnames
- **Flattened Declarations**: Declarations are not nested within models, enabling easier type lookup
- **Denormalized Properties**: Inherited properties are fully denormalized with references to their source types
- **Extended Inheritance Chain**: Concepts list their full inheritance chain, not just immediate parent
- **Scalar Type Denormalization**: For convenience in client applications
- **Strict Mode By Default**: Namespaces are always versioned.
- **Support for Partial Models** Allowing client applications to filter models to tailor payloads for their use cases.
- **Lossless Conversion** Concertino is designed for 100% lossless roundtrip conversion with Concerto models.

> Concerto (Metamodel) → Concertino → Concerto (Metamodel)

## Installation

```bash
npm install @accordproject/concertino
```

## Usage

### Using the ConcertinoConverter Class

[Try it in Replit](https://replit.com/@mttrbrts/AccordProjectConcertino?v=1)
```javascript
const { ModelManager } = require('@accordproject/concerto-core');
const { ConcertinoConverter } = require('@accordproject/concertino');

// Prepare the Concerto model
const mm = new ModelManager();
mm.addModel(MODEL_FILE_CONTENTS);
const model = mm.getModelFile(MODEL_FILE_NAMESPACE).getAst();

// Initialize Concertino
const converter = new ConcertinoConverter();
const models = { models: [model] };

// Convert from Concerto metamodel to Concertino
const concertino = converter.fromConcertoMetamodel(models);
console.log('#### Concertino:')
console.log(JSON.stringify(concertino, null, 2));
console.log();

// Convert from Concertino back to Concerto metamodel
const metamodel = converter.toConcertoMetamodel(concertino);
console.log('#### Concerto AST (Full Metamodel Instance):')
console.log(JSON.stringify(metamodel, null, 2));
```

## Model Size

Despite the denormalization of metadata, the JSON serialization of Concertino models are often smaller in size than their Concerto AST equivalents due to a flatter, dictionary-like design and the removal of type-discriminators (i.e. `$class` properties).

It is expected that models that make heavy use of inheritance would be larger than their equivalent Concerto AST.

Note that when converting models, the namespaces in the source Concerto model should be fully resolved (including for local type references).

## Example Concertino JSON Format

Below is an example of how a simple Concerto model is represented in the Concertino format:

```json
{
  "declarations": {
    "readme@1.0.0.Address": {
      "properties": {
        "city": {
          "name": "city",
          "type": "String",
          "vocabulary": {
            "label": "City/Town",
          },
        },
        "country": {
          "name": "country",
          "type": "String",
        },
        "street": {
          "name": "street",
          "type": "String",
          "vocabulary": {
            "label": "Street Address",
          },
        },
        "zipCode": {
          "name": "zipCode",
          "type": "String",
        },
      },
      "type": "ConceptDeclaration",
      "vocabulary": {
        "label": "Physical Address",
      },
    },
    "readme@1.0.0.Email": {
      "regex": "/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/",
      "type": "StringScalar",
    },
    "readme@1.0.0.Person": {
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
          "type": "String",
          "vocabulary": {
            "label": "Given Name",
          },
        },
        "lastName": {
          "name": "lastName",
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
    "concertinoVersion": "4.0.0-alpha.2",
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

The equivalent Concerto CTO file would be:

```cs
@license("Apache-2.0")
namespace org.example.models@1.0.0

scalar Email extends String regex=/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

@Term("Individual")
@Term_plural("People")
concept Person {
  @Term("Given Name")
  o String firstName
  
  @Term("Family Name")
  o String lastName
  
  o Integer age optional range=[0, ]
  
  @sensitive
  o Email email optional 
  
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
