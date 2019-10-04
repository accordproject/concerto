# Concerto Core

Main library for Concerto model parsing, model manager, JSON instance validation and serialization.

# Installation

```
npm install @accordproject/concerto-core --save
```

# Create a Concerto File

```
namespace org.acme.address

/**
 * This is a concept
 */
concept PostalAddress {
  o String streetAddress optional
  o String postalCode optional
  o String postOfficeBoxNumber optional
  o String addressRegion optional
  o String addressLocality optional
  o String addressCountry optional
}
```

# Create a Model Manager

```
const ModelManager = require('@accordproject/concerto-core').ModelManager;

const modelManager = new ModelManager();
modelManager.addModelFile( concertoFileText, 'filename.cto');
```

# Create an Instance

```
const Factory = require('@accordproject/concerto-core').Factory;

const factory = new Factory(modelManager);
const postalAddress = factory.newConcept('org.acme.address', 'PostalAddress');
postalAddress.streetAddress = '1 Maine Street';
```

# Serialize an Instance to JSON

```
const Serializer = require('@accordproject/concerto-core').Serializer;

const serializer = new Serializer(factory, modelManager);
const plainJsObject = serializer.toJSON(postalAddress); // instance will be validated
console.log(JSON.stringify(plainJsObject, null, 4);
```

# Deserialize an Instance from JSON

```
const postalAddress = serializer.fromJSON(plainJsObject); // JSON will be validated
console.log(postalAddress.streetAddress);
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
