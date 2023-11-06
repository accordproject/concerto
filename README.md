<h1>
<a href="https://www.accordproject.org/projects/concerto">
Concerto
</a>
</h1>

<a href="https://github.com/accordproject/concerto/actions/workflows/build.yml/badge.svg"><img src="https://github.com/accordproject/concerto/actions/workflows/build.yml/badge.svg" alt="Build Status"></a>
<a href="https://coveralls.io/github/accordproject/concerto?branch=main"><img src="https://coveralls.io/repos/github/accordproject/concerto/badge.svg?branch=main" alt="Coverage Status"></a>
<a href="./LICENSE"><img src="https://img.shields.io/github/license/accordproject/concerto?color=bright-green" alt="GitHub license"></a>
<a href="https://www.npmjs.com/package/@accordproject/concerto-core"><img src="https://img.shields.io/npm/dm/@accordproject/concerto-core" alt="downloads"></a>
<a href="https://badge.fury.io/js/%40accordproject%2Fconcerto-cli"><img src="https://badge.fury.io/js/%40accordproject%2Fconcerto-cli.svg" alt="npm version"></a>
<a href="https://discord.gg/Zm99SKhhtA">
<img src="https://img.shields.io/badge/Accord%20Project-Join%20Discord-blue" alt="Join the Accord Project Discord"/>
</a>

A lightweight schema language and runtime for business concepts.

```cs
concept Person identified by name  {
  o String name
  o Address address optional
  @description("Height (cm)")
  o Double height range=[0,]
  o DateTime dateOfBirth 
}
```

🏢 Concerto gives you “just enough” expressivity to capture real-world business models, while remaining easy to map to most runtime environments.

⛳ An object-oriented language that is much easier to read and write than JSON/XML Schema, XMI or equivalents.

📄 Serialize your instances to JSON

🍪 Deserialize (and validate) instances from JSON

🔎 Introspect the model using a [powerful set of APIs](https://docs.accordproject.org/docs/model-api.html)

🎛 Convert the model to other formats:
- JSON Schema
- XML Schema
- OData CDSL
- GraphQL Schema
- Java Classes
- Go Types
- C# Classes
- TypeScript Classes
- Protobuf Messages
- PlantUML Diagrams
- Mermaid UML Diagrams
- Markdown (with embedded Mermaid)
- OpenAPI v3 specification document
- Apache Avro

🕸 Publish your reusable models to any website, including the Accord Project [model repository](https://models.accordproject.org)

Infer models from other formats:
- JSON document
- JSON Schema
- OpenAPI v3 specification document

## Getting Started

- Install the [Command Line Tool](https://concerto.accordproject.org/docs/tools/ref-concerto-cli)
- Read the [Concerto specification](https://docs.accordproject.org/docs/model-concerto.html)

```console
$ npm i -g @accordproject/concerto-cli
$ concerto compare --old model.cto --new model-with-changes.cto 
[required-field-added]: The required field "weight" was added to the concept "Person" (major) 
```

- Open VSCode ([on the web](https://github.dev/accordproject/models/blob/master/src/address%400.2.0.cto), [on your machine](https://marketplace.visualstudio.com/items?itemName=accordproject.cicero-vscode-extension))

![VSCode Editor](https://accordproject.org/wp-content/uploads/2022/10/af57b31d0eb66154bce4e0ffec780027.png)

- Add to your [Node.js project](https://docs.accordproject.org/docs/model-api.html)
- Add to your [.NET project](https://www.nuget.org/packages/AccordProject.Concerto)

## Structure of the Code

Top level repository (concerto), with sub packages. Each sub-package is published as an independent npm module using `lerna`:
* [concerto-core](https://github.com/accordproject/concerto/tree/master/packages/concerto-core) : core library for model management/parsing/validation/serialization
* [concerto-util](https://github.com/accordproject/concerto/tree/master/packages/concerto-util) : contains utility functions used in other parts of the code and fundamentally independent from Concerto as a modeling language
* [concerto-cto](https://github.com/accordproject/concerto/tree/master/packages/concerto-cto) : contains the parser for the .cto syntax for Concerto. The parser now outputs a proper Concerto object, instance of the metamodel rather than a custom JSON object.
* [concerto-vocabulary](https://github.com/accordproject/concerto/tree/master/packages/concerto-vocabulary) : functionality to handle model vocabularies and localization
* [concerto-analysis](https://github.com/accordproject/concerto/tree/master/packages/concerto-analysis) : tools for comparing model files
* [concerto-types](https://github.com/accordproject/concerto/tree/master/packages/concerto-types) : TypeScript type definitions for Concerto
* [concerto-dotnet](https://github.com/accordproject/concerto-dotnet) : .NET type definitions for Concerto, and serialization tools

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
