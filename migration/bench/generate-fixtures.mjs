#!/usr/bin/env node
// Generates the fixed input fixtures the benchmark harness runs against, so
// both the TS and the Rust harness load byte-identical models. Re-run this
// whenever `packages/concerto-core/test/data` changes; the output is
// committed, so a normal `run-ts.mjs` / `cargo bench` does not need to run
// this first.
//
// Usage: node migration/bench/generate-fixtures.mjs
//
// Produces:
//   fixtures/model-sets/concerto-core-test-data/<namespace>.json
//     One AST per unique namespace found by parsing every parseable .cto
//     file under packages/concerto-core/test/data (first occurrence wins;
//     that directory intentionally repeats namespaces across variants of
//     the same fixture, and a handful of files are deliberately malformed
//     for parser-error tests, which we skip).
//   fixtures/model-sets/synthetic-large/large-model.json
//     One large synthetic namespace (concept declarations, scalars, enums,
//     maps, relationships and inheritance) big enough to be a meaningful
//     "large model set" workload, generated deterministically here so both
//     harnesses load the exact same AST.
//   fixtures/model-sets/conformance/<namespace>.json
//     One AST per unique namespace found under the accordproject/
//     concerto-conformance repo's semantic/specifications AST fixtures
//     (already-converted .json, one per .cto scenario). Requires that repo
//     checked out as a sibling of this one (see CONFORMANCE_DIR below);
//     skipped with a warning, not an error, if it is missing, so this
//     script still runs for the other two fixture sets.

import fs from 'fs';
import path from 'path';
import url from 'url';
import { Parser } from '@accordproject/concerto-cto';
import { createRequire } from 'module';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const AstModelManager = require('../../packages/concerto-core/dist/astmodelmanager.js').default;
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TEST_DATA_DIR = path.join(REPO_ROOT, 'packages', 'concerto-core', 'test', 'data');
const OUT_TEST_DATA = path.join(__dirname, 'fixtures', 'model-sets', 'concerto-core-test-data');
const OUT_SYNTHETIC = path.join(__dirname, 'fixtures', 'model-sets', 'synthetic-large');
const OUT_CONFORMANCE = path.join(__dirname, 'fixtures', 'model-sets', 'conformance');
const CONFORMANCE_DIR = process.env.CONFORMANCE_DIR
    || path.resolve(REPO_ROOT, '..', 'concerto-conformance');

function walk(dir) {
    let out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out = out.concat(walk(p));
        } else if (entry.isFile() && entry.name.endsWith('.cto')) {
            out.push(p);
        }
    }
    return out;
}

function safeFileName(namespace) {
    return namespace.replace(/[^a-zA-Z0-9_.@-]/g, '_');
}

function convertTestDataModels() {
    fs.rmSync(OUT_TEST_DATA, { recursive: true, force: true });
    fs.mkdirSync(OUT_TEST_DATA, { recursive: true });

    const files = walk(TEST_DATA_DIR).sort();
    const seen = new Set();
    let parseFailures = 0;
    let notSelfContained = 0;
    let written = 0;

    for (const file of files) {
        let ast;
        try {
            const content = fs.readFileSync(file, 'utf8');
            ast = Parser.parse(content, file);
        } catch {
            // Some .cto files under test/data are deliberately malformed, to
            // drive the TS parser's own error-path tests. Not usable here.
            parseFailures++;
            continue;
        }
        if (!ast || !ast.namespace || seen.has(ast.namespace)) {
            continue;
        }

        // test/data reuses namespaces across many independent, isolated test
        // fixtures (including ones deliberately invalid, to drive negative
        // tests), so they cannot in general be combined into one coherent
        // model set. We keep only models that load and validate on their
        // own, into a fresh model manager, with no other test/data file
        // present - i.e. models that are actually self-contained - so the
        // resulting fixture set is a coherent, always-valid "model set" for
        // both harnesses to load together.
        const mm = new AstModelManager();
        try {
            mm.addModel(ast, undefined, file);
        } catch {
            notSelfContained++;
            continue;
        }

        seen.add(ast.namespace);
        const outFile = path.join(OUT_TEST_DATA, `${safeFileName(ast.namespace)}.json`);
        fs.writeFileSync(outFile, JSON.stringify(ast, null, 2) + '\n', 'utf8');
        written++;
    }

    console.log(
        `concerto-core-test-data: ${files.length} .cto files seen, ` +
        `${parseFailures} did not parse, ${notSelfContained} were not ` +
        `self-contained or failed validation alone, ${written} unique, ` +
        `self-contained namespaces written to ${path.relative(REPO_ROOT, OUT_TEST_DATA)}`,
    );
}

/**
 * A deterministic large model: NUM_CLASSES concept declarations, each with a
 * handful of primitive fields, a relationship to the previous class, and
 * (every 5th class) an optional supertype, plus a shared set of scalars,
 * enums and maps. Deterministic so re-running this script reproduces the
 * exact same AST byte-for-byte.
 */
