/*
 * P5-78 spike (accordproject/concerto-rust#420): plain-JSON validation and
 * normalisation in TypeScript over a Concertino document. Not shipped.
 *
 *   validate(model, json, options?)        -> throws, or returns the populated instance
 *   normalise(model, json, options?)       -> the JSON Serializer.toJSON(Serializer.fromJSON(json)) gives
 *   check(model, json, options?)           -> {ok, error?, value?} without throwing
 *
 * R1 semantics, not v5: it follows concerto-rust's native plain-JSON route
 * (concerto-core/src/instance/from_json.rs, `Serializer.fromJSON` without
 * the TS object model, then validate.rs, `ResourceValidator`), step for
 * step, so the first error is the same one. That includes BC-07/BC-42 strict
 * DateTime (format and real instant), BC-10 integral finite Integer/Long,
 * BC-05 relationship-typed map values, BC-06, BC-08 (`Unrecognised`), BC-13
 * (non-string `$class`), BC-43 (map DateTime values), BC-45 (DateTime
 * defaults). Errors carry the concerto-core exception class
 * (`errorClass`); messages are not matched (maintainer decision 2026-09-27).
 * Regexes are native JS `RegExp` (as R1, BC-28).
 *
 * Out of scope for the spike: Factory instance generation, `rejectUnknownKeys`
 * / `rejectRequiredNull`, `permitResourcesForRelationships` /
 * `convertResourcesToRelationships` on toJSON, resource de-duplication.
 */
import type { IConcertinoProperty } from './concertino/spec/concertino.metamodel@5.0.0';
import {
    Model, getType, kindOf, isAbstract, isTransaction, isEvent, getProperties, getProperty,
    getIdentifierFieldName, getEnumValues, getMapTypes, isAssignableTo, isClass, namespaceOf, shortName, isPrimitive,
} from './query';

export type ErrorClass = 'ValidationException' | 'TypeNotFoundException' | 'Error' | 'TypeError';

export class InstanceError extends Error {
    errorClass: ErrorClass;
    code: string;
    constructor(errorClass: ErrorClass, code: string, message: string) {
        super(message);
        this.errorClass = errorClass;
        this.code = code;
        this.name = errorClass;
    }
}

export interface Options {
    /** Validate after population (Serializer `validate`, default true). */
    validate?: boolean;
    /** Minutes, hours when |n| <= 16 (dayjs), or a `±HH:mm` string. Default 0. */
    utcOffset?: number | string;
    /** Since BC-07 only stops utcOffset being applied on input. */
    strictQualifiedDateTimes?: boolean;
    /** Accept an embedded resource where a relationship is declared. */
    acceptResourcesForRelationships?: boolean;
    /** Identifier generator for system-identified types (default crypto.randomUUID). */
    newId?: () => string;
    /** Clock for $timestamp (default Date.now). */
    now?: () => number;
}

const vErr = (code: string, message: string) => new InstanceError('ValidationException', code, message);
const pErr = (code: string, message: string) => new InstanceError('Error', code, message);
const tnf = (fqn: string) => new InstanceError('TypeNotFoundException', 'type-not-found', `Type ${fqn} not found`);

// ---- populated value shapes -------------------------------------------------

class DT {
    constructor(public ms: number, public offset: number) {}
}
class Rel {
    constructor(public fqn: string, public id: string) {}
}
class JMap {
    constructor(public entries: [unknown, unknown][]) {}
}
class Res {
    props: Record<string, unknown> = {};
    constructor(public fqn: string, public idKey: string) {}
}

// ---- DateTime (BC-07, BC-42) ------------------------------------------------

const STRICT_DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;

/** @returns the instant (ms) of a strict ISO 8601 date-time naming a real instant, or null */
export function parseStrictDateTime(s: string): DT | null {
    const m = STRICT_DT.exec(s);
    if (!m) {
        return null;
    }
    const [y, mo, d, h, mi, se] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number);
    if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || se > 59) {
        return null;
    }
    const dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
    if (d > dim) {
        return null;
    }
    const ms = m[7] ? Number((m[7] + '00').substring(0, 3)) : 0;
    const off = m[8] === 'Z' ? 0 : (m[9] === '-' ? -1 : 1) * (Number(m[10]) * 60 + Number(m[11]));
    // setUTCFullYear keeps years 0-99 as written (Date.UTC maps them to 1900-1999).
    const date = new Date(0);
    date.setUTCFullYear(y, mo - 1, d);
    date.setUTCHours(h, mi, se, ms);
    const fixed = date.getTime() - off * 60000;
    return Number.isFinite(fixed) ? new DT(fixed, off) : null;
}

