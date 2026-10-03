/*
 * P5-78 spike (accordproject/concerto-rust#420). Not shipped.
 *
 * The two name helpers Concertino's metamodel serializer took from
 * concerto-core's ModelUtil, inlined so the converter has no runtime
 * dependency on concerto-core (and so on the engine). Same results as
 * ModelUtil.getShortName / ModelUtil.getNamespace for fully qualified names
 * of the form `ns@version.Type` (the only form Concertino stores).
 */

/**
 * The short name of a fully qualified type name (`a.b@1.0.0.Foo` -> `Foo`).
 * A name without a dot is returned unchanged, as ModelUtil does.
 * @param fqn fully qualified name
 * @returns the short name
 */
export function getShortName(fqn: string): string {
    const i = fqn.lastIndexOf('.');
    return i < 0 ? fqn : fqn.substring(i + 1);
}

/**
 * The namespace of a fully qualified type name (`a.b@1.0.0.Foo` -> `a.b@1.0.0`).
 * ModelUtil throws for an empty name; a name without a dot has the empty namespace.
 * @param fqn fully qualified name
 * @returns the namespace
 */
export function getNamespace(fqn: string): string {
    if (!fqn) {
        throw new Error('Fully qualified name is null or undefined.');
    }
    const i = fqn.lastIndexOf('.');
    return i < 0 ? '' : fqn.substring(0, i);
}

const VERSIONED = /^([^@]+)@(.+)$/;

/**
 * Split a namespace into its name and version (`a.b@1.0.0` -> {name: 'a.b', version: '1.0.0'}).
 * @param ns namespace
 * @returns name and version (version undefined when absent)
 */
export function parseNamespace(ns: string): { name: string; version?: string } {
    const m = VERSIONED.exec(ns);
    return m ? { name: m[1], version: m[2] } : { name: ns };
}

export const PRIMITIVES = new Set(['String', 'Boolean', 'DateTime', 'Double', 'Integer', 'Long']);
