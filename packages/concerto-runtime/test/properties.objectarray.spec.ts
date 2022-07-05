import { Concept, ConceptArrayProperty, parse, StringProperty, Typed } from '../src';

test('it can handle required object arrays', () => {
    @Typed({ namespace: 'com.example', name: 'ChildClass' })
    class ChildClass extends Concept {
        @StringProperty()
            required!: string;
    }
    @Typed({ namespace: 'com.example', name: 'ParentClass' })
    class ParentClass extends Concept {
        @ConceptArrayProperty({ type: ChildClass })
            child!: ChildClass[];
    }
    const instance = parse(ParentClass, {
        child: [{ required: 'hello, world' }],
    });
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toHaveLength(1);
    expect(instance.child[0]).toBeInstanceOf(ChildClass);
    expect(instance).toEqual({
        $class: ParentClass.$class,
        child: [
            {
                $class: ChildClass.$class,
                required: 'hello, world',
            },
        ],
    });
    expect(() => parse(ParentClass, {})).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isArray: 'child must be an array',
                    isInstance: 'each value in child must be an instance of ChildClass',
                },
            }),
        ])
    );
    expect(() => parse(ParentClass, { child: ['hello, world'] })).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isInstance: 'each value in child must be an instance of ChildClass',
                },
            }),
        ])
    );
});

test('it can handle optional object arrays', () => {
    @Typed({ namespace: 'com.example', name: 'ChildClass' })
    class ChildClass extends Concept {
        @StringProperty()
            required!: string;
    }
    @Typed({ namespace: 'com.example', name: 'ParentClass' })
    class ParentClass extends Concept {
        @ConceptArrayProperty({ optional: true, type: ChildClass })
            child?: ChildClass[];
    }
    const instance = parse(ParentClass, {});
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance).toEqual({
        $class: ParentClass.$class,
    });
});

test('it can handle default object arrays', () => {
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
        @ConceptArrayProperty({ type: ChildClass })
            child: ChildClass[] = [new ChildClass({ required: 'defaulted' })];
    }
    const instance = parse(ParentClass, {});
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toHaveLength(1);
    expect(instance.child[0]).toBeInstanceOf(ChildClass);
    expect(instance.child[0]).toEqual({
        $class: ChildClass.$class,
        required: 'defaulted',
    });
});

test('it can handle extended object arrays without discriminators', () => {
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
        @ConceptArrayProperty({ type: ChildClass })
            child!: ChildClass[];
    }
    const instance = parse(ParentClass, {
        child: [{
            required: 'extended'
        }]
    });
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toHaveLength(1);
    expect(instance.child[0]).toBeInstanceOf(ChildClass);
    expect(instance.child[0]).toEqual({
        $class: ChildClass.$class,
        required: 'extended',
    });
});

test('it can handle extended object arrays with discriminators', () => {
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
        @ConceptArrayProperty({ type: ChildClass })
            child!: ChildClass[];
    }
    const instance = parse(ParentClass, {
        child: [{
            $class: 'com.example.ExtendedChildClass',
            required: 'extended'
        }]
    });
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toHaveLength(1);
    expect(instance.child[0]).toBeInstanceOf(ExtendedChildClass);
    expect(instance.child[0]).toEqual({
        $class: 'com.example.ExtendedChildClass',
        required: 'extended',
    });
});

test('it can handle extended object arrays with mixed discriminators', () => {
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
        @ConceptArrayProperty({ type: ChildClass })
            child!: ChildClass[];
    }
    const instance = parse(ParentClass, {
        child: [{
            $class: 'com.example.ExtendedChildClass',
            required: 'extended'
        }, {
            $class: 'com.example.ChildClass',
            required: 'child'
        }]
    });
    expect(instance).toBeInstanceOf(ParentClass);
    expect(instance.child).toHaveLength(2);
    expect(instance.child[0]).toBeInstanceOf(ExtendedChildClass);
    expect(instance.child[0]).toEqual({
        $class: 'com.example.ExtendedChildClass',
        required: 'extended',
    });
    expect(instance.child[1]).toBeInstanceOf(ChildClass);
    expect(instance.child[1]).toEqual({
        $class: 'com.example.ChildClass',
        required: 'child',
    });
});
