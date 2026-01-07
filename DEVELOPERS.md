# Concerto Development Guide

## ❗ Accord Project Development Guide ❗
We'd love for you to help develop improvements to Concerto technology! Please refer to the [Accord Project Development guidelines][apdev] we'd like you to follow.

## Concerto Specific Information

### Development Setup

#### Building Concerto

To build Concerto, you clone the source code repository and use npm to build:

```shell
# Clone your Github repository:
git clone https://github.com/<GITHUB_USERNAME>/concerto.git

# Go to the Concerto directory:
cd concerto

# Add the main Concerto repository as an upstream remote to your repository:
git remote add upstream "https://github.com/accordproject/concerto.git"

# Install node.js dependencies:
npm i

# Build all packages:
npm run build
```

#### Running Tests

Before running tests, you must first build the project to compile all workspace dependencies:

```shell
# Build all packages (required before testing):
npm run build

# Run all tests:
npm run test
```

> **Note:** The build step is required because some packages (like `concerto-linter`) depend on other workspace packages that need to be compiled first. The CI workflows follow this same pattern: build first, then test.

If you're working on a specific package, you can run tests for just that package:

```shell
# Run tests for a specific package:
npm run test -w @accordproject/concerto-core
```

[apdev]: https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md