/** dayjs utcOffset(n): a number with |n| <= 16 is hours; a string `±HH:mm` or `±HHmm`; anything else 0. */
function offsetMinutes(o: unknown): number {
    if (typeof o === 'number' && Number.isFinite(o)) {
        return Math.abs(o) <= 16 ? o * 60 : o;
    }
    if (typeof o === 'string') {
        const m = /^([+-])(\d{2}):?(\d{2})$/.exec(o);
        if (m) {
            return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
        }
    }
    return 0;
}

const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');

function formatDateTime(dt: DT, offset: number): string {
    const d = new Date(dt.ms + offset * 60000);
    const y = d.getUTCFullYear();
    const year = y < 0 ? '-' + pad(-y, 6) : y > 9999 ? '+' + pad(y, 6) : pad(y, 4);
    const body = `${year}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
    if (offset === 0) {
        return body + 'Z';
    }
    return `${body}${offset < 0 ? '-' : '+'}${pad(Math.trunc(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

// ---- helpers ------------------------------------------------------------------

const SYSTEM_PROPS = new Set(['$class', '$identifier', '$timestamp', '$classDeclaration', '$namespace', '$type', '$modelManager',
    '$validator', '$identifierFieldName', '$imports', '$superTypes', '$id']);
const PRIVATE_PROPS = new Set(['$classDeclaration', '$namespace', '$type', '$modelManager', '$validator', '$identifierFieldName',
    '$imports', '$superTypes', '$id']);
const isNullish = (v: unknown) => v === null || v === undefined;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const typeName = (p: IConcertinoProperty) => p.type;

function readProp(v: unknown, key: string): unknown {
    if (v === null || v === undefined) {
        throw new InstanceError('TypeError', 'read-properties', `Cannot read properties of ${v} (reading '${key}')`);
    }
    return (v as any)[key];
}

function objectKeys(v: unknown): string[] {
    if (v === null || v === undefined) {
        throw new InstanceError('TypeError', 'convert-null', 'Cannot convert undefined or null to object');
    }
    return Object.keys(v as object);
}

function getTypeOrThrow(m: Model, fqn: string) {
    const d = getType(m, fqn);
    if (!d) {
        throw tnf(fqn);
    }
    return d;
}

function regexOf(p: { regex?: string }): RegExp | null {
    if (!p.regex) {
        return null;
    }
    const i = p.regex.lastIndexOf('/');
    return new RegExp(p.regex.substring(1, i), p.regex.substring(i + 1));
}

// ---- population (Serializer.fromJSON / JSONPopulator / Factory.newResource) -----

interface Ctx {
    m: Model;
    o: Required<Pick<Options, 'validate' | 'strictQualifiedDateTimes' | 'acceptResourcesForRelationships'>> & { utcOffset: number; newId: () => string; now: () => number };
    path: string;
}

function newResource(c: Ctx, fqn: string, id: unknown): Res {
    if (isAbstract(c.m, fqn)) {
        throw pErr('factory-newinstance-abstracttype', `Cannot instantiate the abstract type ${fqn}`);
    }
    const idField = getIdentifierFieldName(c.m, fqn);
    let theId = id;
    if (idField === '$identifier' && isNullish(id)) {
        theId = c.o.newId();
    }
    if (idField) {
        if (typeof theId !== 'string') {
            throw pErr('factory-newinstance-invalididentifier', `Invalid or missing identifier for type ${fqn}`);
        }
        if (theId.trim() === '') {
            throw pErr('factory-newinstance-missingidentifier', `Missing identifier for type ${fqn}`);
        }
        const re = regexOf(getProperty(c.m, fqn, idField) as any || {});
        if (re && !re.test(theId)) {
            throw pErr('factory-newresource-idregexmismatch', `Provided id does not match regex: ${re}`);
        }
    } else if ((typeof theId === 'string' && theId !== '') || (!isNullish(theId) && typeof theId !== 'string' && theId)) {
        throw pErr('factory-newresource-notidentifiable', `Type is not identifiable ${fqn}`);
    }
    const r = new Res(fqn, idField || '$identifier');
    r.props.$identifier = theId;
    r.props[r.idKey] = theId;
    if (isTransaction(c.m, fqn) || isEvent(c.m, fqn)) {
        r.props.$timestamp = new DT(c.o.now(), 0);
    }
    // Typed.assignFieldDefaults: every non-relationship property with a default.
    for (const p of getProperties(c.m, fqn)) {
        const def = (p as any).default;
        if (p.isRelationship || isNullish(def)) {
            continue;
        }
        let v: unknown = def;
        switch (typeName(p)) {
        case 'Integer': case 'Long': v = parseInt(String(def), 10); break;
        case 'Double': v = parseFloat(String(def)); break;
        case 'Boolean': v = def === true; break;
        case 'DateTime': {
            const dt = typeof def === 'string' ? parseStrictDateTime(def) : null;
            v = dt || { invalidDefault: vErr('typed-assignfielddefaults-datetime', `Invalid DateTime default ${def} on ${fqn}.${p.name}`) };
            break;
        }
        default: break;
        }
        r.props[p.name] = v;
    }
    if (idField) {
        r.props[idField] = theId;
    }
    return r;
}

function visitClass(c: Ctx, fqn: string, json: unknown, r: Res): Res {
    const keys = objectKeys(json);
    const priv = keys.filter((k) => PRIVATE_PROPS.has(k));
    if (priv.length) {
        throw vErr('reservedproperties', `Unexpected reserved properties for type ${fqn}: ${priv.join(', ')}`);
    }
    if (keys.includes('$timestamp') && !(isTransaction(c.m, fqn) || isEvent(c.m, fqn))) {
        throw vErr('timestamp', `The class ${fqn} is not a transaction or event, so it cannot have a $timestamp`);
    }
    const assignable = keys.filter((k) => !SYSTEM_PROPS.has(k) && !isNullish((json as any)[k]));
    const declared = new Map(getProperties(c.m, fqn).map((p) => [p.name, p]));
    const unexpected = assignable.filter((k) => !declared.has(k));
    if (unexpected.length) {
        throw vErr('unexpectedproperties', `Unexpected properties for type ${fqn}: ${unexpected.join(', ')}`);
    }
    for (const k of assignable) {
        const p = declared.get(k)!;
        const save = c.path;
        c.path += '.' + k;
        r.props[k] = p.isRelationship ? visitRelationship(c, fqn, p, (json as any)[k]) : visitField(c, fqn, p, (json as any)[k]);
        c.path = save;
    }
    for (const v of Object.values(r.props)) {
        if (isObj(v) && (v as any).invalidDefault) {
            throw (v as any).invalidDefault;
        }
    }
    return r;
}

function visitField(c: Ctx, owner: string, p: IConcertinoProperty, json: unknown): unknown {
    if (p.isArray) {
        if (!Array.isArray(json)) {
            throw vErr('notarray', `Expected value at path \`${c.path}\` to be an array of type \`${p.type}\``);
        }
        return json.map((item, n) => {
            const save = c.path;
            c.path += `[${n}]`;
            const v = convertItem(c, owner, p, item);
            c.path = save;
            return v;
        });
    }
    return convertItem(c, owner, p, json);
}

function convertItem(c: Ctx, owner: string, p: IConcertinoProperty, item: unknown): unknown {
    const k = isPrimitive(p.type) ? 'primitive' : kindOf(c.m, p.type);
    if (k === 'primitive' || k === 'EnumDeclaration') {
        return convertToObject(c, p, item);
    }
    const cls = readProp(item, '$class');
    let type: string;
    if (cls) {
        if (typeof cls !== 'string') {
            throw pErr('class-not-string', `a $class that is not a string: ${String(cls)}`);
        }
        type = cls;
    } else {
        type = p.type;
    }
    getTypeOrThrow(c.m, type);
    if (kindOf(c.m, type) === 'MapDeclaration') {
        return visitMap(c, type, item);
    }
    const idField = getIdentifierFieldName(c.m, type);
    const r = newResource(c, type, idField ? readProp(item, idField) : undefined);
    return accept(c, type, item, r);
}

function accept(c: Ctx, fqn: string, json: unknown, r: Res | null): unknown {
    if (isClass(c.m, fqn)) {
        return visitClass(c, fqn, json, r!);
    }
    if (kindOf(c.m, fqn) === 'MapDeclaration') {
        return visitMap(c, fqn, json);
    }
    if (kindOf(c.m, fqn) === 'EnumDeclaration') {
        // An enum is a ClassDeclaration in concerto-core: its "properties" are its
        // values, and populating one is BC-08's `Unrecognised element` error.
        const values = getEnumValues(c.m, fqn);
        const keys = objectKeys(json).filter((k) => !SYSTEM_PROPS.has(k) && !isNullish((json as any)[k]));
        const unexpected = keys.filter((k) => !values.includes(k));
        if (unexpected.length) {
            throw vErr('unexpectedproperties', `Unexpected properties for type ${fqn}: ${unexpected.join(', ')}`);
        }
        if (keys.length) {
            throw pErr('unrecognised', `Unrecognised element "${fqn}.${keys[0]}"`);
        }
        return r;
    }
    throw pErr('unrecognised', `Unrecognised element "${fqn}"`);
}

function convertToObject(c: Ctx, p: IConcertinoProperty, json: unknown): unknown {
    const wrong = () => vErr('wrongtype', `Expected value at path \`${c.path}\` to be of type \`${p.type}\``);
    switch (p.type) {
    case 'DateTime': {
        if (typeof json !== 'string') {
            throw wrong();
        }
        if (!STRICT_DT.test(json)) {
            throw vErr('datetimeformat', `Expected value at path \`${c.path}\` to be of type \`DateTime\` with format YYYY-MM-DDTHH:mm:ss[Z]`);
        }
        const dt = parseStrictDateTime(json);
        if (!dt) {
            throw wrong();
        }
        return new DT(dt.ms, c.o.strictQualifiedDateTimes ? dt.offset : c.o.utcOffset);
    }
    case 'Integer': case 'Long':
        if (typeof json === 'number' && Number.isFinite(json) && Math.trunc(json) === json) {
            return json;
        }
        throw wrong();
    case 'Double':
        if (typeof json === 'number') {
            return json;
        }
        throw wrong();
    case 'Boolean':
        if (typeof json === 'boolean') {
            return json;
        }
        throw wrong();
    case 'String':
        if (typeof json === 'string') {
            return json;
        }
        throw wrong();
    default:
        return json; // an enum value: checked by validation
    }
}

function relationshipFromURI(c: Ctx, uri: string, defNs: string, defType: string): Rel {
    let s = uri;
    let fragment: string | null = null;
    const hash = s.indexOf('#');
    if (hash > -1) {
        fragment = s.substring(hash + 1) || null;
        s = s.substring(0, hash);
    }
    let query: string | null = null;
    const q = s.indexOf('?');
    if (q > -1) {
        query = s.substring(q + 1);
        s = s.substring(0, q);
    }
    let scheme: string | null = null;
    if (s.substring(0, 2) !== '//') {
        const colon = s.indexOf(':');
        if (colon > -1 && /^[a-z][a-z0-9.+-]*$/i.test(s.substring(0, colon))) {
            scheme = s.substring(0, colon).toLowerCase();
            s = s.substring(colon + 1);
        }
    }
    if (s.substring(0, 2) === '//') {
        throw pErr('invalid-uri', 'Invalid resource URI format: ' + uri);
    }
    if (scheme && scheme !== 'resource') {
        throw pErr('invalid-uri-scheme', 'Invalid URI scheme: ' + uri);
    }
    if (query !== null) {
        throw pErr('invalid-uri', 'Invalid resource URI format: ' + uri);
    }
    let ns: string;
    let type: string;
    let id: string;
    if (!fragment) {
        ns = defNs;
        type = defType;
        id = s;
    } else {
        ns = namespaceOf(s);
        type = shortName(s);
        id = fragment;
    }
    if (!ns) {
        throw pErr('missing-namespace', 'Missing namespace');
    }
    if (!type) {
        throw pErr('missing-type', 'Missing type');
    }
    if (!id) {
        throw pErr('missing-id', 'Missing id');
    }
    try {
        id = decodeURIComponent(id);
    } catch (e) {
        throw new InstanceError('Error', 'uri-malformed', 'URI malformed');
    }
    const fqn = `${ns}.${type}`;
    getTypeOrThrow(c.m, fqn);
    return new Rel(fqn, id);
}

function relationshipResource(c: Ctx, p: { type: string }, item: unknown): unknown {
    if (!c.o.acceptResourcesForRelationships) {
        throw pErr('notastring', `Invalid JSON data. Found a value that is not a string for relationship ${p.type}`);
    }
    const cls = readProp(item, '$class');
    if (!cls) {
        throw pErr('noclass', `Invalid JSON data. Does not contain a $class type identifier for relationship ${p.type}`);
    }
    if (typeof cls !== 'string') {
        throw pErr('class-not-string', `a $class that is not a string: ${String(cls)}`);
    }
    getTypeOrThrow(c.m, cls);
    const idField = getIdentifierFieldName(c.m, cls);
    const r = newResource(c, cls, idField ? readProp(item, idField) : readProp(item, 'null'));
    return accept(c, cls, item, r);
}

function convertRelationship(c: Ctx, p: { type: string }, json: unknown): unknown {
    if (typeof json === 'string') {
        return relationshipFromURI(c, json, namespaceOf(p.type), shortName(p.type));
    }
    if (isObj(json)) {
        return relationshipResource(c, p, json);
    }
    throw pErr('notstringorobject', `Invalid JSON data. Found a value that is not a string or object for relationship ${p.type}`);
}

function visitRelationship(c: Ctx, owner: string, p: IConcertinoProperty, json: unknown): unknown {
    if (p.isArray) {
        if (!Array.isArray(json)) {
            throw vErr('notarray', `Expected value at path \`${c.path}\` to be an array of type \`${p.type}\``);
        }
        return json.map((item) => (typeof item === 'string'
            ? relationshipFromURI(c, item, namespaceOf(p.type), shortName(p.type))
            : relationshipResource(c, p, item)));
    }
    return convertRelationship(c, p, json);
}

function visitMap(c: Ctx, fqn: string, json: unknown): JMap {
    const keys = objectKeys(json);
    const priv = keys.filter((k) => PRIVATE_PROPS.has(k));
    if (priv.length) {
        throw vErr('reservedproperties', `Unexpected reserved properties for type ${fqn}: ${priv.join(', ')}`);
    }
    if (keys.includes('$timestamp')) {
        throw vErr('timestamp', `The class ${fqn} is not a transaction or event, so it cannot have a $timestamp`);
    }
    const mt = getMapTypes(c.m, fqn)!;
    const entries: [unknown, unknown][] = [];
    const set = (k: unknown, v: unknown) => {
        const e = entries.find((x) => x[0] === k);
        if (e) {
            e[1] = v;
        } else {
            entries.push([k, v]);
        }
    };
    for (const key of keys) {
        const value = (json as any)[key];
        if (key === '$class') {
            set(key, value);
            continue;
        }
        const k = isPrimitive(mt.key) ? key : processMapType(c, mt.key, key);
        let v: unknown;
        if (mt.valueIsRelationship) {
            v = convertRelationship(c, { type: mt.value }, value);
        } else if (isPrimitive(mt.value)) {
            v = value;
        } else {
            v = processMapType(c, mt.value, value);
        }
        set(k, v);
    }
    return new JMap(entries);
}

function processMapType(c: Ctx, type: string, value: unknown): unknown {
    let decl: string | undefined;
    if (isObj(value)) {
        const cls = (value as any).$class;
        if (cls) {
            decl = typeof cls === 'string' && getType(c.m, cls) ? cls : undefined;
        } else {
            decl = getType(c.m, type) ? type : undefined;
        }
    } else {
        decl = getType(c.m, type) ? type : undefined;
    }
    if (decl && (isClass(c.m, decl) || kindOf(c.m, decl) === 'EnumDeclaration')) {
        const idField = getIdentifierFieldName(c.m, decl);
        const r = newResource(c, decl, idField);
        return accept(c, decl, value, r);
    }
    return value;
}

// ---- validation (ResourceValidator) ------------------------------------------------

interface VCtx {
    m: Model;
    rootId: string;
    current?: string;
}

const fqi = (fqn: string, id: unknown) => (typeof id === 'string' && id ? `${fqn}#${id}` : fqn);

function validateResource(v: VCtx, declared: string, value: unknown, isMapValue = false): void {
    if (!(value instanceof Res)) {
        throw vErr('notresourceorconcept', `Model violation in the "${v.rootId}" instance. Expected a ${declared}.`);
    }
    const own = value.fqn;
    if (!getType(v.m, own)) {
        if (isMapValue) {
            throw vErr('notresourceorconcept', 'not a resource');
        }
        throw tnf(own);
    }
    const idField = getIdentifierFieldName(v.m, own);
    v.rootId = fqi(own, value.props[idField || '$identifier']);
    if (isAbstract(v.m, own)) {
        throw vErr('abstractclass', `The class ${own} is abstract and cannot be instantiated.`);
    }
    const props = getProperties(v.m, own);
    const names = new Set(props.map((p) => p.name));
    for (const key of Object.keys(value.props)) {
        if (!SYSTEM_PROPS.has(key) && !names.has(key)) {
            throw vErr('undeclaredfield', `Instance ${own} has a property named ${key}, which is not declared in ${own}.`);
        }
    }
    const declaredIdentified = getIdentifierFieldName(v.m, declared) !== null;
    if (declaredIdentified) {
        const id = value.props[idField || '$identifier'];
        if (typeof id !== 'string' || id.trim() === '') {
            throw vErr('emptyidentifier', `Instance ${v.rootId} has an empty identifier.`);
        }
        v.current = `${own}#${id}`;
    }
    for (const p of props) {
        if (p.name === '$timestamp') {
            continue; // R1's system model declares no $timestamp property (Concertino adds one)
        }
        const pv = value.props[p.name];
        if (!isNullish(pv)) {
            validateProperty(v, own, p, pv);
        } else if (!p.isOptional) {
            if (p.name === '$identifier' && idField !== '$identifier') {
                continue;
            }
            if (!isNullish((p as any).default) && typeName(p) !== 'DateTime') {
                continue;
            }
            throw vErr('missingrequiredproperty', `The instance "${v.rootId}" is missing the required field "${p.name}".`);
        }
    }
}

function sizeCheck(v: VCtx, p: IConcertinoProperty, n: number) {
    const size = (p as any).size as [number | null, number | null] | undefined;
    if (size && ((size[0] !== null && n < size[0]) || (size[1] !== null && n > size[1]))) {
        throw vErr('collectionsize', `Collection size ${n} of ${p.name} is outside [${size[0]}, ${size[1]}] in ${v.rootId}`);
    }
}

function validateProperty(v: VCtx, owner: string, p: IConcertinoProperty, value: unknown): void {
    if (p.isRelationship) {
        if (p.isArray) {
            if (!Array.isArray(value)) {
                throw vErr('invalidfieldassignment', `Instance ${v.rootId} invalid field assignment ${p.name}`);
            }
            sizeCheck(v, p, value.length);
            value.forEach((item) => checkRelationship(v, p.type, item));
        } else {
            checkRelationship(v, p.type, value);
        }
        return;
    }
    const k = isPrimitive(p.type) ? 'primitive' : kindOf(v.m, p.type);
    if (k === 'EnumDeclaration') {
        if (p.isArray) {
            if (!Array.isArray(value)) {
                throw vErr('fieldtypeviolation', `Model violation in the "${v.rootId}" instance. The field "${p.name}" has a value that is not an array.`);
            }
            sizeCheck(v, p, value.length);
            value.forEach((item) => checkEnum(v, p.type, item));
        } else {
            checkEnum(v, p.type, value);
        }
        return;
    }
    if (p.isArray) {
        if (!Array.isArray(value)) {
            throw vErr('fieldtypeviolation', `Model violation in the "${v.rootId}" instance. The field "${p.name}" has a value that is not an array.`);
        }
        sizeCheck(v, p, value.length);
        value.forEach((item) => checkItem(v, owner, p, k, item));
        return;
    }
    if (k === 'MapDeclaration' && value instanceof JMap) {
        sizeCheck(v, p, value.entries.length);
    }
    checkItem(v, owner, p, k, value);
}

function checkEnum(v: VCtx, enumFqn: string, value: unknown) {
    if (typeof value !== 'string' || !getEnumValues(v.m, enumFqn).includes(value)) {
        throw vErr('invalidenumvalue', `Instance ${v.rootId} invalid enum value ${String(value)} for ${shortName(enumFqn)}`);
    }
}

function primitiveMatches(type: string, value: unknown): boolean {
    switch (type) {
    case 'String': return typeof value === 'string';
    case 'Long': case 'Integer': case 'Double': return typeof value === 'number' && Number.isFinite(value);
    case 'Boolean': return typeof value === 'boolean';
    case 'DateTime': return value instanceof DT;
    default: return false;
    }
}

function checkItem(v: VCtx, owner: string, p: IConcertinoProperty, k: string | undefined, value: unknown): void {
    if (value === undefined) {
        throw vErr('fieldtypeviolation', `The field "${p.name}" has an undefined value.`);
    }
    if (k === 'primitive') {
        if (!primitiveMatches(p.type, value)) {
            throw vErr('fieldtypeviolation', `Model violation in the "${v.rootId}" instance. The field "${p.name}" has a value of "${String(value)}" (type of value: "${typeof value}"). Expected type of value: "${p.type}".`);
        }
        const id = v.current;
        if (p.type === 'String') {
            const re = regexOf(p as any);
            if (re && !re.test(value as string)) {
                throw vErr('regex', `Validator error for field \`${id}\`. ${owner}.${p.name}: Value '${value}' failed to match validation regex: ${(p as any).regex}`);
            }
            const len = (p as any).length as [number | null, number | null] | undefined;
            const n = (value as string).length;
            if (len && ((len[0] !== null && n < len[0]) || (len[1] !== null && n > len[1]))) {
                throw vErr('length', `Validator error for field \`${id}\`. ${owner}.${p.name}: The string length of '${value}' should be ...`);
            }
        } else if (p.type === 'Integer' || p.type === 'Long' || p.type === 'Double') {
            const range = (p as any).range as [number | null, number | null] | undefined;
            const n = value as number;
            if (range && ((range[0] !== null && n < range[0]) || (range[1] !== null && n > range[1]))) {
                throw vErr('range', `Validator error for field \`${id}\`. ${owner}.${p.name}: Value is outside upper or lower bound ${n}`);
            }
        }
        return;
    }
    if (k === 'MapDeclaration') {
        validateMap(v, p.type, value);
        return;
    }
    // A class-typed field.
    if (value instanceof Res && !isAssignableTo(v.m, value.fqn, p.type)) {
        throw vErr('invalidfieldassignment', `Instance ${v.rootId} invalid field assignment ${p.name}: ${value.fqn} is not assignable to ${p.type}`);
    }
    validateResource(v, p.type, value);
}

function checkRelationship(v: VCtx, declaredType: string, value: unknown): void {
    if (!(value instanceof Rel)) {
        throw vErr('notrelationship', `Instance ${v.rootId} has a property that is not a relationship to ${declaredType}`);
    }
    const target = value.fqn;
    if (!getType(v.m, target)) {
        throw tnf(target);
    }
    if (!isClass(v.m, target)) {
        throw vErr('notrelationship', `Instance ${v.rootId} has a relationship to a non-class ${target}`);
    }
    if (getIdentifierFieldName(v.m, target) === null) {
        throw pErr('checkrelationship-notidentifiable', 'Cannot have a relationship to a type that is not identifiable');
    }
    if (!isAssignableTo(v.m, target, declaredType)) {
        throw vErr('invalidfieldassignment', `Instance ${v.rootId} invalid relationship: ${target} is not assignable to ${declaredType}`);
    }
}

function validateMap(v: VCtx, mapFqn: string, value: unknown): void {
    if (!(value instanceof JMap)) {
        throw pErr('visitmapdeclaration-notamap', 'Expected a Map, but found ' + JSON.stringify(value));
    }
    const mt = getMapTypes(v.m, mapFqn)!;
    const keyIsScalar = !isPrimitive(mt.key) && kindOf(v.m, mt.key) === 'ScalarDeclaration';
    for (const [key, val] of value.entries) {
        if (typeof key === 'string' && SYSTEM_PROPS.has(key)) {
            continue;
        }
        checkMapType(v, mapFqn, mt.key, keyIsScalar, key);
        if (mt.valueIsRelationship) {
            checkRelationship(v, mt.value, val);
            continue;
        }
        checkMapType(v, mapFqn, mt.value, keyIsScalar, val);
    }
}

function scalarPrimitive(m: Model, fqn: string): string {
    const t = (getType(m, fqn) as any).type as string;
    return t.replace(/Scalar$/, '');
}

function checkMapType(v: VCtx, mapFqn: string, type: string, keyIsScalar: boolean, value: unknown): void {
    let prim = type;
    if (!isPrimitive(type)) {
        const k = kindOf(v.m, type);
        if (keyIsScalar && k === 'ScalarDeclaration') {
            prim = scalarPrimitive(v.m, type);
        } else if (k === 'EnumDeclaration') {
            checkEnum(v, type, value);
            return;
        } else if (k && isClass(v.m, type)) {
            validateResource(v, type, value, true);
            return;
        } else {
            return;
        }
    }
    if (prim === 'String' && typeof value !== 'string') {
        throw pErr('checkmaptype-expectedstring', `Model violation in "${mapFqn}". Expected Type of String but found '${String(value)}' instead.`);
    }
    if (prim === 'DateTime' && !(typeof value === 'string' && parseStrictDateTime(value))) {
        throw pErr('checkmaptype-expecteddatetime', `Model violation in "${mapFqn}". Expected Type of DateTime but found '${String(value)}' instead.`);
    }
    if (prim === 'Boolean' && typeof value !== 'boolean') {
        throw pErr('checkmaptype-expectedboolean', `Model violation in "${mapFqn}". Expected Type of Boolean but found ${typeof value} instead, for value '${String(value)}'.`);
    }
}

// ---- toJSON (JSONGenerator) ----------------------------------------------------------

function toJSONResource(m: Model, r: Res, offset: number): Record<string, unknown> {
    const out: Record<string, unknown> = { $class: r.fqn };
    for (const p of getProperties(m, r.fqn)) {
        const val = r.props[p.name];
        if (isNullish(val)) {
            continue;
        }
        out[p.name] = toJSONValue(m, p, val, offset);
    }
    // System properties R1's getProperties() lists ($identifier through the
    // system model) are covered above; $timestamp is not a declared property in R1.
    if (r.props.$timestamp instanceof DT && !('$timestamp' in out)) {
        out.$timestamp = formatDateTime(r.props.$timestamp, offset);
    }
    return out;
}

function toJSONValue(m: Model, p: IConcertinoProperty, val: unknown, offset: number): unknown {
    if (Array.isArray(val)) {
        return val.map((x) => toJSONValue(m, { ...p, isArray: false } as IConcertinoProperty, x, offset));
    }
    if (val instanceof Rel) {
        return `resource:${val.fqn}#${encodeURI(val.id)}`;
    }
    if (val instanceof DT) {
        return formatDateTime(val, offset);
    }
    if (val instanceof Res) {
        return toJSONResource(m, val, offset);
    }
    if (val instanceof JMap) {
        const o: Record<string, unknown> = {};
        for (const [k, x] of val.entries) {
            if (typeof k === 'string' && SYSTEM_PROPS.has(k)) {
                continue;
            }
            o[String(k)] = x instanceof Res ? toJSONResource(m, x, offset) : x instanceof Rel ? `resource:${x.fqn}#${encodeURI(x.id)}` : x;
        }
        return o;
    }
    return val;
}

// ---- entry points ----------------------------------------------------------------------

function ctxOf(m: Model, o: Options = {}): Ctx {
    const rnd = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));
    return {
        m,
        path: '$',
        o: {
            validate: o.validate !== false,
            utcOffset: offsetMinutes(o.utcOffset),
            strictQualifiedDateTimes: o.strictQualifiedDateTimes === true,
            acceptResourcesForRelationships: !!o.acceptResourcesForRelationships,
            newId: o.newId || rnd,
            now: o.now || Date.now,
        },
    };
}

/**
 * Populate and validate `json` (Serializer.fromJSON with R1 semantics).
 * @returns the populated instance (opaque; pass it to toJSON)
 * @throws InstanceError
 */
export function validate(m: Model, json: unknown, options: Options = {}): Res {
    const c = ctxOf(m, options);
    const cls = readProp(json, '$class');
    if (!cls) {
        throw pErr('serializer-fromjson-noclass', 'Invalid JSON data. Does not contain a $class type identifier.');
    }
    if (typeof cls !== 'string') {
        throw pErr('class-not-string', `a $class that is not a string: ${String(cls)}`);
    }
    getTypeOrThrow(m, cls);
    const kind = kindOf(m, cls);
    if (kind === 'MapDeclaration') {
        throw pErr('serializer-fromjson-mapnotsupported', 'Attempting to create a Map declaration is not supported.');
    }
    if (kind === 'EnumDeclaration') {
        throw pErr('serializer-fromjson-enumnotsupported', 'Attempting to create an ENUM declaration is not supported.');
    }
    if (kind === 'ScalarDeclaration') {
        throw pErr('unrecognised', `Unrecognised element "${cls}"`);
    }
    const idField = getIdentifierFieldName(m, cls);
    const r = newResource(c, cls, idField ? readProp(json, idField) : readProp(json, 'null'));
    visitClass(c, cls, json, r);
    if (c.o.validate) {
        validateResource({ m, rootId: fqi(cls, r.props[r.idKey]) }, cls, r);
    }
    return r;
}

/** Serializer.toJSON of a populated instance. */
export function toJSON(m: Model, r: Res, options: Pick<Options, 'utcOffset'> = {}): Record<string, unknown> {
    return toJSONResource(m, r, offsetMinutes(options.utcOffset));
}

/** validate, then toJSON: the plain JSON the Serializer round trip gives. */
export function normalise(m: Model, json: unknown, options: Options = {}): Record<string, unknown> {
    return toJSON(m, validate(m, json, options), options);
}

/** validate without throwing. */
export function check(m: Model, json: unknown, options: Options = {}): { ok: true } | { ok: false; error: InstanceError } {
    try {
        validate(m, json, options);
        return { ok: true };
    } catch (e) {
        if (e instanceof InstanceError) {
            return { ok: false, error: e };
        }
        throw e;
    }
}
