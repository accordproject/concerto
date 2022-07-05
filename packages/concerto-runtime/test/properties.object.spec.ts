import { Concept, ConceptProperty, parse, StringProperty, Typed } from '../src';

test('it can handle required objects', () => {
    @Typed({ namespace: 'com.example', name: 'ChildClass' })
    class ChildClass extends Concept {
        @StringProperty()
            required!: string;
    }
    @Typed({ namespace: 'com.example', name: 'ParentClass' })
    class ParentClass extends Concept {
        @ConceptProperty({ type: ChildClass })
            child!: ChildClass;
    }
    const instance = parse(ParentClass, {
        child: { required: 'hello, world' },
    });
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toBeInstanceOf(ChildClass);
    expect(instance).toEqual({
        $class: ParentClass.$class,
        child: {
            $class: ChildClass.$class,
            required: 'hello, world',
        }
    });
    expect(() => parse(ParentClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isInstance: 'child must be an instance of ChildClass',
                },
            }),
        ])
    );
});

test('it can handle optional objects', () => {
    @Typed({ namespace: 'com.example', name: 'ChildClass' })
    class ChildClass extends Concept {
        @StringProperty()
            required!: string;
    }
    @Typed({ namespace: 'com.example', name: 'ParentClass' })
    class ParentClass extends Concept {
        @ConceptProperty({ optional: true, type: ChildClass })
            child?: ChildClass;
    }
    const instance = parse(ParentClass, {});
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance).toEqual({
        $class: ParentClass.$class
    });
});

test('it can handle default objects', () => {
    @Typed({ namespace: 'com.example', name: 'ChildClass' })
    class ChildClass extends Concept {
        constructor(data?: Partial<ChildClass>) {
            super();
            Object.assign(this, data);
        }

        @StringProperty()
            required!: string;
    }
    @Typed({ namespace: 'com.example', name: 'ParentClass' })
    class ParentClass extends Concept {
        @ConceptProperty({ type: ChildClass })
            child: ChildClass = new ChildClass({ required: 'defaulted' });
    }
    const instance = parse(ParentClass, {});
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toBeInstanceOf(ChildClass);
    expect(instance.child).toEqual({
        $class: ChildClass.$class,
        required: 'defaulted',
    });
});

test('it can handle extended objects without discriminators', () => {
    @Typed({ namespace: 'com.example', name: 'ChildClass' })
    class ChildClass extends Concept {
        constructor(data?: Partial<ChildClass>) {
            super();
            Object.assign(this, data);
        }

        @StringProperty()
            required!: string;
    }
    @Typed({ namespace: 'com.example', name: 'ExtendedChildClass' })
    class ExtendedChildClass extends ChildClass {

    }
    @Typed({ namespace: 'com.example', name: 'ParentClass' })
    class ParentClass extends Concept {
        @ConceptProperty({ type: ChildClass })
            child!: ChildClass;
    }
    const instance = parse(ParentClass, {
        child: {
            required: 'extended'
        }
    });
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toBeInstanceOf(ChildClass);
    expect(instance.child).toEqual({
        $class: ChildClass.$class,
        required: 'extended',
    });
});

test('it can handle extended objects with discriminators', () => {
    @Typed({ namespace: 'com.example', name: 'ChildClass' })
    class ChildClass extends Concept {
        constructor(data?: Partial<ChildClass>) {
            super();
            Object.assign(this, data);
        }

        @StringProperty()
            required!: string;
    }
    @Typed({ namespace: 'com.example', name: 'ExtendedChildClass' })
    class ExtendedChildClass extends ChildClass {

    }
    @Typed({ namespace: 'com.example', name: 'ParentClass' })
    class ParentClass extends Concept {
        @ConceptProperty({ type: ChildClass })
            child!: ChildClass;
    }
    const instance = parse(ParentClass, {
        child: {
            $class: 'com.example.ExtendedChildClass',
            required: 'extended'
        }
    });
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toBeInstanceOf(ExtendedChildClass);
    expect(instance.child).toEqual({
        $class: 'com.example.ExtendedChildClass',
        required: 'extended',
    });
});
