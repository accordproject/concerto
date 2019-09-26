# Concerto Tools
Model converters and tools for [Concerto](https://github.com/accordproject/concerto/) format model files.

## Install

```
npm install -g @accordproject/concerto-tools
```

## Code Generation

The code generators take an array of local CTO files, download any external dependencies (imports) and then convert all the model
in the `ModelManager` to the target format.

### Go Lang

```
node cli.js generate --ctoFiles modelfile.cto --format Go
```

### Plant UML

```
node cli.js generate --ctoFiles modelfile.cto --format PlantUML
```

### Typescript

```
node cli.js generate --ctoFiles modelfile.cto --format Typescript
```

### Java

```
node cli.js generate --ctoFiles modelfile.cto --format Java
```

### JSONSchema

```
node cli.js generate --ctoFiles modelfile.cto --format JSONSchema
```

### XMLSchema

```
node cli.js generate --ctoFiles modelfile.cto --format XMLSchema
```

## License <a name="license"></a>

Accord Project source code files are made available under the [Apache License, Version 2.0][apache].
Accord Project documentation files are made available under the [Creative Commons Attribution 4.0 International License][creativecommons] (CC-BY-4.0).

Copyright 2018-2019 Clause, Inc. All trademarks are the property of their respective owners. See [LF Projects Trademark Policy](https://lfprojects.org/policies/trademark-policy/).

[linuxfound]: https://www.linuxfoundation.org
[charter]: https://github.com/accordproject/cicero/blob/master/CHARTER.md
[apmain]: https://accordproject.org/ 
[apworkgroup]: https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=MjZvYzIzZHVrYnI1aDVzbjZnMHJqYmtwaGlfMjAxNzExMTVUMjEwMDAwWiBkYW5AY2xhdXNlLmlv&tmsrc=dan%40clause.io
[apblog]: https://medium.com/@accordhq
[apnews]: https://www.accordproject.org/news/
[apgit]:  https://github.com/accordproject/
[apdoc]: https://docs.accordproject.org/
[apslack]: https://accord-project-slack-signup.herokuapp.com

[docspec]: https://docs.accordproject.org/docs/spec-overview.html
[docwelcome]: https://docs.accordproject.org/docs/accordproject.html
[dochighlevel]: https://docs.accordproject.org/docs/spec-concepts.html
[docergo]: https://docs.accordproject.org/docs/logic-ergo.html
[docstart]: https://docs.accordproject.org/docs/accordproject.html
[doccicero]: https://docs.accordproject.org/docs/basic-use.html
[docstudio]: https://docs.accordproject.org/docs/advanced-latedelivery.html

[contributing]: https://github.com/accordproject/cicero/blob/master/CONTRIBUTING.md
[developers]: https://github.com/accordproject/cicero/blob/master/DEVELOPERS.md

[apache]: https://github.com/accordproject/template-studio-v2/blob/master/LICENSE
[creativecommons]: http://creativecommons.org/licenses/by/4.0/
