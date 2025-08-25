# concerto linter

The linter provide the lintModel function which provides a robust and efficient solution for linting Concerto models using Spectral. It ensures your models adhere to predefined or custom rulesets, promoting consistency, quality, and maintainability in your codebase.

## Table of contents
- [concerto linter](#concerto-linter)
  - [Table of contents](#table-of-contents)
  - [Features](#features)
    - [Model Input](#model-input)
    - [Ruleset Discovery](#ruleset-discovery)
    - [Ruleset Flexibility](#ruleset-flexibility)
    - [Namespace Filtering](#namespace-filtering)
    - [JSON Output](#json-output)
  - [Getting Started](#getting-started)
  - [Installation](#installation)
    - [Providing the concerto Model](#providing-the-concerto-model)
      - [As a CTO String](#as-a-cto-string)
      - [As a Parsed AST Object](#as-a-parsed-ast-object)
  - [Ruleset Configuration](#ruleset-configuration)
    - [Default Ruleset](#default-ruleset)
    - [Custom Rulesets](#custom-rulesets)
    - [Automatic Ruleset Discovery](#automatic-ruleset-discovery)
    - [Creating Custom Rulesets](#creating-custom-rulesets)
  - [The linter output](#the-linter-output)
    - [Namespace Filtering](#namespace-filtering-1)
  - [License](#license)

<!-- tocstop -->
## Features

### Model Input

- **Versatile Model Input**: Supports concerto models provided as either a CTO string or a parsed Abstract Syntax Tree (AST) object.

### Ruleset Discovery

- **Automatic Ruleset Discovery**: Automatically detects Spectral ruleset files (e.g., .spectral.yaml, .spectral.yml, .spectral.json, .spectral.js) in the current or parent directories when no explicit ruleset is specified.

### Ruleset Flexibility

- **Custom Ruleset Flexibility**: Enables the use of a custom Spectral ruleset by allowing you to specify its file path for tailored linting rules.

### Namespace Filtering

- **Namespace Filtering**: Filters linting results by namespace, with configurable exclusion patterns. By default, excludes `'concerto.*'` and `'org.accordproject.*'` namespaces.

### JSON Output

- **Structured JSON Output**: Returns linting results in a consistent JSON format for easier integration with other tools and workflows.

## Getting Started
The linter is highly customizable. By default, it will lint any Concerto model using the @accordproject/concerto-linter-default-ruleset, but you can also extend it or create your own custom ruleset.

## Installation
Install the package via npm:
```bash
npm install @accordproject/concerto-linter
```
### Providing the concerto Model
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
## Ruleset Configuration

The concerto Linter provides flexible `ruleset` configuration options to suit your project needs.

### Default Ruleset

By default, the linter uses `@accordproject/concerto-linter-default-ruleset`, which provides a comprehensive set of rules for concerto models. This ruleset is automatically applied when no custom ruleset is specified.

### Custom Rulesets

You can customize the linting rules in several ways:

1. **Create a ruleset file** in your project directory using any of these supported formats:
   - `.spectral.yaml`
   - `.spectral.yml`
   - `.spectral.json`
   - `.spectral.js`

2. **Specify a ruleset path** explicitly when calling the linter:
   ```javascript
   const results = await lintModel(ast, {ruleset: 'path/to/your/custom-ruleset.yaml'});
   ```

3. **Force the default ruleset** 
   ```javascript
   const results = await lintModel(ast, {ruleset: 'default'});
   ```

### Automatic Ruleset Discovery

When you call `lintModel` without specifying a ruleset, the linter will automatically search for ruleset files in the following order:

1. `.spectral.yaml`
2. `.spectral.yml`
3. `.spectral.json`
4. `.spectral.js`

If you want to **force** the linter to use the built-in default ruleset even when custom ruleset files are present in the project, pass `ruleset: 'default'` in the options:

```javascript
import { lintModel } from '@accordproject/concerto-linter';

const results = await lintModel(ast, { ruleset: 'default' });
```
If none of these files are found in the current or parent directories, the linter will fall back to using the default ruleset (`@accordproject/concerto-linter-default-ruleset`).

```javascript
import { lintModel } from '@accordproject/concerto-linter';

// The linter will automatically detect ruleset files in your project
const results = await lintModel(ast); // Pass the AST object
// OR
const results = await lintModel(model); // Pass the CTO string directly
```

### Creating Custom Rulesets

You can create your own custom ruleset to enforce specific rules for your Concerto models. For detailed guidance on creating custom rulesets, refer to the [default-ruleset documentation](./default-ruleset/README.md).

Custom rulesets follow the Spectral ruleset format and can be created in YAML, JSON, or JavaScript. Once created, the linter will automatically detect your ruleset file if it uses one of the standard names, or you can explicitly specify its path as shown in the examples above.

## The linter output

The lintModel function returns a Promise that resolves to an array of linting results in JSON format:

Each lint issue is represented as a flat JSON object:

```ts
interface ILintResult {
  /** Unique rule identifier (e.g. 'no-unused-concept') */
  code: string;

  /** Human-readable description of the violation */
  message: string;

  /** Severity level ('error' | 'warning' | 'info' | 'hint') */
  severity: string;

  /**
   * JSONPath-style pointer as an array of keys/indices
   * (e.g. ['declarations', 3])
   */
  path: Array<string | number>;

  /** Namespace where the violation occurred (e.g. 'org.accordproject') */
  namespace: string;

}
```
Example Output :

```json
[
  {
    "code": "camel-case-properties",
    "message": "Property 'FirstVal' should be camelCase (e.g. 'myProperty').",
    "severity": "warning",
    "path": ["declarations", 3],
    "namespace": "org.example.model",
    "source": "concerto-lintr"
  }
```

### Namespace Filtering

By default, results from namespaces matching `'concerto.*'` and `'org.accordproject.*'` are excluded from the output. You can customize this behavior using the `excludeNamespaces` option.

```javascript
// Override default namespace exclusions
const results = await lintModel(ast, { 
  excludeNamespaces: ['org.example.*', 'com.acme.*'] 
});

// Combine custom ruleset and namespace filtering
const results = await lintModel(ast, {
  ruleset: "D:\\linter-test\\my-ruleset.yaml",
  excludeNamespaces: ['org.example.*']
});
```
## License

Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0).