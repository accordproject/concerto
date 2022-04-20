<h1 align="center">
  <a href="https://www.accordproject.org/projects/concerto">
    Concerto
  <a/>
</h1>

<p align="center">
  <a href="https://github.com/accordproject/concerto/workflows/build/badge.svg"><img src="https://github.com/accordproject/concerto/workflows/build/badge.svg" alt="Build Status"></a>
  <a href="https://coveralls.io/github/accordproject/concerto?branch=master"><img src="https://coveralls.io/repos/github/accordproject/concerto/badge.svg?branch=master" alt="Coverage Status"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/accordproject/concerto?color=bright-green" alt="GitHub license"></a>
  <a href="https://www.npmjs.com/package/@accordproject/concerto-cli"><img src="https://img.shields.io/npm/dm/@accordproject/concerto-cli" alt="downloads"></a>
  <a href="https://badge.fury.io/js/%40accordproject%2Fconcerto-cli"><img src="https://badge.fury.io/js/%40accordproject%2Fconcerto-cli.svg" alt="npm version"></a>
  <a href="https://discord.gg/Zm99SKhhtA">
    <img src="https://img.shields.io/badge/Accord%20Project-Join%20Discord-blue" alt="Join the Accord Project Discord"/>
  </a>
</p>

## Introduction

Concerto is a lightweight 100% JavaScript schema language and runtime. It works in both a Node.js process and in your browser.

This is why you should care: https://www.accordproject.org/news/strongly-typed-data-for-javascript-and-beyond/

Things you can do using Concerto:
- Define an object-oriented model using a domain-specific language that is much easier to read and write than JSON/XML Schema, XMI or equivalents. The metamodel gives you "just enough" expressivity to capture real-world business models, while remaining easy to map to most runtime environments.
- Optionally edit your models using a powerful [VS Code add-on](https://marketplace.visualstudio.com/items?itemName=accordproject.cicero-vscode-extension) with syntax highlighting and validation
- Create runtime instances of your model
- Serialize your instances to JSON
- Deserialize (and optionally validate) instances from JSON
- Instances are JS objects so they are easy to pass around your application
- Introspect the model using a powerful set of APIs
- Convert the model to other formats: JSON Schema, XML Schema, Java, Go, Typescript, Loopback, PlantUML using [concerto-tools](https://github.com/accordproject/concerto/tree/master/packages/concerto-tools).
- Import models from URLs
- Publish your reusable models to any website, including the Accord Project Open Source model repository, hosted at: https://models.accordproject.org

## Structure of the Code Repository

Top level repository (concerto), with sub packages. Each sub-package is published as an independent npm module using `lerna`:
* [concerto-cli](https://github.com/accordproject/concerto/tree/master/packages/concerto-cli) : command-line interface for Concerto
* [concerto-core](https://github.com/accordproject/concerto/tree/master/packages/concerto-core) : core library for model management/parsing/validation/serialization
* [concerto-tools](https://github.com/accordproject/concerto/tree/master/packages/concerto-tools) : model converters and tools for Concerto model files
* [concerto-util](https://github.com/accordproject/concerto/tree/master/packages/concerto-util) : contains utility functions used in other parts of the code and fundamentally independent from Concerto as a modeling language
* [concerto-metamodel](https://github.com/accordproject/concerto/tree/master/packages/concerto-metamodel) : contains utility functions for accessing and manipulating the new Concerto metamodel
* [concerto-cto](https://github.com/accordproject/concerto/tree/master/packages/concerto-cto) : contains the parser for the .cto syntax for Concerto. The parser now outputs a proper Concerto object, instance of the metamodel rather than a custom JSON object.
* [concerto-vocabulary](https://github.com/accordproject/concerto/tree/master/packages/concerto-vocabulary) : contains new functionality to handle model vocabularies

# Installation

To install the command-line interface:

```
npm install -g @accordproject/concerto-cli
```

You may also set a custom folder to keep the log files by setting the following environment variable:

```
export CONCERTO_LOG_FOLDER_PATH="/tmp"
```

---

<p align="center">
  <a href="https://www.accordproject.org/">
    <img src="assets/APLogo.png" alt="Accord Project Logo" width="400" />
  </a>
</p>

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/accordproject/cicero?color=bright-green" alt="GitHub license">
  </a>
  <a href="https://discord.gg/Zm99SKhhtA/">
    <img src="https://img.shields.io/badge/Accord%20Project-Join%20Discord-blue" alt="Join the Accord Project Discord"/>
  </a>
</p>

Accord Project is an open source, non-profit, initiative working to transform contract management and contract automation by digitizing contracts. Accord Project operates under the umbrella of the [Linux Foundation][linuxfound]. The technical charter for the Accord Project can be found [here][charter].

## Learn More About Accord Project

### [Overview][apmain]

### [Documentation][apdoc]

## Contributing

The Accord Project technology is being developed as open source. All the software packages are being actively maintained on GitHub and we encourage organizations and individuals to contribute requirements, documentation, issues, new templates, and code.

Find out what’s coming on our [blog][apblog].

Join the Accord Project Technology Working Group [Discord Community][apdiscord] to get involved!

For code contributions, read our [CONTRIBUTING guide][contributing] and information for [DEVELOPERS][developers].

### README Badge

Using Accord Project? Add a README badge to let everyone know: [![accord project](https://img.shields.io/badge/powered%20by-accord%20project-19C6C8.svg)](https://www.accordproject.org/)

```
[![accord project](https://img.shields.io/badge/powered%20by-accord%20project-19C6C8.svg)](https://www.accordproject.org/)
```

## License <a name="license"></a>

Accord Project source code files are made available under the [Apache License, Version 2.0][apache].
Accord Project documentation files are made available under the [Creative Commons Attribution 4.0 International License][creativecommons] (CC-BY-4.0).

Copyright 2018-2019 Clause, Inc. All trademarks are the property of their respective owners. See [LF Projects Trademark Policy](https://lfprojects.org/policies/trademark-policy/).

[linuxfound]: https://www.linuxfoundation.org
[charter]: https://github.com/accordproject/governance/blob/master/accord-project-technical-charter.md
[apmain]: https://accordproject.org/ 
[apblog]: https://medium.com/@accordhq
[apdoc]: https://docs.accordproject.org/
[apdiscord]: https://discord.com/invite/Zm99SKhhtA

[contributing]: https://github.com/accordproject/concerto/blob/master/CONTRIBUTING.md
[developers]: https://github.com/accordproject/concerto/blob/master/DEVELOPERS.md

[apache]: https://github.com/accordproject/concerto/blob/master/LICENSE
[creativecommons]: http://creativecommons.org/licenses/by/4.0/
