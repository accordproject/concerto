import { Concept, LongProperty, parse, Typed } from '../src';

test('it can handle required longs', () => {
    @Typed({ namespace: 'org.example', name: 'LongClass' })
    class LongClass extends Concept {
        @LongProperty()
            required!: number;
    }
    const instance = parse(LongClass, { required: 12345 });
    expect(instance).toBeInstanceOf(LongClass);
    expect(instance).toEqual({
        $class: LongClass.$class,
        required: 12345,
    });
    expect(() => parse(LongClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isInt: 'required must be an integer number'
                },
            }),
        ])
    );
});

test('it can handle optional longs', () => {
    @Typed({ namespace: 'org.example', name: 'LongClass' })
    class LongClass extends Concept {
        @LongProperty({ optional: true })
            optional?: number;
    }
    const instance = parse(LongClass, {});
    expect(instance).toBeInstanceOf(LongClass);
    expect(instance).toEqual({
        $class: LongClass.$class
    });
});

test('it can handle default longs', () => {
    @Typed({ namespace: 'org.example', name: 'LongClass' })
    class LongClass extends Concept {
        @LongProperty()
            default = 12345;
    }
    const instance = parse(LongClass, {});
    expect(instance).toBeInstanceOf(LongClass);
    expect(instance).toEqual({
        $class: LongClass.$class,
        default: 12345
    });
});

test('it can handle longs with a minimum', () => {
    @Typed({ namespace: 'org.example', name: 'LongClass' })
    class LongClass extends Concept {
        @LongProperty({ minimum: 0 })
            minimum!: number;
    }
    const instance = parse(LongClass, { minimum: 0 });
    expect(instance).toBeInstanceOf(LongClass);
    expect(instance).toEqual({
        $class: LongClass.$class,
        minimum: 0
    });
    expect(() => parse(LongClass, { minimum: -1 })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    min: 'minimum must not be less than 0'
                },
            }),
        ])
    );
});

test('it can handle longs with a maximum', () => {
    @Typed({ namespace: 'org.example', name: 'LongClass' })
    class LongClass extends Concept {
        @LongProperty({ maximum: 0 })
            maximum!: number;
    }
    const instance = parse(LongClass, { maximum: -1 });
    expect(instance).toBeInstanceOf(LongClass);
    expect(instance).toEqual({
        $class: LongClass.$class,
        maximum: -1
    });
    expect(() => parse(LongClass, { maximum: 1 })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    max: 'maximum must not be greater than 0'
                },
            }),
        ])
    );
});
