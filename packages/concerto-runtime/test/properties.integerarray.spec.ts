import { Concept, IntegerArrayProperty, parse, Typed } from '../src';

test('it can handle required integer arrays', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerArrayClass' })
    class IntegerArrayClass extends Concept {
        @IntegerArrayProperty()
            required!: number[];
    }
    const instance = parse(IntegerArrayClass, { required: [12345] });
    expect(instance).toBeInstanceOf(IntegerArrayClass);
    expect(instance).toEqual({
        $class: IntegerArrayClass.$class,
        required: [12345],
    });
    expect(() => parse(IntegerArrayClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isArray: 'required must be an array',
                    isInt: 'each value in required must be an integer number'
                },
            }),
        ])
    );
    expect(() => parse(IntegerArrayClass, { required: ['hello, world'] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isInt: 'each value in required must be an integer number'
                },
            }),
        ])
    );
});

test('it can handle optional integer arrays', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerArrayClass' })
    class IntegerArrayClass extends Concept {
        @IntegerArrayProperty({ optional: true })
            optional?: number[];
    }
    const instance = parse(IntegerArrayClass, {});
    expect(instance).toBeInstanceOf(IntegerArrayClass);
    expect(instance).toEqual({
        $class: IntegerArrayClass.$class
    });
});

test('it can handle default integer arrays', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerArrayClass' })
    class IntegerArrayClass extends Concept {
        @IntegerArrayProperty()
            default = [12345];
    }
    const instance = parse(IntegerArrayClass, {});
    expect(instance).toBeInstanceOf(IntegerArrayClass);
    expect(instance).toEqual({
        $class: IntegerArrayClass.$class,
        default: [12345]
    });
});

test('it can handle integer arrays with a minimum', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerArrayClass' })
    class IntegerArrayClass extends Concept {
        @IntegerArrayProperty({ minimum: 0 })
            minimum!: number[];
    }
    const instance = parse(IntegerArrayClass, { minimum: [0] });
    expect(instance).toBeInstanceOf(IntegerArrayClass);
    expect(instance).toEqual({
        $class: IntegerArrayClass.$class,
        minimum: [0]
    });
    expect(() => parse(IntegerArrayClass, { minimum: [-1] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    min: 'each value in minimum must not be less than 0'
                },
            }),
        ])
    );
});

test('it can handle integer arrays with a maximum', () => {
    @Typed({ namespace: 'org.example', name: 'IntegerArrayClass' })
    class IntegerArrayClass extends Concept {
        @IntegerArrayProperty({ maximum: 0 })
            maximum!: number[];
    }
    const instance = parse(IntegerArrayClass, { maximum: [-1] });
    expect(instance).toBeInstanceOf(IntegerArrayClass);
    expect(instance).toEqual({
        $class: IntegerArrayClass.$class,
        maximum: [-1]
    });
    expect(() => parse(IntegerArrayClass, { maximum: [1] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    max: 'each value in maximum must not be greater than 0'
                },
            }),
        ])
    );
});
