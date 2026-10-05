/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * `@accordproject/concertino/resolve`: a browser-side resolver from
 * concerto-cto ASTs to the resolved AST that the Concertino converter needs,
 * with no dependency on concerto-core or the engine. (P5-78 spike prototype,
 * accordproject/concerto-rust#420, productised in P5-128, #505.)
 *
 * resolveModels(models) does what ModelManager.getAst(true) does for the
 * names, without concerto-core: every TypeIdentifier (property and
 * relationship types, super types, map key and value types, decorator type
 * references) gets the namespace it resolves to (and `resolvedName` for an
 * aliased import), and every scalar declaration gets its `namespace`. The
 * same pass makes the parse-level and resolution checks concerto-core makes
 * while it loads a model file (option (c) of the P5-78 spike): the 16
 * resolution checks of the spike's catalogue, plus self-extension (as
 * circular inheritance). The rest of concerto-core's model validation is not
 * here: run the engine (concerto-core) for full validation.
 *
 * Resolution rules (concerto-core 5.0.0 ModelFile.fromAst/resolveType, kept by R1):
 * - a type is a primitive, a local declaration, or an imported short name;
 * - imports: `ImportType` (a.b@1.0.0.Foo), `ImportTypes` (a.b@1.0.0.{Foo, Bar as Baz});
 *   `ImportAll` (wildcards) is rejected ("Wildcard Imports are not permitted.");
 *   every import must be versioned; an alias may not be a primitive name;
 * - every non-system model implicitly imports concerto@1.0.0.{Concept, Asset,
 *   Transaction, Participant, Event}; asset/participant/transaction/event
 *   declarations without `extends` implicitly extend the matching system type
 *   (this is not written into the resolved AST);
 * - an import's namespace must be one of the given models (or the system
 *   model), and must declare the imported type; two versions of one
 *   namespace may not be imported together (the `concerto` namespace excepted);
 * - external models (`from <uri>`) are not fetched: pass them in `models`
 *   (the browser has no ModelLoader); an unknown namespace is an error.
 */
/* eslint-disable valid-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { PRIMITIVES, parseNamespace } from './names';

export const MM = 'concerto.metamodel@1.0.0';
export const SYSTEM_NS = 'concerto@1.0.0';
export const SYSTEM_TYPES = ['Concept', 'Asset', 'Participant', 'Transaction', 'Event'];
export const DECORATOR_NS = 'concerto.decorator@1.0.0';
export const DECORATOR_TYPES = ['Decorator', 'DotNetNamespace'];
const IMPLICIT_SUPER: Record<string, string> = {
    AssetDeclaration: 'Asset',
    ParticipantDeclaration: 'Participant',
    TransactionDeclaration: 'Transaction',
    EventDeclaration: 'Event',
};
const IDENT = /^(\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\\u[0-9A-Fa-f]{4})(?:\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\\u[0-9A-Fa-f]{4}|\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc}|‌|‍)*$/u;

/** A diagnostic. `errorClass` is the concerto-core exception class the same problem throws. */
export interface Diagnostic {
    code: string;
    errorClass: 'IllegalModelException' | 'Error' | 'TypeNotFoundException';
    message: string;
    namespace?: string;
    location?: unknown;
}

export class ResolutionError extends Error {
    diagnostics: Diagnostic[];
    constructor(diagnostics: Diagnostic[]) {
        super(diagnostics[0].message);
        this.name = diagnostics[0].errorClass;
        this.diagnostics = diagnostics;
    }
}

export interface ResolveOptions {
    /** Accept `{Foo as Bar}` imports (ModelManager option importAliasing). Default true. */
    importAliasing?: boolean;
    /** Stop at the first diagnostic (as concerto-core does). Default false: collect all. */
    failFast?: boolean;
}

