# Concerto CLI

Command line tool for Concerto.

## Usage

```
concerto <cmd> [args]

Commands:
  concerto validate  validate JSON against model files
  concerto compile   generate code for a target platform
  concerto get       save local copies of external model dependencies

Options:
  --version      Show version number                                   [boolean]
  --verbose, -v                                                 [default: false]
  --help         Show help                                             [boolean]
```

### Concerto validate

The `validate` command lets you check whether a JSON sample is a valid instance of the given model.

```
concerto validate

validate JSON against model files

Options:
  --version      Show version number                                   [boolean]
  --verbose, -v                                                 [default: false]
  --help         Show help                                             [boolean]
  --sample       sample JSON to validate       [string] [default: "sample.json"]
  --ctoSystem    system model to be used                                [string]
  --ctoFiles     array of CTO files                       [array] [default: "."]
```

### Concerto compile

The `compile` command takes an array of local CTO files, download any external dependencies (imports) and then convert all the model in the `ModelManager` to the target format.

```
concerto compile

generate code for a target platform

Options:
  --version      Show version number                                   [boolean]
  --verbose, -v                                                 [default: false]
  --help         Show help                                             [boolean]
  --ctoSystem    system model to be used                                [string]
  --ctoFiles     array of CTO files                       [array] [default: "."]
  --target       target of the code generation  [string] [default: "JSONSchema"]
  --output       output directory path           [string] [default: "./output/"]
```

#### Go Lang

```
concerto compile --ctoFiles modelfile.cto --target Go
```

#### Plant UML

```
concerto compile --ctoFiles modelfile.cto --target PlantUML
```

#### Typescript

```
concerto compile --ctoFiles modelfile.cto --target Typescript
```

#### Java

```
concerto compile --ctoFiles modelfile.cto --target Java
```

#### JSONSchema

```
concerto compile --ctoFiles modelfile.cto --target JSONSchema
```

#### XMLSchema

```
concerto compile --ctoFiles modelfile.cto --target XMLSchema
```

### Concerto Get

The `get` command allows you to resolve and download external models from a set of local CTO files.

```
concerto get

save local copies of external model dependencies

Options:
  --version      Show version number                                   [boolean]
  --verbose, -v                                                 [default: false]
  --help         Show help                                             [boolean]
  --ctoFiles     array of local CTO files                 [array] [default: "."]
  --ctoSystem    system model to be used                                [string]
  --output       output directory path                  [string] [default: "./"]
```

## License <a name="license"></a>
Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the LICENSE file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.

