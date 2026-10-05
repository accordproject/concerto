# A pinned Concertino 5.0.0 reader and writer

These files are the Concertino sources as they were when the package wrote
format 5.0.0, the last commit before format 5.1.0
(05590117b38e08cb1a3141c3da440f105a731150, the parent of P5-130's 8c62817e0):

| file | what it is |
|---|---|
| `concertinoSerializer.ts` | the 5.0.0 writer (`convertToConcertino`) |
| `metamodelSerializer.ts`, `names.ts` | the 5.0.0 converter back to the metamodel (`convertToMetamodel`) |
| `runtime.ts` | the 5.0.0 `./runtime` reader (the P5-78 spike's runtime, as P5-127 productised it) |
| `spec/concertino.metamodel@5.0.0.ts`, `spec/concerto@1.0.0.ts`, `spec/concerto.metamodel@1.0.0.ts` | the 5.0.0 format types |
| `spec/concertino.schema.json` | the 5.0.0 schema |

They are copied as they were, and must not be edited: `test/additive.test.ts`
reads every 5.1.0 document of the test corpus with them, to show that format
5.1.0 is additive (a 5.0.0 reader reads a 5.1.0 document as it reads the
5.0.0 document of the same model).
