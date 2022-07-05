import { BooleanArrayProperty, Concept, parse, Typed } from '../src';

test('it can handle required boolean arrays', () => {
    @Typed({ namespace: 'org.example', name: 'BooleanArrayClass' })
    class BooleanArrayClass extends Concept {
        @BooleanArrayProperty()
            required!: number[];
    }
    const instance = parse(BooleanArrayClass, { required: [true] });
    expect(instance).toBeInstanceOf(BooleanArrayClass);
    expect(instance).toEqual({
        $class: BooleanArrayClass.$class,
        required: [true],
    });
    expect(() => parse(BooleanArrayClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isArray: 'required must be an array',
                    isBoolean: 'each value in required must be a boolean value'
                },
            }),
        ])
    );
    expect(() => parse(BooleanArrayClass, { required: ['hello, world'] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isBoolean: 'each value in required must be a boolean value'
                },
            }),
        ])
    );
});

test('it can handle optional boolean arrays', () => {
    @Typed({ namespace: 'org.example', name: 'BooleanArrayClass' })
    class BooleanArrayClass extends Concept {
        @BooleanArrayProperty({ optional: true })
            optional?: number[];
    }
    const instance = parse(BooleanArrayClass, {});
    expect(instance).toBeInstanceOf(BooleanArrayClass);
    expect(instance).toEqual({
        $class: BooleanArrayClass.$class
    });
});

test('it can handle default boolean arrays', () => {
    @Typed({ namespace: 'org.example', name: 'BooleanArrayClass' })
    class BooleanArrayClass extends Concept {
        @BooleanArrayProperty()
            default = [true];
    }
    const instance = parse(BooleanArrayClass, {});
    expect(instance).toBeInstanceOf(BooleanArrayClass);
    expect(instance).toEqual({
        $class: BooleanArrayClass.$class,
        default: [true]
    });
});