export interface ResolveResult {
    /** `concerto.metamodel@1.0.0.Models`, resolved, without the system model (as getAst(true)). */
    models: any;
    diagnostics: Diagnostic[];
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const short = (c: string) => c.substring(c.lastIndexOf('.') + 1);

/**
 * Resolve a set of model ASTs (from concerto-cto's Parser.parse, or JSON).
 * @param input the models: an array of `Model` ASTs, or a `Models` AST
 * @param options options
 * @returns the resolved models and the diagnostics
 */
export function resolveModels(input: any[] | { models: any[] }, options: ResolveOptions = {}): ResolveResult {
    const aliasing = options.importAliasing !== false;
    const list: any[] = Array.isArray(input) ? input : input.models;
    const diagnostics: Diagnostic[] = [];
    const report = (d: Diagnostic) => {
        diagnostics.push(d);
        if (options.failFast) {
            throw new ResolutionError(diagnostics);
        }
    };

    // Pass 1: the namespaces and their local declarations.
    const locals = new Map<string, Set<string>>();
    locals.set(SYSTEM_NS, new Set(SYSTEM_TYPES));
    // The decorator model every ModelManager carries (decoratormodel.json), importable by user models.
    locals.set(DECORATOR_NS, new Set(DECORATOR_TYPES));
    const models: any[] = [];
    for (const src of list) {
        const ast = clone(src);
        const ns: string = ast.namespace;
        const { name, version } = parseNamespace(ns || '');
        if (!ns) {
            report({ code: 'namespace-missing', errorClass: 'Error', message: 'Model has no namespace' });
            continue;
        }
        if (!version) {
            report({ code: 'namespace-unversioned', errorClass: 'Error', namespace: ns,
                message: `Cannot create a ModelFile with an unversioned namespace: ${ns}. All models must specify a version (e.g., @1.0.0).` });
        }
        for (const part of name.split('.')) {
            if (!IDENT.test(part)) {
                report({ code: 'namespace-part', errorClass: 'IllegalModelException', namespace: ns, message: `Invalid namespace part '${part}'` });
            }
        }
        if (locals.has(ns)) {
            report({ code: 'namespace-duplicate', errorClass: 'Error', namespace: ns, message: `Namespace ${ns} is already declared` });
            continue;
        }
        const names = new Set<string>();
        for (const d of ast.declarations || []) {
            const fqn = `${ns}.${d.name}`;
            if (!IDENT.test(d.name || '')) {
                report({ code: 'declaration-name', errorClass: 'IllegalModelException', namespace: ns, message: `Invalid class name '${d.name}'`, location: d.location });
            }
            if (names.has(d.name)) {
                report({ code: 'declaration-duplicate', errorClass: 'IllegalModelException', namespace: ns, message: `Duplicate class name ${fqn}`, location: d.location });
            }
            if (/Scalar$/.test(d.$class) && PRIMITIVES.has(d.name)) {
                report({ code: 'scalar-primitive-name', errorClass: 'IllegalModelException', namespace: ns,
                    message: `Invalid scalar name '${d.name}'. Name conflicts with primitive type.`, location: d.location });
            }
            names.add(d.name);
        }
        locals.set(ns, names);
        models.push(ast);
    }

    // Pass 2: imports, then every type reference.
    for (const ast of models) {
        const ns: string = ast.namespace;
        const own = locals.get(ns)!;
        const imported = new Map<string, { namespace: string; name: string }>();
        const versions = new Map<string, string | undefined>();
        const imports = [...(ast.imports || []), { $class: `${MM}.ImportTypes`, namespace: SYSTEM_NS, types: SYSTEM_TYPES, implicit: true }];
        for (const imp of imports) {
            const kind = short(imp.$class);
            const { name: impName, version: impVersion } = parseNamespace(imp.namespace || '');
            if (!impVersion) {
                report({ code: 'import-unversioned', errorClass: 'Error', namespace: ns, message: `Cannot use an unversioned import ${imp.namespace}.` });
                continue;
            }
            if (kind === 'ImportAll' || kind === 'ImportAllFrom') {
                report({ code: 'import-wildcard', errorClass: 'Error', namespace: ns, message: 'Wildcard Imports are not permitted.' });
                continue;
            }
            const types: string[] = kind === 'ImportTypes' ? imp.types || [] : [imp.name];
            const aliases = new Map<string, string>();
            if (kind === 'ImportTypes' && imp.aliasedTypes && imp.aliasedTypes.length > 0) {
                if (!aliasing) {
                    report({ code: 'import-alias-disabled', errorClass: 'Error', namespace: ns, message: 'Aliasing of imported types is not enabled' });
                }
                for (const a of imp.aliasedTypes) {
                    if (PRIMITIVES.has(a.aliasedName)) {
                        report({ code: 'import-alias-primitive', errorClass: 'Error', namespace: ns, message: 'Types cannot be aliased to primitive type' });
                    }
                    aliases.set(a.name, a.aliasedName);
                }
            }
            const target = locals.get(imp.namespace);
            if (!imp.implicit) {
                if (!target) {
                    report({ code: 'import-namespace-unknown', errorClass: 'IllegalModelException', namespace: ns,
                        message: `No registered namespace for type ${imp.namespace}.${types[0]}` });
                } else {
                    for (const t of types) {
                        if (!target.has(t)) {
                            report({ code: 'import-type-unknown', errorClass: 'IllegalModelException', namespace: ns,
                                message: `Type ${t} is not defined in namespace ${imp.namespace}` });
                        }
                    }
                }
                const seen = versions.get(impName);
                if (impName !== 'concerto' && versions.has(impName) && seen !== impVersion) {
                    report({ code: 'import-two-versions', errorClass: 'IllegalModelException', namespace: ns,
                        message: `Importing types from different versions ("${seen}", "${impVersion}") of the same namespace "${impName}" is not permitted.` });
                }
                versions.set(impName, impVersion);
            }
            for (const t of types) {
                imported.set(aliases.get(t) ?? t, { namespace: imp.namespace, name: t });
            }
        }
        for (const d of ast.declarations || []) {
            const imp = imported.get(d.name);
            // Includes the implicit system types (concerto-core 5.0.0 Declaration.validate,
            // #648), unless dangerouslyAllowReservedSystemTypeNamesInUserModels.
            if (imp) {
                report({ code: 'declaration-clashes-import', errorClass: 'IllegalModelException', namespace: ns,
                    message: `Type '${d.name}' clashes with an imported type with the same name.`, location: d.location });
            }
        }

        const resolve = (ti: any, context: string, location?: unknown, lenient = false) => {
            if (!ti || !ti.name) {
                return;
            }
            if (PRIMITIVES.has(ti.name)) {
                return;
            }
            const imp = imported.get(ti.name);
            if (imp) {
                ti.namespace = imp.namespace;
                if (imp.name !== ti.name) {
                    ti.resolvedName = imp.name;
                }
                return;
            }
            if (own.has(ti.name)) {
                ti.namespace = ns;
                return;
            }
            if (lenient) {
                // concerto-core loads a decorator type reference to an undeclared type
                // (test/data/decorators/invalid-typeref.cto); it is left unresolved.
                return;
            }
            report({ code: 'type-undeclared', errorClass: 'IllegalModelException', namespace: ns,
                message: `Undeclared type ${ti.name} in ${context}`, location });
        };
        const decorators = (list: any[] | undefined, context: string) => {
            for (const dec of list || []) {
                for (const arg of dec.arguments || []) {
                    if (short(arg.$class) === 'DecoratorTypeReference') {
                        resolve(arg.type, `decorator ${dec.name} of ${context}`, dec.location, true);
                    }
                }
            }
        };
        decorators(ast.decorators, ns);
        for (const d of ast.declarations || []) {
            const kind = short(d.$class);
            const fqn = `${ns}.${d.name}`;
            decorators(d.decorators, fqn);
            if (/Scalar$/.test(kind)) {
                d.namespace = ns;
                continue;
            }
            if (kind === 'MapDeclaration') {
                for (const side of [d.key, d.value]) {
                    if (side && side.type) {
                        resolve(side.type, `map ${fqn}`, d.location);
                    }
                    decorators(side && side.decorators, fqn);
                }
                continue;
            }
            if (d.superType) {
                resolve(d.superType, `super type of ${fqn}`, d.location);
            }
            if (kind === 'EnumDeclaration') {
                for (const p of d.properties || []) {
                    decorators(p.decorators, `${fqn}.${p.name}`);
                }
                continue;
            }
            for (const p of d.properties || []) {
                if (p.type) {
                    resolve(p.type, `property ${fqn}.${p.name}`, p.location);
                }
                decorators(p.decorators, `${fqn}.${p.name}`);
            }
        }
    }

    // Pass 3: the inheritance graph (missing and circular super types, BC-11).
    const decls = new Map<string, any>();
    for (const ast of models) {
        for (const d of ast.declarations || []) {
            decls.set(`${ast.namespace}.${d.name}`, d);
        }
    }
    const superOf = (fqn: string): string | null => {
        const d = decls.get(fqn);
        if (!d) {
            return null;
        }
        if (d.superType && d.superType.namespace) {
            return `${d.superType.namespace}.${d.superType.resolvedName || d.superType.name}`;
        }
        const implicit = IMPLICIT_SUPER[short(d.$class)];
        return implicit && !d.superType ? `${SYSTEM_NS}.${implicit}` : null;
    };
    for (const fqn of decls.keys()) {
        const seen = new Set<string>([fqn]);
        let cur = superOf(fqn);
        while (cur && !cur.startsWith(`${SYSTEM_NS}.`)) {
            if (seen.has(cur)) {
                report({ code: 'inheritance-circular', errorClass: 'IllegalModelException', namespace: fqn.substring(0, fqn.lastIndexOf('.')),
                    message: `Circular inheritance: ${[...seen, cur].join(' -> ')}` });
                break;
            }
            seen.add(cur);
            cur = superOf(cur);
        }
    }

    return { models: { $class: `${MM}.Models`, models }, diagnostics };
}

/** The implicit system super type of a declaration kind, if any (for the runtime). */
export function implicitSuperType(declarationClass: string): string | undefined {
    const s = IMPLICIT_SUPER[short(declarationClass)];
    return s ? `${SYSTEM_NS}.${s}` : undefined;
}
