import { findType, getSuperType, getSuperTypes, getType, isTyped, Typed } from '../src';

@Typed({namespace: 'com.example', name: 'TypedClass'})
class TypedClass {

}

class UntypedClass {

}


@Typed({namespace: 'com.example', name: 'ExtendedTypedClass'})
class ExtendedTypedClass extends TypedClass {

}


@Typed({namespace: 'com.example', name: 'ExtendedMoreTypedClass'})
class ExtendedMoreTypedClass extends ExtendedTypedClass {

}

test('it can handle a typed class', () => {
    expect(isTyped(TypedClass)).toBe(true);
    expect(getType(TypedClass)).toEqual({
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    });
});

test('it can handle an untyped class', () => {
    expect(isTyped(UntypedClass)).toBe(false);
    expect(() => getType(UntypedClass)).toThrowError(/target is not typed/);
});

test('it can handle a typed instance', () => {
    const instance = new TypedClass();
    expect(isTyped(instance)).toBe(true);
    expect(getType(instance)).toEqual({
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    });
});

test('it can handle an untyped instance', () => {
    const instance = new UntypedClass();
    expect(isTyped(instance)).toBe(false);
    expect(() => getType(instance)).toThrowError(/target is not typed/);
});

test('it can handle getting the super type of a base class', () => {
    expect(getSuperType(TypedClass)).toBeUndefined();
});

test('it can handle getting the super type of a base instance', () => {
    const instance = new TypedClass();
    expect(getSuperType(instance)).toBeUndefined();
});

test('it can handle getting the super type of a class', () => {
    expect(getSuperType(ExtendedTypedClass)).toEqual({
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    });
});

test('it can handle getting the super type of an instance', () => {
    const instance = new ExtendedTypedClass();
    expect(getSuperType(instance)).toEqual({
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    });
});

test('it can handle getting the super types of a base class', () => {
    expect(getSuperTypes(TypedClass)).toEqual([]);
});

test('it can handle getting the super types of a base instance', () => {
    const instance = new TypedClass();
    expect(getSuperTypes(instance)).toEqual([]);
});

test('it can handle getting the super types of a class', () => {
    expect(getSuperTypes(ExtendedTypedClass)).toEqual([{
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    }]);
});

test('it can handle getting the super types of an instance', () => {
    const instance = new ExtendedTypedClass();
    expect(getSuperTypes(instance)).toEqual([{
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    }]);
});

test('it can handle getting the super types of a extended class', () => {
    expect(getSuperTypes(ExtendedMoreTypedClass)).toEqual([{
        constructor: ExtendedTypedClass,
        namespace: 'com.example',
        name: 'ExtendedTypedClass'
    }, {
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    }]);
});

test('it can handle getting the super types of an extended instance', () => {
    const instance = new ExtendedMoreTypedClass();
    expect(getSuperTypes(instance)).toEqual([{
        constructor: ExtendedTypedClass,
        namespace: 'com.example',
        name: 'ExtendedTypedClass'
    }, {
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    }]);
});

test('it can find a registered type', () => {
    const type = findType('com.example', 'TypedClass');
    expect(type).toEqual({
        constructor: TypedClass,
        namespace: 'com.example',
        name: 'TypedClass'
    });
});

test('it cannot find a unregistered type', () => {
    expect(() => findType('com.example', 'UntypedClass')).toThrowError(/no registered type with namespace "com.example" and name "UntypedClass"/);
});
