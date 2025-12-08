# Concerto Linter Default Ruleset

A comprehensive set of linting rules designed to validate concerto models against industry best practices and consistent naming conventions. This default ruleset helps maintain high-quality, readable, and maintainable concerto models across your projects. It is fully configurable - you can extend it, add new rules, disable existing ones, or create an entirely new ruleset without extending this one.

This sub-package is part of the `@accordproject/concerto-linter` package. Read the [concerto-linter README](https://github.com/accordproject/concerto/tree/main/packages/concerto-linter) if you want to know how to use this ruleset with concerto models.

## Table of Contents

- [Concerto Linter Default Ruleset](#concerto-linter-default-ruleset)
  - [Table of Contents](#table-of-contents)
  - [Key Benefits](#key-benefits)
  - [Available Rules](#available-rules)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Customization](#customization)
    - [Extending the Default Ruleset](#extending-the-default-ruleset)
    - [Disabling Specific Rules](#disabling-specific-rules)
      - [Available Rule IDs](#available-rule-ids)
    - [Enabling Specific Rules](#enabling-specific-rules)
    - [Adjusting Rule Severity](#adjusting-rule-severity)
  - [Creating Custom Rules](#creating-custom-rules)
  - [License](#license)

## Key Benefits

- **Consistent Code Style**: Enforce uniform naming conventions across your concerto models
- **Error Prevention**: Catch common modeling mistakes before they cause issues
- **Best Practices**: Apply industry-standard modeling practices automatically
- **Customizable**: Easily extend or modify rules to match your project's specific needs
- **Integration Ready**: Works seamlessly with the concerto Linter and your development workflow

## Available Rules

The following table provides an overview of the available linting rules in the default ruleset:

<table>
<tr>
<th>Rule Id</th><th>Description</th>
</tr>
<tr>
<td><a href="#namespace-version">namespace-version</a></td>
<td>Ensures that the namespace declaration in the model includes a version number. This rule enforces semantic versioning in namespaces, promoting clarity and compatibility management.</td>
</tr>
<tr>
<td><a href="#no-reserved-keywords">no-reserved-keywords</a></td>
<td>Enforces that names used for declarations, properties, and decorators in concerto models do not use reserved keywords. Reserved keywords are language-specific terms that may cause conflicts or unexpected behavior if used as identifiers.</td>
</tr>
<tr>
<td><a href="#pascal-case-declarations">pascal-case-declarations</a></td>
<td>Ensures that declaration names (scalar, enum, concept, asset, participant, transaction, event) follow PascalCase naming convention (e.g., 'MyDeclaration'). This promotes consistency and readability across model declarations.</td>
</tr>
<tr>
<td><a href="#camel-case-properties">camel-case-properties</a></td>
<td>Ensures that properties of type String, Double, Integer, Long, DateTime, and Boolean are named using camelCase. This promotes consistency and readability in property naming conventions across the model.</td>
</tr>
<tr>
<td><a href="#upper-snake-case-enum-constants">upper-snake-case-enum-constants</a></td>
<td>Enforces that all enum constant names follow the UPPER_SNAKE_CASE convention. This rule checks each enum property name and reports an error if it does not match the required pattern. Ensures consistency and readability in enum naming across the model.</td>
</tr>
<tr>
<td><a href="#pascal-case-decorators">pascal-case-decorators</a></td>
<td>Ensures that decorator names follow PascalCase naming convention (e.g., 'MyDecorator'). This promotes consistency and readability across model decorators.</td>
</tr>
<tr>
<td><a href="#string-length-validator">string-length-validator</a></td>
<td>Ensures that all string properties within the data model have a length validator applied, which helps prevent inconsistent data length and ensure proper storage.</td>
</tr>
<tr>
<td><a href="#no-empty-declarations">no-empty-declarations</a></td>
<td>Detects and reports any model declarations that are empty. This rule helps maintain model integrity by ensuring that all declarations contain meaningful content, preventing the inclusion of unused or placeholder declarations in the model.</td>
</tr>
<tr>
<td><a href="#abstract-must-subclassed">abstract-must-subclassed</a></td>
<td>Ensures that every abstract declaration in the model has at least one concrete subclass. This helps prevent unused or orphaned abstract types, enforcing better model design.</td>
</tr>
</table> 

## Installation

First, install the package as a development dependency:

```bash
npm install --save-dev @accordproject/concerto-linter-default-ruleset
```

## Usage

Once installed, the default ruleset is automatically used by the concerto Linter when no custom ruleset is specified:

```javascript
import { lintModel } from '@accordproject/concerto-linter';

// The default ruleset will be used automatically
const results = await lintModel(modelText);
console.log(results);
```

To explicitly specify the default ruleset:

```javascript
const results = await lintModel(modelText, { ruleset: 'default' });
```

## Customization

To create your own ruleset that fits your project needs, you can either extend the default ruleset, or create an entirely new ruleset from scratch.

Your ruleset should be defined in one of these file formats: `.spectral.yaml`, `.spectral.yml`, `.spectral.json`, or `.spectral.js`. The concerto Linter will automatically detect and use these files, or you can specify a custom path using the `ruleset` property: `ruleset: "./path/to/my-ruleset.yaml"`. 

### Extending the Default Ruleset

You can extend the default ruleset in multiple formats:

**YAML (.spectral.yaml)**
```yaml
extends: '@accordproject/concerto-linter-default-ruleset'
```

---

**JSON (.spectral.json)**
```json
{
  "extends": "@accordproject/concerto-linter-default-ruleset"
}
```

---

**JavaScript (.spectral.js)**
```javascript
const rules = require('@accordproject/concerto-linter-default-ruleset');
module.exports = {
  extends: rules
};
```

### Disabling Specific Rules

You can disable specific rules that don't match your project's requirements by setting them to `'off'`. The rule identifiers are defined in the `ruleset-main.ts` file located at `concerto/packages/concerto-linter/default-ruleset/src`.

#### Available Rule IDs

Here are all the rule IDs that can be disabled:

| Rule ID | Description |
|---------|-------------|
| `namespace-version` | Ensures namespaces include version numbers |
| `no-reserved-keywords` | Prevents use of reserved keywords |
| `pascal-case-declarations` | Enforces PascalCase for declarations |
| `camel-case-properties` | Enforces camelCase for properties |
| `upper-snake-case-enum-constants` | Enforces UPPER_SNAKE_CASE for enum constants |
| `pascal-case-decorators` | Enforces PascalCase for decorators |
| `string-length-validator` | Requires string length validators |
| `no-empty-declarations` | Prevents empty declarations |
| `abstract-must-subclassed` | Ensures abstract classes have concrete subclasses |


**YAML (.spectral.yaml)**
```yaml
extends: '@accordproject/concerto-linter-default-ruleset'
rules:
  pascal-case-declarations: 'off'
  camel-case-properties: 'off'
```

---

**JSON (.spectral.json)**
```json
{
  "extends": "@accordproject/concerto-linter-default-ruleset",
  "rules": {
    "pascal-case-declarations": "off",
    "camel-case-properties": "off"
  }
}
```

**JavaScript (.spectral.js)**
```javascript
const rules = require('@accordproject/concerto-linter-default-ruleset');
module.exports = {
  extends: rules,
  rules: {
    'pascal-case-declarations': off,
    'namespace-version': off
  }
};
```
### Enabling Specific Rules

You can selectively start with everything off and enable only specific rules:

**YAML (.spectral.yaml)**
```yaml
extends: [['@accordproject/concerto-linter-default-ruleset', 'off']]
rules:
  pascal-case-declarations: true
  namespace-version: true
```

**JSON (.spectral.json)**
```json
{
  "extends": [["@accordproject/concerto-linter-default-ruleset", "off"]],
  "rules": {
    "pascal-case-declarations": true,
    "namespace-version": true
  }
}
```

**JavaScript (.spectral.js)**
```javascript
const rules = require('@accordproject/concerto-linter-default-ruleset');
module.exports = {
  extends: [[rules, 'off']],
  rules: {
    'pascal-case-declarations': true,
    'namespace-version': true
  }
};
```
---
### Adjusting Rule Severity

You can customize the severity level of each rule to control how violations are reported.  
- **0** = error (must be fixed)  
- **1** = warn (should be addressed)  
- **2** = info (useful information)  
- **3** = hint (optional suggestion)  

**YAML (.spectral.yaml)**
```yaml
extends: '@accordproject/concerto-linter-default-ruleset'
rules:
  pascal-case-declarations: 'warn'  # Change from error to warning
  camel-case-properties: 'info'     # Change to informational
```

**JSON (.spectral.json)**
```json
{
  "extends": "@accordproject/concerto-linter-default-ruleset",
  "rules": {
    "pascal-case-declarations": "warn",
    "camel-case-properties": "info"
  }
}
```

**JavaScript (.spectral.js)**
```javascript
const rules = require('@accordproject/concerto-linter-default-ruleset');
module.exports = {
  extends: rules,
  rules: {
    'pascal-case-declarations': 'warn',
    'camel-case-properties': 'info'
  }
};
```

## Creating Custom Rules

Whether you want to add new rules to the default ruleset or create an entirely new ruleset, you can follow the Spectral ruleset format. For comprehensive documentation, see the [Spectral ruleset documentation](https://meta.stoplight.io/docs/spectral/e5b9616d6d50c-rulesets).

Here's a simple example of what a custom rule looks like:

```yaml
# description (optional): Explains what the ruleset is about.
description: "Declaration names (scalar, enum, concept, asset, participant, transaction, event) should be PascalCase."

# given (required): JSONPath expression that specifies where the rule applies.
given: "$.models[*].declarations[*].name"

# message (required): The error/warning message shown when the rule is violated.
message: "Declaration '{{value}}' should be PascalCase (e.g. 'MyDeclaration')"

# severity (optional): The level of violation.
# 0 = error, 1 = warning, 2 = info, 3 = hint
severity: 0

# then (required): Defines what function to apply and how.
then:
  # function (required): The function that validates the rule.
  function: casing

  # functionOptions (optional): Extra options for the function.
  functionOptions:
    type: pascal
```

For more complex rules, you can create custom JavaScript functions following [Spectral ruleset documentation](https://meta.stoplight.io/docs/spectral/e5b9616d6d50c-rulesets) and import it into your rule, similar to how the built-in rules work.


## License

Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0).