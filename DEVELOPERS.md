# Concerto Development Guide

## ❗ Accord Project Development Guide ❗
We'd love for you to help develop improvements to Concerto technology! Please refer to the [Accord Project Development guidelines][apdev] we'd like you to follow.

## Concerto Specific Information

### Development Setup

#### Building Concerto

To build Concerto, you clone the source code repository and use lerna to build:

```shell
# Clone your Github repository:
git clone https://github.com/<GITHUB_USERNAME>/concerto.git

# Go to the Concerto directory:
cd concerto

# Add the main Concerto repository as an upstream remote to your repository:
git remote add upstream "https://github.com/accordproject/concerto.git"

# Install node.js dependencies:
npm install -g lerna
lerna bootstrap
```

[apdev]: https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md