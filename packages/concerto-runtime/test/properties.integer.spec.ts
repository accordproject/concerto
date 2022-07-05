import { Concept, IntegerProperty, parse, Typed } from '../src';

test('it can handle required integers', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerClass' })
    class IntegerClass extends Concept {
        @IntegerProperty()
            required!: number;
    }
    const instance = parse(IntegerClass, { required: 12345 });
    expect(instance).toBeInstanceOf(IntegerClass);
    expect(instance).toEqual({
        $class: IntegerClass.$class,
        required: 12345,
    });
    expect(() => parse(IntegerClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isInt: 'required must be an integer number'
                },
            }),
        ])
    );
});

test('it can handle optional integers', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerClass' })
    class IntegerClass extends Concept {
        @IntegerProperty({ optional: true })
            optional?: number;
    }
    const instance = parse(IntegerClass, {});
    expect(instance).toBeInstanceOf(IntegerClass);
    expect(instance).toEqual({
        $class: IntegerClass.$class
    });
});

test('it can handle default integers', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerClass' })
    class IntegerClass extends Concept {
        @IntegerProperty()
            default = 12345;
    }
    const instance = parse(IntegerClass, {});
    expect(instance).toBeInstanceOf(IntegerClass);
    expect(instance).toEqual({
        $class: IntegerClass.$class,
        default: 12345
    });
});

test('it can handle integers with a minimum', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerClass' })
    class IntegerClass extends Concept {
        @IntegerProperty({ minimum: 0 })
            minimum!: number;
    }
    const instance = parse(IntegerClass, { minimum: 0 });
    expect(instance).toBeInstanceOf(IntegerClass);
    expect(instance).toEqual({
        $class: IntegerClass.$class,
        minimum: 0
    });
    expect(() => parse(IntegerClass, { minimum: -1 })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    min: 'minimum must not be less than 0'
                },
            }),
        ])
    );
});

test('it can handle integers with a maximum', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerClass' })
    class IntegerClass extends Concept {
        @IntegerProperty({ maximum: 0 })
            maximum!: number;
    }
    const instance = parse(IntegerClass, { maximum: -1 });
    expect(instance).toBeInstanceOf(IntegerClass);
    expect(instance).toEqual({
        $class: IntegerClass.$class,
        maximum: -1
    });
    expect(() => parse(IntegerClass, { maximum: 1 })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    max: 'maximum must not be greater than 0'
                },
            }),
        ])
    );
});
