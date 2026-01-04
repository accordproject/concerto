# Concerto Development Guide

## ❗ Accord Project Development Guide ❗
We'd love for you to help develop improvements to Concerto technology! Please refer to the [Accord Project Development guidelines][apdev] we'd like you to follow.

## Concerto Specific Information

### Development Setup

#### Building Concerto

To build Concerto, you clone the source code repository and use npm to build:

```shell
# 1️⃣ Clone your fork of the Concerto repository
git clone https://github.com/<GITHUB_USERNAME>/concerto.git

# 2️⃣ Navigate into the Concerto directory
cd concerto

# 3️⃣ Add the main Concerto repository as an upstream remote
git remote add upstream https://github.com/accordproject/concerto.git

# 4️⃣ Install Node.js dependencies
npm install

# 5️⃣ Verify the installation by running tests
npm test

```

[apdev]: https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md
