/*
 * P5-78 spike (accordproject/concerto-rust#420): a small runtime query layer
 * over a Concertino document. Not shipped.
 *
 * Plain functions over a loaded model, so a bundler keeps only what an app
 * calls. The API list comes from the consumer survey (item 1): what
 * concerto-form (concerto-ui-core), the template playground's logic editor
 * and the concerto playground read through ModelManager/ClassDeclaration/
 * Property today.
 *
 * Concertino already holds most of what introspection needs: declarations
 * keyed by fully qualified name, inherited properties copied onto each type
 * (with `inheritedFrom`), the full `extends` chain, scalars resolved onto
 * properties. What it does not hold, and this layer adds:
 * - the system model (concerto@1.0.0 Concept, Asset, Participant,
 *   Transaction, Event): never written into Concertino;
 * - the implicit system super type of an asset, participant, transaction or
 *   event declared without `extends` (Concertino's `prototype`), and so the
 *   system identifier `$identifier` of an asset or participant declared
 *   without `identified`;
 * - whether a property's type is an enum or a map (`isEnum` is in the
 *   format but the converter never sets it), by looking the type up.
 */
import type {
    IConcertino, IConcertinoDeclaration, IConcertinoConceptDeclaration, IConcertinoProperty,
    IConcertinoEnumDeclaration, IConcertinoMapDeclaration,
} from './concertino/spec/concertino.metamodel@5.0.0';

export const SYSTEM_NS = 'concerto@1.0.0';
const PRIMITIVES = new Set(['String', 'Boolean', 'DateTime', 'Double', 'Integer', 'Long']);
const SCALAR_KINDS = new Set(['StringScalar', 'IntegerScalar', 'LongScalar', 'DoubleScalar', 'BooleanScalar', 'DateTimeScalar']);

/** A declaration kind, as concerto-core's declarationKind() spells it. */
export type Kind = 'ConceptDeclaration' | 'AssetDeclaration' | 'ParticipantDeclaration' | 'TransactionDeclaration'
    | 'EventDeclaration' | 'EnumDeclaration' | 'MapDeclaration' | 'ScalarDeclaration';

export interface Model {
    doc: IConcertino;
    /** Every declaration, the system model's included. */
    decls: Map<string, IConcertinoDeclaration>;
    /** Memo: fqn -> super type chain (nearest first), system types included. */
    chains: Map<string, string[]>;
    /** Memo: fqn -> identifier field name (null: not identified). */
    ids: Map<string, string | null>;
    /** Memo: fqn -> properties, own first then inherited (concerto-core getProperties order). */
    props: Map<string, IConcertinoProperty[]>;
}

const sys = (identified: boolean, timestamped: boolean): IConcertinoConceptDeclaration => {
    const properties: Record<string, IConcertinoProperty> = {};
    if (identified) {
        properties.$identifier = { name: '$identifier', type: 'String', isIdentifier: true } as IConcertinoProperty;
    }
    if (timestamped) {
        properties.$timestamp = { name: '$timestamp', type: 'DateTime' } as IConcertinoProperty;
    }
    return { type: 'ConceptDeclaration', isAbstract: true, properties } as IConcertinoConceptDeclaration;
};

/** The system model, as concerto-core's rootmodel.json declares it (R1: no $timestamp property there). */
const SYSTEM: Record<string, IConcertinoConceptDeclaration> = {
    [`${SYSTEM_NS}.Concept`]: sys(false, false),
    [`${SYSTEM_NS}.Asset`]: sys(true, false),
    [`${SYSTEM_NS}.Participant`]: sys(true, false),
    [`${SYSTEM_NS}.Transaction`]: sys(false, false),
    [`${SYSTEM_NS}.Event`]: sys(false, false),
};
const PROTOTYPE_SUPER: Record<string, string> = {
    AssetDeclaration: `${SYSTEM_NS}.Asset`,
    ParticipantDeclaration: `${SYSTEM_NS}.Participant`,
    TransactionDeclaration: `${SYSTEM_NS}.Transaction`,
    EventDeclaration: `${SYSTEM_NS}.Event`,
};

/**
 * Load a Concertino document.
 * @param doc the document (ConcertinoConverter.fromConcertoMetamodel output, or JSON built ahead of time)
 * @returns the model
 */
export function load(doc: IConcertino): Model {
    const decls = new Map<string, IConcertinoDeclaration>(Object.entries(SYSTEM));
    for (const [fqn, d] of Object.entries(doc.declarations)) {
        decls.set(fqn, d);
    }
    return { doc, decls, chains: new Map(), ids: new Map(), props: new Map() };
}

