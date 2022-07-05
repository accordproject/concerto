import { Concept, EnumProperty, parse, Typed } from '../src';

enum Enum {
    HELLO = 'HELLO',
    WORLD = 'WORLD'
}

test('it can handle required enums', () => {
    @Typed({ namespace: 'org.example', name: 'EnumClass' })
    class EnumClass extends Concept {
        @EnumProperty({ type: Enum })
            required!: Enum;
    }
    const instance = parse(EnumClass, { required: 'WORLD' });
    expect(instance).toBeInstanceOf(EnumClass);
    expect(instance).toEqual({
        $class: EnumClass.$class,
        required: Enum.WORLD
    });
    expect(() => parse(EnumClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isEnum: 'required must be a valid enum value'
                },
            }),
        ])
    );
    expect(() => parse(EnumClass, { required: 'NO' })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isEnum: 'required must be a valid enum value'
                },
            }),
        ])
    );
});

test('it can handle optional enums', () => {
    @Typed({ namespace: 'org.example', name: 'EnumClass' })
    class EnumClass extends Concept {
        @EnumProperty({ optional: true, type: Enum })
            optional?: Enum;
    }
    const instance = parse(EnumClass, {});
    expect(instance).toBeInstanceOf(EnumClass);
    expect(instance).toEqual({
        $class: EnumClass.$class,
    });
});

test('it can handle default enums', () => {
    @Typed({ namespace: 'org.example', name: 'EnumClass' })
    class EnumClass extends Concept {
        @EnumProperty({ optional: true, type: Enum })
            default = Enum.WORLD;
    }
    const instance = parse(EnumClass, {});
    expect(instance).toBeInstanceOf(EnumClass);
    expect(instance).toEqual({
        $class: EnumClass.$class,
        default: Enum.WORLD
    });
});
