# Concerto Linter Default Ruleset

This sub-package is part of the `@accordproject/concerto-linter` package. Read the [concerto-linter README](../README.md) if you want to know how to use this ruleset with Concerto models.

## Installation

First, install the package as a development dependency:

```bash
npm install --save-dev @accordproject/concerto-linter-default-ruleset
```

## Usage

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

You can disable specific rules by setting them to `'off'`:

**YAML (.spectral.yaml)**
```yaml
extends: '@accordproject/concerto-linter-default-ruleset'
rules:
  camel-case-declarations: 'off'
  pascal-case-properties: 'off'
```

---

**JSON (.spectral.json)**
```json
{
  "extends": "@accordproject/concerto-linter-default-ruleset",
  "rules": {
    "camel-case-declarations": "off",
    "pascal-case-properties": "off"
  }
}
```

---

**JavaScript (.spectral.js)**
```javascript
const rules = require('@accordproject/concerto-linter-default-ruleset');
module.exports = {
  extends: rules,
  rules: {
    'camel-case-declarations': 'off',
    'pascal-case-properties': 'off'
  }
};
```

## Available Rules
 In Progress - Implementing the default ruleset.

## Creating Custom Rules
 TO DO

## License

Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0).