## `quoteStringValue` — Oracle Results

### Quoted (`keep original: false`) — JSON.stringify applied

| Original | Embedded as | Reason |
|---|---|---|
| *(empty string)* | `""` | Empty scalar → YAML null without quotes |
| `·leading and trailing·` | `" leading and trailing "` | Leading/trailing whitespace |
| `- foo` | `"- foo"` | Block sequence indicator |
| `---` | `"---"` | Document start marker |
| `...` | `"..."` | Document end marker |
| `-1.5` | `"-1.5"` | Numeric (negative float) |
| `.5` | `".5"` | Numeric (float, no leading zero) |
| `1e10` | `"1e10"` | Numeric (scientific notation) |
| `0x1A` | `"0x1A"` | Numeric (hex) |
| `0o10` | `"0o10"` | Numeric (octal) |
| `~` | `"~"` | YAML null shorthand |
| `NULL` | `"NULL"` | YAML null keyword |
| `TRUE` | `"TRUE"` | YAML boolean keyword |
| `[unclosed` | `"[unclosed"` | Flow sequence indicator |
| `[unclosed bracket` | `"[unclosed bracket"` | Flow sequence indicator |
| `[primary, secondary]` | `"[primary, secondary]"` | Flow sequence |
| `{key: val` | `"{key: val"` | Flow mapping indicator |
| `foo:` | `"foo:"` | Trailing colon (mapping key) |
| `foo: bar` | `"foo: bar"` | Colon-space (mapping key) |
| `Custom Field: Name` | `"Custom Field: Name"` | Colon-space (mapping key) |
| `Field: Label` | `"Field: Label"` | Colon-space (mapping key) |
| `Key: Identifier` | `"Key: Identifier"` | Colon-space (mapping key) |
| `My Namespace: Title` | `"My Namespace: Title"` | Colon-space (mapping key) |
| `Product: Details` | `"Product: Details"` | Colon-space (mapping key) |
| `Value: Data` | `"Value: Data"` | Colon-space (mapping key) |
| `hello # comment` | `"hello # comment"` | Inline comment indicator |
| `status: active # reviewed` | `"status: active # reviewed"` | Colon-space + comment |
| `> folded block` | `"> folded block"` | Block folded scalar indicator |
| `\| literal block` | `"\| literal block"` | Block literal scalar indicator |
| `!tag handle` | `"!tag handle"` | Tag indicator |
| `*alias ref` | `"*alias ref"` | Alias indicator |
| `&anchor ref` | `"&anchor ref"` | Anchor indicator |
| `%directive` | `"%directive"` | Directive indicator |
| `? key` | `"? key"` | Explicit key indicator |
| `@decorated` | `"@decorated"` | Reserved indicator |
| `` `template` `` | `` "`template`" `` | Reserved indicator |
| `foo\rbar` *(CR embedded)* | `"foo\rbar"` | Carriage return character |
| `line1\nline2` *(newline embedded)* | `"line1\nline2"` | Embedded newline |
| `name: Martin D'vloper\nage: 26\n...` | `"name: Martin D'vloper\nage: 26\n..."` | Multiline + colon-space |

---

### Plain scalar (`keep original: true`) — embedded unquoted

| Original | Note |
|---|---|
| `hello world` | Plain alphanumeric |
| `it's here` | Single quote allowed mid-scalar |
| `say "hello"` | Double quote allowed mid-scalar |
| `path\to\file` | Backslash is literal in plain scalars |
| `literal\n value` | `\n` here is backslash + n, not newline |
| `col1	col2` *(tab)* | Tab allowed in scalar content (restriction is indentation only) |
| `HI`, `con`, `some`, `My Field`, etc. | Plain safe strings |
| `YES` | ⚠️ YAML 1.2 string — YAML 1.1 parsers read as boolean |
| `0b11` | ⚠️ YAML 1.2 string — YAML 1.1 parsers read as binary integer `3` |
