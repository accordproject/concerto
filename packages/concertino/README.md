# Concertino - A Lightweight Concerto Format Converter

Concertino is a lightweight variant of the Concerto metamodel format, optimized for client applications that need to programmatically introspect declarations without taking a dependency on the full Concerto SDK.

## Features

- **Fully Resolved Type References**: No ambiguous shortnames
- **Flattened Declarations**: Declarations are not nested within models, enabling easier type lookup
- **Denormalized Properties**: Inherited properties are fully denormalized with references to their source types
- **Extended Inheritance Chain**: Concepts list their full inheritance chain, not just immediate parent
- **Scalar Type Denormalization**: For convenience in client applications

## Lossless Conversion

Concertino is designed for 100% lossless roundtrip conversion:

Concerto (Metamodel) → Concertino → Concerto (Metamodel)

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
  version: '0.1.0-alpha.2' // Specify concertino version
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

## Note

The Concertino format is compatible with the Concerto Modeling Language (CML, .cto files) via the Concerto CLI's `parse` and `print` commands.