export const shortName = (fqn: string) => fqn.substring(fqn.lastIndexOf('.') + 1);
export const namespaceOf = (fqn: string) => (fqn.lastIndexOf('.') < 0 ? '' : fqn.substring(0, fqn.lastIndexOf('.')));
export const isPrimitive = (type: string) => PRIMITIVES.has(type);
export const isSystemType = (fqn: string) => namespaceOf(fqn) === SYSTEM_NS;

/** @returns the declaration, or undefined */
export function getType(m: Model, fqn: string): IConcertinoDeclaration | undefined {
    return m.decls.get(fqn);
}

/** @returns the namespaces of the document (the system namespace is not listed, as getAst(true) leaves it out) */
export function getNamespaces(m: Model): string[] {
    return Object.keys(m.doc.metadata.models);
}

/** @returns the fully qualified names of the declarations, optionally of one namespace */
export function getDeclarationNames(m: Model, namespace?: string): string[] {
    const all = Object.keys(m.doc.declarations);
    return namespace === undefined ? all : all.filter((f) => namespaceOf(f) === namespace);
}

/** @returns the concerto-core declarationKind() of a declaration */
export function kindOf(m: Model, fqn: string): Kind | undefined {
    const d = m.decls.get(fqn) as any;
    if (!d) {
        return undefined;
    }
    if (d.type === 'ConceptDeclaration') {
        return (d.prototype || 'ConceptDeclaration') as Kind;
    }
    if (SCALAR_KINDS.has(d.type)) {
        return 'ScalarDeclaration';
    }
    return d.type as Kind;
}

export const isEnum = (m: Model, fqn: string) => kindOf(m, fqn) === 'EnumDeclaration';
export const isMap = (m: Model, fqn: string) => kindOf(m, fqn) === 'MapDeclaration';
export const isScalar = (m: Model, fqn: string) => kindOf(m, fqn) === 'ScalarDeclaration';
export const isClass = (m: Model, fqn: string) => { const k = kindOf(m, fqn); return !!k && k !== 'EnumDeclaration' && k !== 'MapDeclaration' && k !== 'ScalarDeclaration'; };
export const isAbstract = (m: Model, fqn: string) => !!(m.decls.get(fqn) as any)?.isAbstract;
export const isTransaction = (m: Model, fqn: string) => derivesFrom(m, fqn, `${SYSTEM_NS}.Transaction`);
export const isEvent = (m: Model, fqn: string) => derivesFrom(m, fqn, `${SYSTEM_NS}.Event`);

/**
 * The super types, nearest first, the implicit system one included.
 * Concertino's `extends` is already the whole chain; only the system root is added.
 */
export function getSuperTypes(m: Model, fqn: string): string[] {
    let chain = m.chains.get(fqn);
    if (chain) {
        return chain;
    }
    const d = m.decls.get(fqn) as any;
    chain = [];
    if (d && d.type === 'ConceptDeclaration') {
        chain = [...(d.extends || [])];
        const last = chain.length ? chain[chain.length - 1] : fqn;
        const lastDecl = m.decls.get(last) as any;
        const root = lastDecl && !isSystemType(last) ? PROTOTYPE_SUPER[lastDecl.prototype] : undefined;
        if (root && !(lastDecl.extends || []).length) {
            chain.push(root);
        }
    }
    m.chains.set(fqn, chain);
    return chain;
}

/** concerto-core ModelManager.derivesFrom: `fqn` is `superFqn` or one of its subtypes. */
export function derivesFrom(m: Model, fqn: string, superFqn: string): boolean {
    if (fqn === superFqn) {
        return true;
    }
    // Every class-like declaration is a concerto@1.0.0.Concept (R1 isAssignableTo).
    if (superFqn === `${SYSTEM_NS}.Concept` && isClass(m, fqn)) {
        return true;
    }
    return getSuperTypes(m, fqn).includes(superFqn);
}

/** concerto-core ModelUtil.isAssignableTo for a type name (primitive or fqn). */
export function isAssignableTo(m: Model, type: string, target: string): boolean {
    if (isPrimitive(type) || isPrimitive(target)) {
        return type === target;
    }
    return derivesFrom(m, type, target);
}

/** The concrete and abstract subtypes of `fqn`, itself included (getAssignableClassDeclarations). */
export function getAssignableTypes(m: Model, fqn: string): string[] {
    return [...m.decls.keys()].filter((f) => isClass(m, f) && derivesFrom(m, f, fqn));
}

/**
 * The properties: own first, then inherited, nearest super type first (concerto-core getProperties order).
 * The system properties ($identifier, $timestamp) of the implicit system super type are included.
 * @param own only the declaration's own properties
 */
