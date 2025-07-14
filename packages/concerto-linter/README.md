# lintModel Function

The lintModel function provides a robust and efficient solution for linting Concerto models using Spectral. It ensures your models adhere to predefined or custom rulesets, promoting consistency, quality, and maintainability in your codebase.

## Features

- **Versatile Model Input**: Supports Concerto models provided as either a CTO string or a parsed Abstract Syntax Tree (AST) object.

- **Automatic Ruleset Discovery**: Automatically detects Spectral ruleset files (e.g., .spectral.yaml, .spectral.yml, .spectral.json, .spectral.js) in the current or parent directories when no explicit ruleset is specified.

- **Custom Ruleset Flexibility**: Enables the use of a custom Spectral ruleset by allowing you to specify its file path for tailored linting rules.

## How to Use

### Installation
Install the package via npm:
```bash
npm install @accordproject/concerto-linter
```

### Providing the Concerto Model
The lintModel function accepts your Concerto model in one of two formats:

#### As a CTO String
```javascript
const model = `
namespace org.example
asset MyProduct {
  o String ProductId
}
`;
```

#### As a Parsed AST Object
```javascript
import { ModelManager } from '@accordproject/concerto-core';

const modelManager = new ModelManager();
const model = `
namespace org.example
asset MyProduct {
  o String ProductId
}
`;
modelManager.addCTOModel(model);
const ast = modelManager.getAst();
```

### Linting with Automatic Ruleset Discovery
To lint your model using the default behavior, simply call lintModel without specifying a ruleset path. It will search for ruleset files in the following order: `.spectral.yaml`, `.spectral.yml`, `.spectral.json`, or `.spectral.js` If none are found, it defaults to the @accordproject/concerto-linter-default-ruleset.
```javascript
import { lintModel } from '@accordproject/concerto-linter';

const results = lintModel(ast); // Pass the AST object
// OR
const results = lintModel(model); // Pass the CTO string directly
```

### Linting with a Custom Ruleset

First, you will have to create your own custom ruleset. For guidance on how to create them, follow this -> [link to the README of default-ruleset](../concerto-linter-default-ruleset/README.md).

After that, our linter will be able to detect if there are any `.spectral.yaml`, `.spectral.yml`, `.spectral.json`, or `.spectral.js` files and pick them up automatically. You can also pass the path for this ruleset file directly to the lint function if you want to specify a particular one.

**Example with automatic detection:**
```javascript
// The linter will automatically find and use ruleset files in your project
const results = lintModel(ast);
```

**Example with explicit path:**
```javascript
// Specify a custom ruleset file path
const results = lintModel(ast, "D:\\linter-test\\my-ruleset.yaml");
```

## Resolution Priority

1. **Explicit Path**: Custom ruleset file specified as parameter
2. **Project Detection**: Automatic discovery in current and parent directories
3. **Default Fallback**: `@accordproject/concerto-linter-default-ruleset`


## License

Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0).