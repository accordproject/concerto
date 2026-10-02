#!/usr/bin/env node
// P5-78 spike (accordproject/concerto-rust#420), items 3 and 9: browser
// bundle sizes, by the P5-39 method (migration/bench/p560-bundle.mjs):
// esbuild bundle, format esm, platform browser, minify, treeShaking,
// NODE_ENV=production, target es2022, without keepNames (none of these
// bundles needs it: no code here reads constructor.name). Every bundle is run
// in Node and its output checked. Sizes: raw, gzip -9, brotli q11 (KB = 1000 B).
//
//   node migration/spikes/P5-78/bin/sizes.mjs [--out DIR] [--npm-concertino DIR]
//
// --npm-concertino: an extracted `npm pack @accordproject/concertino@5.0.0`
// (its package/ directory), for the published-package row; skipped if absent.
import fs from 'fs';
import path from 'path';
import url from 'url';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SPIKE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SPIKE, '..', '..', '..');
const esbuild = require(path.join(REPO, 'node_modules', 'esbuild'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? path.resolve(argv[i + 1]) : d; };
const OUT = opt('--out', path.join(SPIKE, 'build', 'sizes'));
const NPM_CONCERTINO = opt('--npm-concertino', path.resolve(REPO, '..', 'consumers', 'npm', 'accordproject-concertino-5.0.0', 'package'));
const REF_NM = path.join(REPO, 'migration', 'oracle', 'reference', 'node_modules');
const SRC = path.join(SPIKE, 'src');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// The P5-39 sample model and instance (migration/bench/p560-bundle.mjs).
const CTO = `namespace org.example.p560@1.0.0

scalar Age extends Integer range=[0,150]

@Term("A party")
abstract participant Party identified by partyId {
  o String partyId
  o String name length=[1,100] regex=/^[A-Za-z ]+$/
}

enum Tier {
  o GOLD
  o SILVER
}

participant Customer extends Party {
  o Age age
  o DateTime since
  o String[] emails
  o Tier tier
  --> Customer[] referrals optional
}
`;
const INSTANCE = {
    $class: 'org.example.p560@1.0.0.Customer', partyId: 'c1', name: 'Ann Lee', age: 42,
    since: '2024-01-02T03:04:05.000Z', emails: ['a@example.com'], tier: 'GOLD', referrals: ['resource:org.example.p560@1.0.0.Customer#c2'],
};
const cto = require(path.join(REPO, 'packages', 'concerto-cto'));
const S = require(path.join(SPIKE, 'build', 'node-all.cjs'));
const AST = cto.Parser.parse(CTO);
const RESOLVED = S.resolver.resolveModels([AST]).models;
const DOC = S.convertToConcertino(JSON.parse(JSON.stringify(RESOLVED)));

const j = (x) => JSON.stringify(x);
const rel = (p) => JSON.stringify(path.join(SRC, p));
const CTO_PKG = JSON.stringify(path.join(REPO, 'packages', 'concerto-cto', 'dist', 'esm-browser', 'index.mjs'));

// Each entry: [id, label, source, expected output (checked), nodePaths?]
const ENTRIES = [
    ['o1', '(o) concerto-cto: Parser.parse + Printer.toCTO', `import { Parser, Printer } from ${CTO_PKG};
const ast = Parser.parse(${j(CTO)}); console.log(JSON.stringify([ast.declarations.length, Printer.toCTO(ast).length > 0]));`, '[4,true]'],
    ['o1p', '(o) concerto-cto: Parser.parse only', `import { Parser } from ${CTO_PKG};
console.log(JSON.stringify(Parser.parse(${j(CTO)}).declarations.length));`, '4'],
    ['o1v5', '(o) concerto-cto 5.0.0 (npm): Parser.parse + Printer.toCTO', `import { Parser, Printer } from '@accordproject/concerto-cto';
const ast = Parser.parse(${j(CTO)}); console.log(JSON.stringify([ast.declarations.length, Printer.toCTO(ast).length > 0]));`, '[4,true]', [REF_NM]],
    ['o2', '(o) concerto-cto + browser-side resolver', `import { Parser } from ${CTO_PKG}; import { resolveModels } from ${rel('resolver.ts')};
const r = resolveModels([Parser.parse(${j(CTO)})]); console.log(JSON.stringify([r.diagnostics.length, r.models.models[0].declarations[3].superType.namespace]));`, '[0,"org.example.p560@1.0.0"]'],
    ['o3', '(o) concerto-cto + resolver + cleaned converter (CTO -> Concertino)', `import { Parser } from ${CTO_PKG}; import { resolveModels } from ${rel('resolver.ts')};
import { convertToConcertino } from ${rel('concertino/index.ts')};
const d = convertToConcertino(resolveModels([Parser.parse(${j(CTO)})]).models); console.log(JSON.stringify(Object.keys(d.declarations).length));`, '4'],
    ['ipub', '(i) published concertino 5.0.0 (npm), ConcertinoConverter + isValid', `import { ConcertinoConverter } from '@accordproject/concertino';
const c = new ConcertinoConverter(); const d = c.fromConcertoMetamodel(${j(RESOLVED)}); console.log(JSON.stringify([Object.keys(d.declarations).length, c.isValid(d)]));`, '[4,true]', 'npm'],
    ['ipubconv', '(i) published concertino 5.0.0 (npm), convertToConcertino only', `import { convertToConcertino } from '@accordproject/concertino';
console.log(JSON.stringify(Object.keys(convertToConcertino(${j(RESOLVED)}).declarations).length));`, '4', 'npm'],
    ['iws', '(i) workspace concertino (integration branch, R1 concerto-core), ConcertinoConverter + isValid', `import { ConcertinoConverter } from ${JSON.stringify(path.join(REPO, 'packages', 'concertino', 'dist', 'esm-browser', 'index.mjs'))};
const c = new ConcertinoConverter(); const d = c.fromConcertoMetamodel(${j(RESOLVED)}); console.log(JSON.stringify([Object.keys(d.declarations).length, c.isValid(d)]));`, '[4,true]'],
    ['i1', '(i) cleaned converter: convertToConcertino', `import { convertToConcertino } from ${rel('concertino/index.ts')};
console.log(JSON.stringify(Object.keys(convertToConcertino(${j(RESOLVED)}).declarations).length));`, '4'],
    ['i2', '(i) cleaned converter: both directions (ConcertinoConverter)', `import { ConcertinoConverter } from ${rel('concertino/index.ts')};
const c = new ConcertinoConverter(); const d = c.fromConcertoMetamodel(${j(RESOLVED)}); console.log(JSON.stringify(c.toConcertoMetamodel(d).models.length));`, '1'],
    ['i3', '(i) cleaned ./schema subpath: isValid (precompiled ajv)', `import { isValid } from ${rel('concertino/schema.ts')};
console.log(JSON.stringify(isValid(${j(DOC)})));`, 'true'],
    ['ii', '(ii) runtime query layer (every function)', `import * as q from ${rel('query.ts')};
const m = q.load(${j(DOC)}); const t = 'org.example.p560@1.0.0.Customer';
console.log(JSON.stringify([q.getNamespaces(m), q.getDeclarationNames(m).length, q.kindOf(m, t), q.isAbstract(m, t), q.getSuperTypes(m, t), q.derivesFrom(m, t, 'org.example.p560@1.0.0.Party'),
  q.isAssignableTo(m, t, 'concerto@1.0.0.Participant'), q.getAssignableTypes(m, 'org.example.p560@1.0.0.Party').length, q.getProperties(m, t).map((p) => p.name).join(), q.getProperty(m, t, 'age').range,
  q.getIdentifierFieldName(m, t), q.isSystemIdentified(m, t), q.propertyKind(m, q.getProperty(m, t, 'tier')), q.getEnumValues(m, 'org.example.p560@1.0.0.Tier'), q.getMapTypes(m, t),
  q.getDecorators(m, 'org.example.p560@1.0.0.Party'), q.getVocabulary(m, 'org.example.p560@1.0.0.Party').label, q.getNamespaceDecorators(m, 'org.example.p560@1.0.0').length,
  q.isEnum(m, t), q.isMap(m, t), q.isScalar(m, t), q.isClass(m, t), q.isTransaction(m, t), q.isEvent(m, t), q.isIdentified(m, t), q.shortName(t), q.namespaceOf(t), q.isPrimitive('String'), q.isSystemType(t), !!q.getType(m, t)]));`,
    '[["org.example.p560@1.0.0"],4,"ParticipantDeclaration",false,["org.example.p560@1.0.0.Party","concerto@1.0.0.Participant"],true,true,2,"age,since,emails,tier,referrals,partyId,name,$identifier",[0,150],"partyId",false,"enum",["GOLD","SILVER"],null,{},"A party",0,false,false,false,true,false,false,true,"Customer","org.example.p560@1.0.0",true,false,true]'],
    ['iii', '(iii) validator + normaliser', `import { load } from ${rel('query.ts')}; import { normalise, check } from ${rel('validator.ts')};
const m = load(${j(DOC)}); console.log(JSON.stringify([normalise(m, ${j(INSTANCE)}).since, check(m, { ...${j(INSTANCE)}, age: 200 }).ok]));`, '["2024-01-02T03:04:05.000Z",false]'],
    ['iv', '(iv) concerto-form-shaped entry: query layer + validator over a prebuilt Concertino', `import * as q from ${rel('query.ts')}; import { normalise, check } from ${rel('validator.ts')};
const m = q.load(${j(DOC)});
const form = (t) => q.getProperties(m, t).filter((p) => !p.name.startsWith('$')).map((p) => [p.name, q.propertyKind(m, p), p.isOptional || false, p.isArray || false, q.getEnumValues(m, p.type)]);
const types = q.getDeclarationNames(m).filter((t) => q.isClass(m, t) && !q.isAbstract(m, t));
console.log(JSON.stringify([types, form(types[0]).length, q.getIdentifierFieldName(m, types[0]), q.getVocabulary(m, 'org.example.p560@1.0.0.Party').label, check(m, ${j(INSTANCE)}).ok, normalise(m, ${j(INSTANCE)}).tier]));`,
    '[["org.example.p560@1.0.0.Customer"],7,"partyId","A party",true,"GOLD"]'],
    ['all', 'all of (o)+(i)+(ii)+(iii): CTO in, validated plain JSON out', `import { Parser } from ${CTO_PKG}; import { resolveModels } from ${rel('resolver.ts')};
import { convertToConcertino } from ${rel('concertino/index.ts')}; import * as q from ${rel('query.ts')}; import { normalise } from ${rel('validator.ts')};
const m = q.load(convertToConcertino(resolveModels([Parser.parse(${j(CTO)})]).models));
console.log(JSON.stringify([q.getProperties(m, 'org.example.p560@1.0.0.Customer').length, normalise(m, ${j(INSTANCE)}).age]));`, '[8,42]'],
];

const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
const br = (b) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } }).length;


