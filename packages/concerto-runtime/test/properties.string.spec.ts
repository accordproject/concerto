import { Concept, parse, StringProperty, Typed } from '../src';

test('it can handle required strings', () => {
    @Typed({ namespace: 'com.example', name: 'StringClass' })
    class StringClass extends Concept {
        @StringProperty()
            required!: string;
    }
    const instance = parse(StringClass, { required: 'hello, world' });
    expect(instance).toBeInstanceOf(StringClass);
    expect(instance).toEqual({
        $class: StringClass.$class,
        required: 'hello, world',
    });
    expect(() => parse(StringClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isString: 'required must be a string'
                },
            }),
        ])
    );
});

test('it can handle optional strings', () => {
    @Typed({ namespace: 'com.example', name: 'StringClass' })
    class StringClass extends Concept {
        @StringProperty({ optional: true })
            optional?: string;
    }
    const instance = parse(StringClass, {});
    expect(instance).toBeInstanceOf(StringClass);
    expect(instance).toEqual({
        $class: StringClass.$class
    });
});

test('it can handle default strings', () => {
    @Typed({ namespace: 'com.example', name: 'StringClass' })
    class StringClass extends Concept {
        @StringProperty()
            default = 'defaulted';
    }
    const instance = parse(StringClass, {});
    expect(instance).toBeInstanceOf(StringClass);
    expect(instance).toEqual({
        $class: StringClass.$class,
        default: 'defaulted'
    });
});

test('it can handle strings validated by a regex', () => {
    @Typed({ namespace: 'com.example', name: 'StringClass' })
    class StringClass extends Concept {
        @StringProperty({ regex: /^foo$/ })
            regex!: string;
    }
    const instance = parse(StringClass, { regex: 'foo' });
    expect(instance).toBeInstanceOf(StringClass);
    expect(instance).toEqual({
        $class: StringClass.$class,
        regex: 'foo'
    });
    expect(() => parse(StringClass, { regex: 'bar' })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    matches: expect.stringMatching('regex must match')
                },
            }),
        ])
    );
});
