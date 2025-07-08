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
To lint your model using the default behavior, simply call lintModel without specifying a ruleset path. It will search for ruleset files in the following order: .spectral.yaml, .spectral.yml, .spectral.json, .spectral.js. If none are found, it defaults to the @accordproject/concerto-linter-default-ruleset.
```javascript
import { lintModel } from '@accordproject/concerto-linter';

const results = lintModel(ast); // Pass the AST object
// OR
const results = lintModel(model); // Pass the CTO string directly
```

### Linting with a Custom Ruleset
For custom linting rules, provide the path to your Spectral ruleset file:
```javascript
const results = lintModel(ast, "D:\\linter-test\\my-ruleset.yaml");
```

## Resolution Priority

1. **Explicit Path**: Custom ruleset file specified as parameter
2. **Project Detection**: Automatic discovery in current and parent directories
3. **Default Fallback**: `@accordproject/concerto-linter-default-ruleset`

## Creating Custom Rulesets

To develop your own validation rules for Concerto models, you can extend the default ruleset or create entirely custom rules.

> **📖 Complete Guide Coming Soon**: Detailed instructions on how to extend rulesets and create your own custom validation rules will be provided in the `@accordproject/concerto-linter-default-ruleset` README documentation after the package is published.



## License

Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0).