const results = [];
for (const [id, label, source, expected, paths] of ENTRIES) {
    if (paths === 'npm' && !fs.existsSync(NPM_CONCERTINO)) {
        results.push({ id, label, skipped: 'no --npm-concertino' });
        continue;
    }
    const dir = path.join(OUT, id);
    fs.mkdirSync(dir, { recursive: true });
    const entry = path.join(dir, 'app.mjs');
    fs.writeFileSync(entry, source);
    const outfile = path.join(dir, 'bundle.mjs');
    const nodePaths = paths === 'npm' ? [REF_NM, path.join(REPO, 'node_modules')] : (paths || []);
    // The published-package row must not pick up the workspace packages that
    // the repository's own node_modules links: alias them to npm 5.0.0.
    const browserEntry = (pkg) => path.join(REF_NM, '@accordproject', pkg, 'dist', 'esm-browser', 'index.mjs');
    const alias = paths === 'npm' ? {
        '@accordproject/concertino': path.join(NPM_CONCERTINO, 'dist', 'esm-browser', 'index.mjs'),
        '@accordproject/concerto-core': browserEntry('concerto-core'),
        '@accordproject/concerto-cto': browserEntry('concerto-cto'),
        '@accordproject/concerto-util': browserEntry('concerto-util'),
        '@accordproject/concerto-metamodel': path.join(REF_NM, '@accordproject', 'concerto-metamodel', 'index.js'),
    } : paths ? {
        '@accordproject/concerto-cto': browserEntry('concerto-cto'),
        '@accordproject/concerto-util': browserEntry('concerto-util'),
    } : undefined;
    const r = await esbuild.build({
        entryPoints: [entry], bundle: true, format: 'esm', platform: 'browser', minify: true, treeShaking: true, keepNames: false,
        target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' }, outfile, metafile: true, logLevel: 'error', nodePaths, alias,
        absWorkingDir: REPO,
    });
    const bytes = fs.readFileSync(outfile);
    let output = null;
    let error = null;
    try {
        output = execFileSync(process.execPath, [outfile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (e) {
        error = (e.stderr || e.message).toString().split('\n').filter(Boolean).slice(0, 2).join(' | ').slice(0, 300);
    }
    // Where the bytes go: the top inputs by bytes in the output, grouped by package.
    const byPkg = {};
    for (const [f, info] of Object.entries(Object.values(r.metafile.outputs)[0].inputs)) {
        const m = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(f) || /packages\/([^/]+)/.exec(f) || /spikes\/P5-78\/src\/(.+)$/.exec(f);
        const k = m ? m[1] : path.basename(f);
        byPkg[k] = (byPkg[k] || 0) + info.bytesInOutput;
    }
    const usesNewFunction = /new Function\(/.test(bytes.toString());
    results.push({
        id, label, raw: bytes.length, gzip: gz(bytes), brotli: br(bytes), ran: !error && output === expected, output, expected, error, usesNewFunction,
        topInputs: Object.entries(byPkg).sort((a, b) => b[1] - a[1]).slice(0, 8),
    });
}
const kb = (n) => (n / 1000).toFixed(1);
const lines = ['| id | entry | raw | gzip | brotli | runs | `new Function` | largest parts (raw bytes in output) |', '|---|---|---:|---:|---:|---|---|---|'];
for (const x of results) {
    if (x.skipped) {
        lines.push(`| ${x.id} | ${x.label} | - | - | - | skipped | | |`);
        continue;
    }
    lines.push(`| ${x.id} | ${x.label} | ${kb(x.raw)} | ${kb(x.gzip)} | ${kb(x.brotli)} | ${x.ran ? 'yes' : `NO: ${x.error || x.output}`} | ${x.usesNewFunction ? 'yes' : 'no'} | ${x.topInputs.slice(0, 4).map(([k, v]) => `${k} ${kb(v)}`).join(', ')} |`);
}
fs.mkdirSync(path.join(SPIKE, 'results'), { recursive: true });
fs.writeFileSync(path.join(SPIKE, 'results', 'sizes.json'), JSON.stringify({ tool: 'sizes', esbuild: esbuild.version, node: process.version, results }, null, 1));
fs.writeFileSync(path.join(SPIKE, 'results', 'sizes.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
