import { Concept, LongArrayProperty, parse, Typed } from '../src';

test('it can handle required long arrays', () => {
    @Typed({ namespace: 'org.example', name: 'LongArrayClass' })
    class LongArrayClass extends Concept {
        @LongArrayProperty()
            required!: number[];
    }
    const instance = parse(LongArrayClass, { required: [12345] });
    expect(instance).toBeInstanceOf(LongArrayClass);
    expect(instance).toEqual({
        $class: LongArrayClass.$class,
        required: [12345],
    });
    expect(() => parse(LongArrayClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isArray: 'required must be an array',
                    isInt: 'each value in required must be an integer number'
                },
            }),
        ])
    );
    expect(() => parse(LongArrayClass, { required: ['hello, world'] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isInt: 'each value in required must be an integer number'
                },
            }),
        ])
    );
});

test('it can handle optional long arrays', () => {
    @Typed({ namespace: 'org.example', name: 'LongArrayClass' })
    class LongArrayClass extends Concept {
        @LongArrayProperty({ optional: true })
            optional?: number[];
    }
    const instance = parse(LongArrayClass, {});
    expect(instance).toBeInstanceOf(LongArrayClass);
    expect(instance).toEqual({
        $class: LongArrayClass.$class
    });
});

test('it can handle default long arrays', () => {
    @Typed({ namespace: 'org.example', name: 'LongArrayClass' })
    class LongArrayClass extends Concept {
        @LongArrayProperty()
            default = [12345];
    }
    const instance = parse(LongArrayClass, {});
    expect(instance).toBeInstanceOf(LongArrayClass);
    expect(instance).toEqual({
        $class: LongArrayClass.$class,
        default: [12345]
    });
});

test('it can handle long arrays with a minimum', () => {
    @Typed({ namespace: 'org.example', name: 'LongArrayClass' })
    class LongArrayClass extends Concept {
        @LongArrayProperty({ minimum: 0 })
            minimum!: number[];
    }
    const instance = parse(LongArrayClass, { minimum: [0] });
    expect(instance).toBeInstanceOf(LongArrayClass);
    expect(instance).toEqual({
        $class: LongArrayClass.$class,
        minimum: [0]
    });
    expect(() => parse(LongArrayClass, { minimum: [-1] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    min: 'each value in minimum must not be less than 0'
                },
            }),
        ])
    );
});

test('it can handle long arrays with a maximum', () => {
    @Typed({ namespace: 'org.example', name: 'LongArrayClass' })
    class LongArrayClass extends Concept {
        @LongArrayProperty({ maximum: 0 })
            maximum!: number[];
    }
    const instance = parse(LongArrayClass, { maximum: [-1] });
    expect(instance).toBeInstanceOf(LongArrayClass);
    expect(instance).toEqual({
        $class: LongArrayClass.$class,
        maximum: [-1]
    });
    expect(() => parse(LongArrayClass, { maximum: [1] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    max: 'each value in maximum must not be greater than 0'
                },
            }),
        ])
    );
});