function buildSyntheticLargeModel() {
    const NUM_CLASSES = 300;
    const NAMESPACE = 'org.accordproject.bench.synthetic@1.0.0';

    const declarations = [];

    // A handful of scalar/enum declarations reused across the classes.
    declarations.push({
        $class: 'concerto.metamodel@1.0.0.StringScalar',
        name: 'BenchId',
        validator: {
            $class: 'concerto.metamodel@1.0.0.StringRegexValidator',
            pattern: '^[A-Za-z0-9-]+$',
            flags: '',
        },
    });
    declarations.push({
        $class: 'concerto.metamodel@1.0.0.EnumDeclaration',
        name: 'BenchStatus',
        isAbstract: false,
        properties: ['PENDING', 'ACTIVE', 'CLOSED', 'ARCHIVED'].map((name) => ({
            $class: 'concerto.metamodel@1.0.0.EnumProperty',
            name,
        })),
    });
    declarations.push({
        $class: 'concerto.metamodel@1.0.0.MapDeclaration',
        name: 'BenchTags',
        key: { $class: 'concerto.metamodel@1.0.0.StringMapKeyType' },
        value: { $class: 'concerto.metamodel@1.0.0.StringMapValueType' },
    });

    for (let i = 0; i < NUM_CLASSES; i++) {
        const name = `BenchClass${i}`;
        // Every 5th class (after the first) extends the previous one, so
        // supertype resolution has real chains to walk, not just a flat
        // list. A subclass inherits its identifying "id" field from its
        // supertype, so it must not redeclare it.
        const extendsPrevious = i > 0 && i % 5 === 0;
        // A subclass inherits every field on its supertype, so it must not
        // redeclare any of them - it only adds its own relationship below.
        const properties = extendsPrevious ? [] : [
            {
                $class: 'concerto.metamodel@1.0.0.StringProperty',
                name: 'id',
                isArray: false,
                isOptional: false,
            },
            {
                $class: 'concerto.metamodel@1.0.0.IntegerProperty',
                name: 'sequence',
                isArray: false,
                isOptional: false,
            },
            {
                $class: 'concerto.metamodel@1.0.0.DoubleProperty',
                name: 'weight',
                isArray: false,
                isOptional: true,
            },
            {
                $class: 'concerto.metamodel@1.0.0.BooleanProperty',
                name: 'active',
                isArray: false,
                isOptional: false,
            },
            {
                $class: 'concerto.metamodel@1.0.0.StringProperty',
                name: 'labels',
                isArray: true,
                isOptional: true,
            },
        ];

        if (i > 0 && !extendsPrevious) {
            // A relationship back to the previous class, to give the
            // validator real inter-declaration references to resolve. A
            // subclass contributes no fields of its own (see above), so it
            // skips this too rather than redeclaring an inherited one.
            properties.push({
                $class: 'concerto.metamodel@1.0.0.RelationshipProperty',
                name: 'previous',
                type: { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: `BenchClass${i - 1}` },
                isArray: false,
                isOptional: true,
            });
        }

        const decl = {
            $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
            name,
            isAbstract: false,
            properties,
        };
        if (extendsPrevious) {
            decl.superType = { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: `BenchClass${i - 1}` };
        } else {
            decl.identified = { $class: 'concerto.metamodel@1.0.0.IdentifiedBy', name: 'id' };
        }

        declarations.push(decl);
    }

    return {
        $class: 'concerto.metamodel@1.0.0.Model',
        decorators: [],
        namespace: NAMESPACE,
        imports: [],
        declarations,
    };
}

function writeSyntheticLargeModel() {
    fs.rmSync(OUT_SYNTHETIC, { recursive: true, force: true });
    fs.mkdirSync(OUT_SYNTHETIC, { recursive: true });
    const ast = buildSyntheticLargeModel();
    const outFile = path.join(OUT_SYNTHETIC, 'large-model.json');
    fs.writeFileSync(outFile, JSON.stringify(ast, null, 2) + '\n', 'utf8');
    console.log(
        `synthetic-large: ${ast.declarations.length} declarations written to ` +
        `${path.relative(REPO_ROOT, outFile)}`,
    );
}

function convertConformanceAsts() {
    if (!fs.existsSync(CONFORMANCE_DIR)) {
        console.warn(
            `conformance: skipped - no checkout found at ${CONFORMANCE_DIR} ` +
            '(set CONFORMANCE_DIR to override)',
        );
        return;
    }
    const specsDir = path.join(CONFORMANCE_DIR, 'semantic', 'specifications');
    if (!fs.existsSync(specsDir)) {
        console.warn(`conformance: skipped - ${specsDir} does not exist`);
        return;
    }

    fs.rmSync(OUT_CONFORMANCE, { recursive: true, force: true });
    fs.mkdirSync(OUT_CONFORMANCE, { recursive: true });

    // A local traversal for already-converted .json AST files (walk() above
    // is for .cto sources).
    function walkJson(dir) {
        let out = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                out = out.concat(walkJson(p));
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                out.push(p);
            }
        }
        return out;
    }

    const jsonFiles = walkJson(specsDir).sort();
    const seen = new Set();
    let malformed = 0;
    let notSelfContained = 0;
    let written = 0;

    for (const file of jsonFiles) {
        let ast;
        try {
            ast = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            malformed++;
            continue;
        }
        if (!ast || !ast.namespace || seen.has(ast.namespace)) {
            continue;
        }

        // Like test/data, these scenario fixtures repeat namespaces across
        // independent (and sometimes deliberately-invalid) scenarios, so we
        // keep only ones that are self-contained and valid on their own.
        const mm = new AstModelManager();
        try {
            mm.addModel(ast, undefined, file);
        } catch {
            notSelfContained++;
            continue;
        }

        seen.add(ast.namespace);
        const outFile = path.join(OUT_CONFORMANCE, `${safeFileName(ast.namespace)}.json`);
        fs.writeFileSync(outFile, JSON.stringify(ast, null, 2) + '\n', 'utf8');
        written++;
    }

    console.log(
        `conformance: ${jsonFiles.length} AST files seen, ${malformed} were ` +
        `not parseable JSON, ${notSelfContained} were not self-contained or ` +
        `failed validation alone, ${written} unique, self-contained ` +
        `namespaces written to ${path.relative(REPO_ROOT, OUT_CONFORMANCE)}`,
    );
}

convertTestDataModels();
writeSyntheticLargeModel();
convertConformanceAsts();
