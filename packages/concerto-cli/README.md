# Concerto CLI

Command line tool for Concerto.

## Usage

```
concerto <cmd> [args]

Commands:
  concerto generate  generate code from model files
  concerto get       save local copies of external model dependencies

Options:
  --version      Show version number                                   [boolean]
  --verbose, -v                                                 [default: false]
  --help         Show help                                             [boolean]
```

### Concerto generate

The code generator take an array of local CTO files, download any external dependencies (imports) and then convert all the model
in the `ModelManager` to the target format.

```
concerto generate

generate code from model files

Options:
  --version          Show version number                               [boolean]
  --verbose, -v                                                 [default: false]
  --help             Show help                                         [boolean]
  --ctoFiles         array of CTO files                   [array] [default: "."]
  --format           format of the code to generate
                                                [string] [default: "JSONSchema"]
  --outputDirectory  output directory path       [string] [default: "./output/"]
```

### Go Lang

```
concerto generate --ctoFiles modelfile.cto --format Go
```

### Plant UML

```
concerto generate --ctoFiles modelfile.cto --format PlantUML
```

### Typescript

```
concerto generate --ctoFiles modelfile.cto --format Typescript
```

### Java

```
concerto generate --ctoFiles modelfile.cto --format Java
```

### JSONSchema

```
concerto generate --ctoFiles modelfile.cto --format JSONSchema
```

### XMLSchema

```
concerto generate --ctoFiles modelfile.cto --format XMLSchema
```

### Concerto Get

Concerto get allows you to resolve and download external models from a set of local CTO files.

```
concerto get

save local copies of external model dependencies

Options:
  --version      Show version number                                   [boolean]
  --verbose, -v                                                 [default: false]
  --help         Show help                                             [boolean]
  --ctoFiles     array of local CTO files                 [array] [default: "."]
  --out          output directory path                  [string] [default: "./"]
```

