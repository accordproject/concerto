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
- **System Types Included**: each concept lists its implicit system super types (`concerto@1.0.0.Asset`, `Concept` and so on) and the system properties it inherits from them (`$identifier`, `$timestamp`), marked `isSystem`.
- **Property Kinds**: properties whose type is an enum or a map declared in the document are flagged `isEnum` or `isMap`.
- **Complete Vocabulary**: every `@Term` and `@Term_*` decorator is in `vocabulary`, wherever it is among an element's decorators.

> Concerto (Metamodel) → Concertino → Concerto (Metamodel)

## Format Versioning

A Concertino document records the version of the format it was written in as `metadata.concertinoVersion`. This package writes format version **5.1.0** (`CONCERTINO_VERSION`, exported by every entry point). The format is specified by `src/spec/concertino.cto` (namespace `concertino.metamodel@5.1.0`) and checked by `src/spec/concertino.schema.json`.

The format version follows [semantic versioning](https://semver.org):

- A new **minor** version only adds optional fields. Every document of an earlier minor version of the same major is still a valid document, and is read the same way. A reader ignores the optional fields it does not know, so it can read documents of a later minor version too.
- A new **patch** version changes no fields.
- Only a new **major** version may remove or rename a field, or change what it means.

`load` (`./runtime`) and every `./validate` entry point accept a document of major version 5 (any `5.x.y`) and throw a `ConcertinoVersionError` for a missing or malformed `concertinoVersion` or another major version, such as the pre-release `4.0.0-alpha.2` format. `checkConcertinoVersion(document)` runs the same check on its own. The schema check (`isValid`) is strict: it describes this package's version, so it rejects a field from a later minor version.

The format version is not the npm package version: the package is released with the rest of the Concerto monorepo, and a new major release of the package does not change the format version.

| format version | changes |
|---|---|
| 5.0.0 | the format of Concertino 5.0.0 |
| 5.1.0 | additive: `systemSuperTypes` on concept declarations; the inherited system properties (`$identifier` of assets and participants, `$timestamp` of transactions and events, now inherited from the system type rather than an own property), marked `isSystem`; `isEnum` (declared in 5.0.0 but never written) and `isMap` on properties; `decoratorOrder` on every decorated element, so that every vocabulary term goes to `vocabulary` (5.0.0 kept a term that was not in leading position in `metadata`) |

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

### Checking a document against the Concertino schema

`converter.isValid(concertino)` checks a document against `concertino.schema.json`, and `converter.getValidationErrors()` returns the errors of the last check (ajv error objects), or `null`.

The schema checks are compiled at build time, so the package needs neither `ajv` nor `new Function` at run time (a strict Content-Security-Policy is fine). To check documents without the converter, import the `./schema` subpath:

```javascript
const { isValid, checkSchema } = require('@accordproject/concertino/schema');

isValid(concertino);     // true or false
checkSchema(concertino); // null, or the errors
```

`convertToConcertino` and `convertToMetamodel` imported on their own leave the schema checks out of a bundle.

### Querying a Concertino document

The `./runtime` subpath is a small introspection layer over a Concertino document: plain functions, so a bundler keeps only the ones an app calls. It needs neither concerto-core nor the Rust engine.

```javascript
const { load, getProperties, getIdentifierFieldName, getSuperTypes, propertyKind } = require('@accordproject/concertino/runtime');

const model = load(concertino); // a Concertino document, e.g. built ahead of time
getProperties(model, 'org.example.models@1.0.0.Person').map((p) => p.name);
getIdentifierFieldName(model, 'org.example.models@1.0.0.Person'); // null: not identified
```

`load` adds the system model (`concerto@1.0.0.Concept`, `Asset`, `Participant`, `Transaction` and `Event`), which Concertino does not hold, so the implicit super type and the `$identifier` of an asset or participant declared without `extends` or `identified by` are answered as concerto-core answers them.

| function | concerto-core equivalent |
|---|---|
| `getType`, `getNamespaces`, `getDeclarationNames` | `ModelManager.getType`, `getNamespaces`, `ModelFile.getAllDeclarations` |
| `kindOf`, `isClass`, `isEnum`, `isMap`, `isScalar`, `isAbstract`, `isTransaction`, `isEvent` | the `Declaration` predicates |
| `getSuperTypes`, `derivesFrom`, `isAssignableTo`, `getAssignableTypes` | `getAllSuperTypeDeclarations`, `ModelManager.derivesFrom`, `ModelUtil.isAssignableTo`, `getAssignableClassDeclarations` |
| `getProperties`, `getProperty`, `propertyKind` | `getProperties` (`getOwnProperties` with `own`), `getProperty` |
| `getIdentifierFieldName`, `isIdentified`, `isSystemIdentified` | the `ClassDeclaration` methods of the same names |
| `getEnumValues`, `getMapTypes` | the enum's values, `MapDeclaration.getKey` / `getValue` |
| `getDecorators`, `getVocabulary`, `getNamespaceDecorators` | decorators of a declaration, property or enum value; `@Term` vocabulary; model-level decorators |

Differences from concerto-core: `getSuperTypes` leaves out `concerto@1.0.0.Concept` (every class derives from it, and `derivesFrom` says so), `isClass` is false for enums, type names are always fully qualified (map key and value types included), and the system properties `$identifier` and `$timestamp` can come in another order. A 5.0.0 document lists `$timestamp` as an own property of transactions and events; from format 5.1.0 it is inherited from the system type, as in concerto-core.

### Validating instances

The `./validate` subpath validates plain JSON instances against a Concertino document, as `Serializer.fromJSON` (then `Serializer.toJSON`) does in concerto-core, again with no dependency on concerto-core or the engine.

```javascript
const { load } = require('@accordproject/concertino/runtime');
const { validate, normalise, check, toJSON, InstanceError } = require('@accordproject/concertino/validate');

const model = load(concertino);
check(model, json);              // { ok: true }, or { ok: false, error }
normalise(model, json);          // the JSON Serializer.toJSON(Serializer.fromJSON(json)) gives
const instance = validate(model, json); // throws an InstanceError, or returns the populated instance
toJSON(model, instance);
```

It follows the Rust engine's plain-JSON route step for step (concerto-core 5 on the engine, including its breaking changes: strict ISO 8601 DateTimes naming a real instant, integral Integer and Long values, relationship map values), so it accepts and rejects the same instances and reports the first error concerto-core reports. An `InstanceError` carries the class of the exception concerto-core throws in its `errorClass` (and `name`): `ValidationException`, `TypeNotFoundException`, `Error` or `TypeError`. Messages are not the same as concerto-core's.

The options are the Serializer's `validate`, `utcOffset`, `strictQualifiedDateTimes` and `acceptResourcesForRelationships`, plus `newId` and `now` for generated identifiers and timestamps. Not covered: instance generation (`Factory`), `rejectUnknownKeys`, `rejectRequiredNull`, and the Serializer's `toJSON` options for relationships.

### Bundle sizes

Each subpath bundled for the browser on its own (esbuild: ESM, browser platform, minified, es2022; `node scripts/bundleSizes.js` after a build). None contains `new Function`, so all run under a strict Content-Security-Policy.

| subpath | raw (KiB) | gzip (KiB) |
|---|---:|---:|
| `.` (every export) | 126.4 | 16.2 |
| `./schema` | 108.6 | 11.3 |
| `./runtime` | 5.0 | 1.9 |
| `./validate` | 19.7 | 6.5 |
| `./validate` and `load` from `./runtime` | 19.8 | 6.6 |

## Model Size

Despite the denormalization of metadata, the JSON serialization of Concertino models are often smaller in size than their Concerto AST equivalents due to a flatter, dictionary-like design and the removal of type-discriminators (i.e. `$class` properties).

It is expected that models that make heavy use of inheritance would be larger than their equivalent Concerto AST.

Note that when converting models, the namespaces in the source Concerto model should be fully resolved (including for local type references).

## Example Concertino JSON Format

Below is an example of how a simple Concerto model is represented in the Concertino format:

```json
{
  "declarations": {
    "org.example.models@1.0.0.Email": {
      "type": "StringScalar",
      "regex": "/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/"
    },
    "org.example.models@1.0.0.Person": {
      "type": "ConceptDeclaration",
      "properties": {
        "firstName": {
          "name": "firstName",
          "type": "String",
          "vocabulary": {
            "label": "Given Name"
          }
        },
        "lastName": {
          "name": "lastName",
          "type": "String",
          "vocabulary": {
            "label": "Family Name"
          }
        },
        "age": {
          "name": "age",
          "type": "Integer",
          "isOptional": true,
          "range": [
            0,
            null
          ]
        },
        "email": {
          "name": "email",
          "type": "String",
          "metadata": {
            "sensitive": null
          },
          "isOptional": true,
          "scalarType": "org.example.models@1.0.0.Email",
          "regex": "/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/"
        },
        "address": {
          "name": "address",
          "type": "org.example.models@1.0.0.Address",
          "vocabulary": {
            "label": "Mailing Address"
          },
          "isOptional": true
        }
      },
      "vocabulary": {
        "label": "Individual",
        "additionalTerms": {
          "plural": "People"
        }
      },
      "systemSuperTypes": [
        "concerto@1.0.0.Concept"
      ]
    },
    "org.example.models@1.0.0.Address": {
      "type": "ConceptDeclaration",
      "properties": {
        "street": {
          "name": "street",
          "type": "String",
          "vocabulary": {
            "label": "Street Address"
          }
        },
        "city": {
          "name": "city",
          "type": "String",
          "vocabulary": {
            "label": "City/Town"
          }
        },
        "zipCode": {
          "name": "zipCode",
          "type": "String"
        },
        "country": {
          "name": "country",
          "type": "String"
        }
      },
      "vocabulary": {
        "label": "Physical Address"
      },
      "systemSuperTypes": [
        "concerto@1.0.0.Concept"
      ]
    }
  },
  "metadata": {
    "concertinoVersion": "5.1.0",
    "models": {
      "org.example.models@1.0.0": {
        "sourceUri": "org/example/models.cto",
        "imports": [],
        "decorators": [
          {
            "$class": "concerto.metamodel@1.0.0.Decorator",
            "name": "license",
            "arguments": [
              {
                "$class": "concerto.metamodel@1.0.0.DecoratorString",
                "value": "Apache-2.0"
              }
            ]
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
  
  o Integer age range=[0,] optional
  
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
