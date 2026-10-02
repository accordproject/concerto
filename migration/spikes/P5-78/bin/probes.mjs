// P5-78 spike (accordproject/concerto-rust#420): feature probes shared by
// bin/roundtrip.mjs (models) and bin/conformance.mjs (instances).
// Feature probes the corpora above do not exercise: aliased imports, scalar
// defaults that are falsy, one-sided ranges, map keys and values of every
// kind, relationship maps, enum value decorators, model-level decorators.
export const PROBES = [
    [`namespace probe.base@1.0.0
abstract concept Thing identified { o String label optional }
concept Point { o Double x o Double y }
enum Colour { o RED o GREEN }
participant Person identified by email { o String email }`,
    `@ModelLevel("m")
namespace probe.main@1.0.0
import probe.base@1.0.0.{Thing as BaseThing, Point, Colour, Person}
scalar Zero extends Integer default=0 range=[0,]
scalar Off extends Boolean default=false
scalar Empty extends String default=""
scalar Code extends String regex=/^[A-Z]{3}$/u length=[3,3]
scalar When extends DateTime
map ByCode { o Code o Point }
map ByWhen { o When o Colour }
map People { o String --> Person }
map Flags { o String o Boolean }
enum Size { @Term("Small") o S @Ignore o M o L }
@Term("A widget") @Term_description("Widgets") @Other(1, true, "x", Point, Point[])
asset Widget extends BaseThing {
  o Zero count
  o Off enabled
  o Empty note
  o Code code optional
  o When at optional
  o ByCode points optional
  o ByWhen colours optional
  o People owners optional
  o Flags flags optional
  o Size size
  o Colour[] palette size=[1,] optional
  o Double ratio range=[,1.0] optional
  o Long big range=[-5,] optional
  --> Person maker optional
  --> Person[] fans optional
}
event Ping { o String why optional }`],
];


// Instances of the probe models: each is checked against R1 (outcome and
// exception class) by bin/conformance.mjs.
const W = { $class: 'probe.main@1.0.0.Widget', $identifier: 'w1', size: 'S' };
export const PROBE_INSTANCES = [
    W,
    { ...W, code: 'ABC', at: '2020-01-01T00:00:00Z', points: { ABC: { x: 1, y: 2 } }, colours: { '2020-01-01T00:00:00Z': 'RED' }, owners: { a: 'p@x' },
        flags: { a: true }, palette: ['RED'], ratio: 0.5, big: 3, maker: 'p@x', fans: ['a@b'] },
    { ...W, code: 'abc' },
    { ...W, code: 'ABCD' },
    { ...W, palette: [] },
    { ...W, ratio: 2 },
    { ...W, big: -6 },
    { ...W, big: 1.5 },
    { ...W, count: 2147483648 },
    { ...W, at: '2020-02-30T00:00:00Z' },
    { ...W, at: '2020-01-01T00:00:00' },
    { ...W, colours: { '2020-01-01': 'RED' } },
    { ...W, colours: { '2020-01-01T00:00:00Z': 'BLUE' } },
    { ...W, points: { abc: { x: 1, y: 2 } } },
    { ...W, points: { ABC: { x: '1', y: 2 } } },
    { ...W, owners: { a: { $class: 'probe.base@1.0.0.Person', email: 'q' } } },
    { ...W, flags: { a: 'yes' } },
    { ...W, maker: 'resource:probe.base@1.0.0.Person#p@x' },
    { ...W, maker: 'resource:probe.main@1.0.0.Widget#w2' },
    { ...W, maker: 5 },
    { ...W, size: 'XL' },
    { ...W, $identifier: '' },
    { ...W, $identifier: 5 },
    { ...W, extra: 1 },
    { ...W, $timestamp: '2020-01-01T00:00:00Z' },
    { $class: 'probe.base@1.0.0.Thing', $identifier: 't' },
    { $class: 'probe.base@1.0.0.Colour' },
    { $class: 'probe.main@1.0.0.Ping' },
    { $class: 'probe.main@1.0.0.Ping', why: 3 },
    { $class: 'probe.base@1.0.0.Person', email: 'a@b' },
    { $class: 'probe.base@1.0.0.Person' },
    { $class: 'probe.base@1.0.0.Point', x: 1 },
    { $class: 'probe.base@1.0.0.Point', x: 1, y: Number.MAX_VALUE },
    { $class: 'probe.nope@1.0.0.Point' },
    { $class: 5 },
    {},
];