export function getProperties(m: Model, fqn: string, own = false): IConcertinoProperty[] {
    const d = m.decls.get(fqn) as IConcertinoConceptDeclaration | undefined;
    if (!d || !d.properties) {
        return [];
    }
    if (own) {
        return Object.values(d.properties).filter((p) => !p.inheritedFrom);
    }
    let list = m.props.get(fqn);
    if (list) {
        return list;
    }
    const all = Object.values(d.properties);
    list = all.filter((p) => !p.inheritedFrom);
    const seen = new Set(list.map((p) => p.name));
    for (const sup of getSuperTypes(m, fqn)) {
        const sd = m.decls.get(sup) as IConcertinoConceptDeclaration | undefined;
        for (const p of Object.values(sd?.properties || {})) {
            if (!p.inheritedFrom && !seen.has(p.name)) {
                // Prefer the copy on `fqn` (it has the scalar resolved onto it).
                list.push((d.properties as any)[p.name] || p);
                seen.add(p.name);
            }
        }
    }
    m.props.set(fqn, list);
    return list;
}

/** @returns one property (own or inherited), or undefined */
export function getProperty(m: Model, fqn: string, name: string): IConcertinoProperty | undefined {
    return getProperties(m, fqn).find((p) => p.name === name);
}

/**
 * concerto-core getIdentifierFieldName: the explicit `identified by` field, else
 * `$identifier` for a system-identified type, else null.
 */
export function getIdentifierFieldName(m: Model, fqn: string): string | null {
    if (m.ids.has(fqn)) {
        return m.ids.get(fqn)!;
    }
    let id: string | null = null;
    const props = getProperties(m, fqn);
    const explicit = props.find((p) => p.isIdentifier && p.name !== '$identifier');
    if (explicit) {
        id = explicit.name;
    } else if (props.some((p) => p.name === '$identifier')) {
        id = '$identifier';
    }
    m.ids.set(fqn, id);
    return id;
}

export const isIdentified = (m: Model, fqn: string) => getIdentifierFieldName(m, fqn) !== null;
export const isSystemIdentified = (m: Model, fqn: string) => getIdentifierFieldName(m, fqn) === '$identifier';

/** What a property's type is, once looked up. */
export type PropertyKind = 'primitive' | 'enum' | 'map' | 'class' | 'relationship' | 'unknown';

export function propertyKind(m: Model, p: IConcertinoProperty): PropertyKind {
    if (p.isRelationship) {
        return 'relationship';
    }
    if (isPrimitive(p.type)) {
        return 'primitive';
    }
    const k = kindOf(m, p.type);
    if (!k) {
        return 'unknown';
    }
    return k === 'EnumDeclaration' ? 'enum' : k === 'MapDeclaration' ? 'map' : 'class';
}

/** @returns the enum values, in declaration order */
export function getEnumValues(m: Model, fqn: string): string[] {
    const d = m.decls.get(fqn) as IConcertinoEnumDeclaration | undefined;
    return d && d.type === 'EnumDeclaration' ? Object.keys(d.values || {}) : [];
}

/** @returns a map declaration's key and value */
export function getMapTypes(m: Model, fqn: string): { key: string; value: string; valueIsRelationship: boolean } | undefined {
    const d = m.decls.get(fqn) as IConcertinoMapDeclaration | undefined;
    if (!d || d.type !== 'MapDeclaration') {
        return undefined;
    }
    return { key: d.key.type, value: d.value.type, valueIsRelationship: !!d.value.isRelationship };
}

/**
 * Decorators (non-vocabulary) of a declaration, or of one of its properties
 * (`metadata`: name -> argument values), and the vocabulary (`@Term`, `@Term_*`).
 */
export function getDecorators(m: Model, fqn: string, property?: string): Record<string, unknown[] | null> {
    const d = m.decls.get(fqn) as any;
    const target = property === undefined ? d : property in (d?.values || {}) ? d.values[property] : getProperty(m, fqn, property);
    return (target && target.metadata) || {};
}

export function getVocabulary(m: Model, fqn: string, property?: string): { label?: string; additionalTerms?: Record<string, string> } {
    const d = m.decls.get(fqn) as any;
    const target = property === undefined ? d : property in (d?.values || {}) ? d.values[property] : getProperty(m, fqn, property);
    return (target && target.vocabulary) || {};
}

/** The model-level decorators of a namespace, as the AST holds them. */
export function getNamespaceDecorators(m: Model, namespace: string): unknown[] {
    return (m.doc.metadata.models[namespace] as any)?.decorators || [];
}
