| id | entry | raw | gzip | brotli | runs | `new Function` | largest parts (raw bytes in output) |
|---|---|---:|---:|---:|---|---|---|
| o1 | (o) concerto-cto: Parser.parse + Printer.toCTO | 166.8 | 36.9 | 25.6 | yes | no | concerto-cto 162.3, concerto-util 4.0, app.mjs 0.5 |
| o1p | (o) concerto-cto: Parser.parse only | 159.6 | 35.5 | 24.2 | yes | no | concerto-cto 155.2, concerto-util 4.0, app.mjs 0.5 |
| o1v5 | (o) concerto-cto 5.0.0 (npm): Parser.parse + Printer.toCTO | 166.8 | 36.9 | 25.6 | yes | no | @accordproject/concerto-cto 162.3, @accordproject/concerto-util 4.0, app.mjs 0.5 |
| o2 | (o) concerto-cto + browser-side resolver | 165.7 | 37.5 | 26.1 | yes | no | concerto-cto 155.2, resolver.ts 5.8, concerto-util 4.0, app.mjs 0.5 |
| o3 | (o) concerto-cto + resolver + cleaned converter (CTO -> Concertino) | 172.2 | 39.3 | 27.7 | yes | no | concerto-cto 155.2, concertino/concertinoSerializer.ts 6.5, resolver.ts 5.8, concerto-util 4.0 |
| ipub | (i) published concertino 5.0.0 (npm), ConcertinoConverter + isValid | 220.3 | 57.8 | 50.5 | yes | yes | index.mjs 130.0, @accordproject/concerto-core 72.4, chunk-AWADBCTC.mjs 8.3, chunk-J3RL6WS7.mjs 6.4 |
| ipubconv | (i) published concertino 5.0.0 (npm), convertToConcertino only | 134.3 | 40.5 | 35.6 | yes | yes | index.mjs 124.7, chunk-J3RL6WS7.mjs 6.4, app.mjs 2.3, chunk-ZLCYQZTC.mjs 0.8 |
| iws | (i) workspace concertino (integration branch, R1 concerto-core), ConcertinoConverter + isValid | 178.0 | 51.9 | 45.5 | NO: file:///home/user/wt/P5-78/concerto/migration/spikes/P5-78/build/sizes/iws/bundle.mjs:1 | var Lr=Object.create,cr=Object.defineProperty,qr=Object.getOwnPropertyDescriptor,He=Object.getOwnPropertyNames,Ur=Object.getPrototypeOf,Fr=Object.prototype.hasOwnProperty,zr=(e,r)=>function(){return e&&(r=(0,e[ | yes | concertino 145.6, concerto-core 30.1, app.mjs 2.4 |
| i1 | (i) cleaned converter: convertToConcertino | 8.7 | 2.5 | 2.2 | yes | no | concertino/concertinoSerializer.ts 6.4, app.mjs 2.3, concertino/index.ts 0.0 |
| i2 | (i) cleaned converter: both directions (ConcertinoConverter) | 17.3 | 4.3 | 3.9 | yes | no | concertino/metamodelSerializer.ts 8.1, concertino/concertinoSerializer.ts 6.4, app.mjs 2.3, concertino/index.ts 0.2 |
| i3 | (i) cleaned ./schema subpath: isValid (precompiled ajv) | 48.8 | 5.9 | 4.7 | yes | no | concertino/schema-validator.mjs 47.5, app.mjs 1.3, concertino/schema.ts 0.1 |
| ii | (ii) runtime query layer (every function) | 5.5 | 1.9 | 1.7 | yes | no | query.ts 3.7, app.mjs 1.8 |
| iii | (iii) validator + normaliser | 20.9 | 6.8 | 6.2 | yes | no | validator.ts 16.4, query.ts 2.8, app.mjs 1.7 |
| iv | (iv) concerto-form-shaped entry: query layer + validator over a prebuilt Concertino | 21.6 | 7.1 | 6.4 | yes | no | validator.ts 16.4, query.ts 3.2, app.mjs 1.9 |
| all | all of (o)+(i)+(ii)+(iii): CTO in, validated plain JSON out | 191.7 | 45.3 | 33.1 | yes | no | concerto-cto 155.3, validator.ts 16.5, concertino/concertinoSerializer.ts 6.5, resolver.ts 5.8 |
