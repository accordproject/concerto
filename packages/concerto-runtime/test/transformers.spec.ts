import { IsString } from 'class-validator';
import { Concept, parse, serialize, Typed, validate } from '../src';

interface TestClassData {
    $class: string;
    value: string;
}

@Typed({ namespace: 'org.example', name: 'TestClass' })
class TestClass extends Concept {
    $class = 'org.example.TestClass';

    constructor(data?: Partial<TestClass>) {
        super();
        Object.assign(this, data);
    }

    @IsString()
        value!: string;
}

@Typed({ namespace: 'org.example', name: 'ExtendedTestClass' })
class ExtendedTestClass extends TestClass {
    $class = 'org.example.ExtendedTestClass';
}

test('it can parse data into an instance with specified constructor', () => {
    const data: TestClassData = {
        $class: 'org.example.TestClass',
        value: 'hello, world',
    };
    const instance = parse(TestClass, data);
    expect(instance).toBeInstanceOf(TestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can parse data into an instance without specifying constructor', () => {
    const data: TestClassData = {
        $class: 'org.example.TestClass',
        value: 'hello, world',
    };
    const instance = parse<TestClass>(data);
    expect(instance).toBeInstanceOf(TestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can parse data into an instance of a super type without specifying constructor', () => {
    const data: TestClassData = {
        $class: 'org.example.ExtendedTestClass',
        value: 'hello, world',
    };
    const instance = parse<TestClass>(data);
    expect(instance).toBeInstanceOf(ExtendedTestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can parse string data into an instance with specified constructor', () => {
    const data = JSON.stringify({
        $class: 'org.example.TestClass',
        value: 'hello, world',
    });
    const instance = parse(TestClass, data);
    expect(instance).toBeInstanceOf(TestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can parse string data into an instance without specifying constructor', () => {
    const data = JSON.stringify({
        $class: 'org.example.TestClass',
        value: 'hello, world',
    });
    const instance = parse<TestClass>(data);
    expect(instance).toBeInstanceOf(TestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can parse string data into an instance of a super type without specifying constructor', () => {
    const data = JSON.stringify({
        $class: 'org.example.ExtendedTestClass',
        value: 'hello, world',
    });
    const instance = parse<TestClass>(data);
    expect(instance).toBeInstanceOf(ExtendedTestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can parse buffer data into an instance with specified constructor', () => {
    const data = Buffer.from(JSON.stringify({
        $class: 'org.example.TestClass',
        value: 'hello, world',
    }), 'utf-8');
    const instance = parse(TestClass, data);
    expect(instance).toBeInstanceOf(TestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can parse buffer data into an instance without specifying constructor', () => {
    const data = Buffer.from(JSON.stringify({
        $class: 'org.example.TestClass',
        value: 'hello, world',
    }), 'utf-8');
    const instance = parse<TestClass>(data);
    expect(instance).toBeInstanceOf(TestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can parse buffer data into an instance of a super type without specifying constructor', () => {
    const data = Buffer.from(JSON.stringify({
        $class: 'org.example.ExtendedTestClass',
        value: 'hello, world',
    }), 'utf-8');
    const instance = parse<TestClass>(data);
    expect(instance).toBeInstanceOf(ExtendedTestClass);
    expect(instance.value).toBe('hello, world');
});

test('it can serialize an instance into data', () => {
    const instance = new TestClass({ value: 'hello, world' });
    const data: TestClassData = serialize(instance);
    expect(data.value).toBe('hello, world');
});

test('it can validate data during parsing', () => {
    const data: Partial<TestClassData> = {};
    expect(() => parse(TestClass, data)).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isString: 'value must be a string',
                },
            }),
        ])
    );
});

test('it can validate an instance', () => {
    const instance = new TestClass();
    expect(() => validate(instance)).toThrow(
        expect.arrayContaining([
            expect.objectContaining({
                constraints: {
                    isString: 'value must be a string',
                },
            }),
        ])
    );
});
