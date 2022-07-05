import { Concept, parse, StringArrayProperty, Typed } from '../src';

test('it can handle required string arrays', () => {
    @Typed({ namespace: 'org.example', name: 'StringArrayClass' })
    class StringArrayClass extends Concept {
        @StringArrayProperty()
            required!: string[];
    }
    const instance = parse(StringArrayClass, { required: ['hello, world'] });
    expect(instance).toBeInstanceOf(StringArrayClass);
    expect(instance).toEqual({
        $class: StringArrayClass.$class,
        required: ['hello, world'],
    });
    expect(() => parse(StringArrayClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isArray: 'required must be an array',
                    isString: 'each value in required must be a string'
                },
            }),
        ])
    );
    expect(() => parse(StringArrayClass, { required: [1.2345] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isString: 'each value in required must be a string'
                },
            }),
        ])
    );
});

test('it can handle optional string arrays', () => {
    @Typed({ namespace: 'org.example', name: 'StringArrayClass' })
    class StringArrayClass extends Concept {
        @StringArrayProperty({ optional: true })
            optional?: string[];
    }
    const instance = parse(StringArrayClass, {});
    expect(instance).toBeInstanceOf(StringArrayClass);
    expect(instance).toEqual({
        $class: StringArrayClass.$class
    });
});

test('it can handle default string arrays', () => {
    @Typed({ namespace: 'org.example', name: 'StringArrayClass' })
    class StringArrayClass extends Concept {
        @StringArrayProperty()
            default = ['defaulted'];
    }
    const instance = parse(StringArrayClass, {});
    expect(instance).toBeInstanceOf(StringArrayClass);
    expect(instance).toEqual({
        $class: StringArrayClass.$class,
        default: ['defaulted']
    });
});

test('it can handle string arrays validated by a regex', () => {
    @Typed({ namespace: 'org.example', name: 'StringArrayClass' })
    class StringArrayClass extends Concept {
        @StringArrayProperty({ regex: /^foo$/ })
            regex!: string[];
    }
    const instance = parse(StringArrayClass, { regex: ['foo'] });
    expect(instance).toBeInstanceOf(StringArrayClass);
    expect(instance).toEqual({
        $class: StringArrayClass.$class,
        regex: ['foo']
    });
    expect(() => parse(StringArrayClass, { regex: ['bar'] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    matches: expect.stringMatching('regex must match')
                },
            }),
        ])
    );
});
