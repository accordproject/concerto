import { Concept, DateTimeProperty, parse, Typed } from '../src';

test('it can handle required date times', () => {
    @Typed({ namespace: 'org.example', name: 'DateTimeClass' })
    class DateTimeClass extends Concept {
        @DateTimeProperty()
            required!: Date;
    }
    const instance = parse(DateTimeClass, { required: '2022-07-04T10:38:46.481Z' });
    expect(instance).toBeInstanceOf(DateTimeClass);
    expect(instance).toEqual({
        $class: DateTimeClass.$class,
        required: new Date('2022-07-04T10:38:46.481Z')
    });
    expect(() => parse(DateTimeClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isDate: 'required must be a Date instance'
                },
            }),
        ])
    );
});

test('it can handle optional date times', () => {
    @Typed({ namespace: 'org.example', name: 'DateTimeClass' })
    class DateTimeClass extends Concept {
        @DateTimeProperty({ optional: true })
            optional?: string;
    }
    const instance = parse(DateTimeClass, {});
    expect(instance).toBeInstanceOf(DateTimeClass);
    expect(instance).toEqual({
        $class: DateTimeClass.$class
    });
});

test('it can handle default date times', () => {
    @Typed({ namespace: 'org.example', name: 'DateTimeClass' })
    class DateTimeClass extends Concept {
        @DateTimeProperty()
            default = new Date(0);
    }
    const instance = parse(DateTimeClass, {});
    expect(instance).toBeInstanceOf(DateTimeClass);
    expect(instance).toEqual({
        $class: DateTimeClass.$class,
        default: new Date(0)
    });
});
