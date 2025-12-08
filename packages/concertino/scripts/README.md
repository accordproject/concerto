# TypeScript Types Generator for Concertino

This script converts the Concerto schema defined in `src/spec/concertino.cto` into TypeScript interfaces matching the implementation in `src/types.ts`.

## Usage

Run the script with:

```bash
npm run generate-types
```

This will generate a file at `src/generated-types.ts` that contains TypeScript interfaces derived from the Concerto model.

## How it works

The script:

1. Loads the Concerto model using the ModelManager
2. Traverses the model using a visitor pattern similar to `TypescriptVisitor` from `concerto-codegen`
3. Applies custom transformations to match the desired TypeScript output structure
4. Handles inheritance and type hierarchies
5. Generates specialized property types for each primitive type
6. Outputs interfaces that match the structure in `types.ts`

## Customization

To modify the output, edit the visitor methods in `scripts/generateTypes.js`. The main customization points are:

- `visitClassDeclaration` - handles concept declarations
- `visitScalarDeclaration` - handles scalar type declarations
- `visitEnumDeclaration` - handles enum declarations
- `visitMapDeclaration` - handles map declarations
