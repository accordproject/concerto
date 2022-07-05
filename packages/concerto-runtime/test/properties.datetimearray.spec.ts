import { Concept, DateTimeArrayProperty, parse, Typed } from '../src';

test('it can handle required date time arrays', () => {
    @Typed({ namespace: 'org.example', name: 'DateTimeArrayClass' })
    class DateTimeArrayClass extends Concept {
        @DateTimeArrayProperty()
            required!: Date[];
    }
    const instance = parse(DateTimeArrayClass, { required: ['2022-07-04T10:38:46.481Z'] });
    expect(instance).toBeInstanceOf(DateTimeArrayClass);
    expect(instance).toEqual({
        $class: DateTimeArrayClass.$class,
        required: [new Date('2022-07-04T10:38:46.481Z')],
    });
    expect(() => parse(DateTimeArrayClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isArray: 'required must be an array',
                    isDate: 'each value in required must be a Date instance'
                },
            }),
        ])
    );
    expect(() => parse(DateTimeArrayClass, { required: ['hello, world'] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isDate: 'each value in required must be a Date instance'
                },
            }),
        ])
    );
});

test('it can handle optional date time arrays', () => {
    @Typed({ namespace: 'org.example', name: 'DateTimeArrayClass' })
    class DateTimeArrayClass extends Concept {
        @DateTimeArrayProperty({ optional: true })
            optional?: Date[];
    }
    const instance = parse(DateTimeArrayClass, {});
    expect(instance).toBeInstanceOf(DateTimeArrayClass);
    expect(instance).toEqual({
        $class: DateTimeArrayClass.$class
    });
});

test('it can handle default date time arrays', () => {
    @Typed({ namespace: 'org.example', name: 'DateTimeArrayClass' })
    class DateTimeArrayClass extends Concept {
        @DateTimeArrayProperty()
            default = [new Date(0)];
    }
    const instance = parse(DateTimeArrayClass, {});
    expect(instance).toBeInstanceOf(DateTimeArrayClass);
    expect(instance).toEqual({
        $class: DateTimeArrayClass.$class,
        default: [new Date(0)]
    });
});
