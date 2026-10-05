# concerto-cli: producing Concertino from CTO files (P5-129, BC-54)

Status: **command spec, waiting for a maintainer decision on where it goes.**
Decision A5 of P5-78 (accordproject/concerto-rust#420, approved 2026-10-04)
asks for `ModelManager.toConcertino({ namespaces })` in concerto-core (shipped
by P5-129, accordproject/concerto-rust#506, BC-54) plus a concerto-cli
command. concerto-cli (`@accordproject/concerto-cli`) is not in this
repository: it is released from its own repository, which the migration
workers cannot change. This file is the command's specification; the
DECISION NEEDED on #506 asks where it is implemented.

## Command

P5-78 proposed a new target of the existing `compile` command, so that
Concertino is produced like every other code generation target:

```
concerto compile --model <file.cto> [--model <file.cto> ...] --target concertino
                 [--output <path>]
                 [--namespace <ns@version> ...]
                 [--dcs <file.json|file.yaml> ...]
                 [--vocabulary <file.voc> ...] [--locale <locale>]
                 [--offline] [--metamodelValidation false]
```

## Options

Each option maps onto `ModelManager.toConcertino` or onto loading the models.

| option | meaning | API |
|---|---|---|
| `--model` (repeatable, required) | the CTO files (or JSON ASTs) to load | `ModelLoader.loadModelManager(models, { offline })` |
| `--target concertino` | select this output (case-insensitive, as the other targets) | – |
| `--output` | where to write; a directory gets `concertino.json`, a path ending in `.json` is written as is; default: `./output/concertino.json` | `JSON.stringify(document, null, 2)` |
| `--namespace` (repeatable) | export only these namespaces and the ones they import, directly or not | `namespaces` |
| `--dcs` (repeatable) | decorator command sets, JSON, or YAML read with `DecoratorManager.yamlToJson`; applied in the order given | `decoratorCommandSets` |
| `--vocabulary` (repeatable) | vocabulary files, added to one concerto-vocabulary `VocabularyManager` | `vocabularyManager` |
| `--locale` | the vocabulary locale; required with `--vocabulary` | `locale` |
| `--offline` | do not download external models; without it the command calls `updateExternalModels` before converting, because Concertino fetches nothing | `ModelLoader` / `updateExternalModels` |
| `--metamodelValidation false` | the existing escape hatch for trusted ASTs, passed to the `ModelManager` | `new ModelManager({ metamodelValidation })` |

The decorator command sets are applied before the vocabulary, as
`toConcertino` does; neither changes the loaded models. Codegen-only options
of `compile` (`--useSystemTextJson`, `--strict` code generation flags and so
on) are ignored for this target.

## Behaviour

1. Load the models (`--model`), downloading external models unless
   `--offline`.
2. Build the options: `namespaces` from `--namespace`, `decoratorCommandSets`
   from `--dcs`, a `VocabularyManager` with every `--vocabulary` file and
   `locale` from `--locale`.
3. Call `modelManager.toConcertino(options)` and write the document, which is
   Concertino format 5.1.0 (`metadata.concertinoVersion`).
4. Exit 0 on success. On an error, print its class and message and exit 1:
   - a model that does not load: what `ModelLoader` throws today
     (`IllegalModelException`, `ParseException`, ...);
   - `--namespace` naming a namespace that is not a loaded user model
     (including `concerto@1.0.0` and `concerto.decorator@1.0.0`): `Error`;
   - `--vocabulary` without `--locale`: `Error`, reported before loading;
   - a decorator command set that does not apply: what
     `DecoratorManager.decorateModels` throws.

## Dependencies

concerto-cli already depends on concerto-core and concerto-vocabulary.
concerto-core R1 depends on `@accordproject/concertino`, so the command needs
no new direct dependency. It needs concerto-core R1 (6.0.0).

## Tests

- one CTO file to Concertino, compared with `toConcertino()` on the same
  models;
- `--namespace` with an import closure; an unknown namespace exits 1;
- `--dcs` (JSON and YAML) and `--vocabulary` with `--locale`, the vocabulary
  applied after the command sets; `--vocabulary` without `--locale` exits 1;
- `--output` to a directory and to a file.

## Later

Decision A5 moves the conversion to a Rust-owned `to_concertino` once the
format is stable; the command keeps its interface.
