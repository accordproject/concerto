import { BooleanProperty, Concept, parse, Typed } from '../src';

test('it can handle required booleans', () => {
    @Typed({ namespace: 'org.example', name: 'BooleanClass' })
    class BooleanClass extends Concept {
        @BooleanProperty()
            required!: boolean;
    }
    const instance = parse(BooleanClass, { required: true });
    expect(instance).toBeInstanceOf(BooleanClass);
    expect(instance).toEqual({
        $class: BooleanClass.$class,
        required: true,
    });
    expect(() => parse(BooleanClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isBoolean: 'required must be a boolean value'
                },
            }),
        ])
    );
});

test('it can handle optional booleans', () => {
    @Typed({ namespace: 'org.example', name: 'BooleanClass' })
    class BooleanClass extends Concept {
        @BooleanProperty({ optional: true })
            optional?: boolean;
    }
    const instance = parse(BooleanClass, {});
    expect(instance).toBeInstanceOf(BooleanClass);
    expect(instance).toEqual({
        $class: BooleanClass.$class
    });
});

test('it can handle default booleans', () => {
    @Typed({ namespace: 'org.example', name: 'BooleanClass' })
    class BooleanClass extends Concept {
        @BooleanProperty()
            default = true;
    }
    const instance = parse(BooleanClass, {});
    expect(instance).toBeInstanceOf(BooleanClass);
    expect(instance).toEqual({
        $class: BooleanClass.$class,
        default: true
    });
});
