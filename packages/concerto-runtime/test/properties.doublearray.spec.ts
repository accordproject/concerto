import { Concept, DoubleArrayProperty, parse, Typed } from '../src';

test('it can handle required double arrays', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleArrayClass' })
    class DoubleArrayClass extends Concept {
        @DoubleArrayProperty()
            required!: number[];
    }
    const instance = parse(DoubleArrayClass, { required: [1.2345] });
    expect(instance).toBeInstanceOf(DoubleArrayClass);
    expect(instance).toEqual({
        $class: DoubleArrayClass.$class,
        required: [1.2345],
    });
    expect(() => parse(DoubleArrayClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isArray: 'required must be an array',
                    isNumber: 'each value in required must be a number conforming to the specified constraints'
                },
            }),
        ])
    );
    expect(() => parse(DoubleArrayClass, { required: ['hello, world'] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isNumber: 'each value in required must be a number conforming to the specified constraints'
                },
            }),
        ])
    );
});

test('it can handle optional double arrays', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleArrayClass' })
    class DoubleArrayClass extends Concept {
        @DoubleArrayProperty({ optional: true })
            optional?: number[];
    }
    const instance = parse(DoubleArrayClass, {});
    expect(instance).toBeInstanceOf(DoubleArrayClass);
    expect(instance).toEqual({
        $class: DoubleArrayClass.$class
    });
});

test('it can handle default double arrays', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleArrayClass' })
    class DoubleArrayClass extends Concept {
        @DoubleArrayProperty()
            default = [1.2345];
    }
    const instance = parse(DoubleArrayClass, {});
    expect(instance).toBeInstanceOf(DoubleArrayClass);
    expect(instance).toEqual({
        $class: DoubleArrayClass.$class,
        default: [1.2345]
    });
});

test('it can handle double arrays with a minimum', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleArrayClass' })
    class DoubleArrayClass extends Concept {
        @DoubleArrayProperty({ minimum: 0 })
            minimum!: number[];
    }
    const instance = parse(DoubleArrayClass, { minimum: [0] });
    expect(instance).toBeInstanceOf(DoubleArrayClass);
    expect(instance).toEqual({
        $class: DoubleArrayClass.$class,
        minimum: [0]
    });
    expect(() => parse(DoubleArrayClass, { minimum: [-1] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    min: 'each value in minimum must not be less than 0'
                },
            }),
        ])
    );
});

test('it can handle double arrays with a maximum', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleArrayClass' })
    class DoubleArrayClass extends Concept {
        @DoubleArrayProperty({ maximum: 0 })
            maximum!: number[];
    }
    const instance = parse(DoubleArrayClass, { maximum: [-1] });
    expect(instance).toBeInstanceOf(DoubleArrayClass);
    expect(instance).toEqual({
        $class: DoubleArrayClass.$class,
        maximum: [-1]
    });
    expect(() => parse(DoubleArrayClass, { maximum: [1] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    max: 'each value in maximum must not be greater than 0'
                },
            }),
        ])
    );
});
