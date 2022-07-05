import { Concept, DoubleProperty, parse, Typed } from '../src';

test('it can handle required doubles', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleClass' })
    class DoubleClass extends Concept {
        @DoubleProperty()
            required!: number;
    }
    const instance = parse(DoubleClass, { required: 1.2345 });
    expect(instance).toBeInstanceOf(DoubleClass);
    expect(instance).toEqual({
        $class: DoubleClass.$class,
        required: 1.2345,
    });
    expect(() => parse(DoubleClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isNumber: 'required must be a number conforming to the specified constraints'
                },
            }),
        ])
    );
});

test('it can handle optional doubles', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleClass' })
    class DoubleClass extends Concept {
        @DoubleProperty({ optional: true })
            optional?: number;
    }
    const instance = parse(DoubleClass, {});
    expect(instance).toBeInstanceOf(DoubleClass);
    expect(instance).toEqual({
        $class: DoubleClass.$class
    });
});

test('it can handle default doubles', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleClass' })
    class DoubleClass extends Concept {
        @DoubleProperty()
            default = 1.2345;
    }
    const instance = parse(DoubleClass, {});
    expect(instance).toBeInstanceOf(DoubleClass);
    expect(instance).toEqual({
        $class: DoubleClass.$class,
        default: 1.2345
    });
});

test('it can handle doubles with a minimum', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleClass' })
    class DoubleClass extends Concept {
        @DoubleProperty({ minimum: 0 })
            minimum!: number;
    }
    const instance = parse(DoubleClass, { minimum: 0 });
    expect(instance).toBeInstanceOf(DoubleClass);
    expect(instance).toEqual({
        $class: DoubleClass.$class,
        minimum: 0
    });
    expect(() => parse(DoubleClass, { minimum: -1 })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    min: 'minimum must not be less than 0'
                },
            }),
        ])
    );
});

test('it can handle doubles with a maximum', () => {
    @Typed({ namespace: 'org.example', name: 'DoubleClass' })
    class DoubleClass extends Concept {
        @DoubleProperty({ maximum: 0 })
            maximum!: number;
    }
    const instance = parse(DoubleClass, { maximum: -1 });
    expect(instance).toBeInstanceOf(DoubleClass);
    expect(instance).toEqual({
        $class: DoubleClass.$class,
        maximum: -1
    });
    expect(() => parse(DoubleClass, { maximum: 1 })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    max: 'maximum must not be greater than 0'
                },
            }),
        ])
    );
});
