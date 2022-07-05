import { Concept, EnumArrayProperty, parse, Typed } from '../src';

enum Enum {
    HELLO = 'HELLO',
    WORLD = 'WORLD'
}

test('it can handle required enum arrays', () => {
    @Typed({ namespace: 'org.example', name: 'EnumArrayClass' })
    class EnumArrayClass extends Concept {
        @EnumArrayProperty({ type: Enum })
            required!: Enum[];
    }
    const instance = parse(EnumArrayClass, { required: ['WORLD'] });
    expect(instance).toBeInstanceOf(EnumArrayClass);
    expect(instance).toEqual({
        $class: EnumArrayClass.$class,
        required: [Enum.WORLD]
    });
    expect(() => parse(EnumArrayClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isArray: 'required must be an array',
                    isEnum: 'each value in required must be a valid enum value'
                },
            }),
        ])
    );
    expect(() => parse(EnumArrayClass, { required: ['NO'] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isEnum: 'each value in required must be a valid enum value'
                },
            }),
        ])
    );
});

test('it can handle optional enum arrays', () => {
    @Typed({ namespace: 'org.example', name: 'EnumArrayClass' })
    class EnumArrayClass extends Concept {
        @EnumArrayProperty({ optional: true, type: Enum })
            optional?: Enum[];
    }
    const instance = parse(EnumArrayClass, {});
    expect(instance).toBeInstanceOf(EnumArrayClass);
    expect(instance).toEqual({
        $class: EnumArrayClass.$class
    });
});

test('it can handle default enum arrays', () => {
    @Typed({ namespace: 'org.example', name: 'EnumArrayClass' })
    class EnumArrayClass extends Concept {
        @EnumArrayProperty({ optional: true, type: Enum })
            default = [Enum.WORLD];
    }
    const instance = parse(EnumArrayClass, {});
    expect(instance).toBeInstanceOf(EnumArrayClass);
    expect(instance).toEqual({
        $class: EnumArrayClass.$class,
        default: [Enum.WORLD]
    });
});
