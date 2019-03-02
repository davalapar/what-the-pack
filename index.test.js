/* eslint-disable no-console */

const MessagePack = require('./index');

const { encode, decode } = MessagePack.initialize(2 ** 30, console.log);

test('fixstr', () => {
  expect(decode(encode(''))).toBe('');
  expect(decode(encode('hello'))).toBe('hello');
  expect(decode(encode('WALL·E – Typeset in the Future'))).toBe('WALL·E – Typeset in the Future');
});
test('str 8', () => {
  expect(decode(encode('α'))).toBe('α');
  expect(decode(encode('亜'))).toBe('亜');
  expect(decode(encode('\uD83D\uDC26'))).toBe('\uD83D\uDC26');
  expect(decode(encode('a'.repeat(32)))).toBe('a'.repeat(32));
  expect(decode(encode('a'.repeat(255)))).toBe('a'.repeat(255));
});
test('str 16', () => {
  expect(decode(encode('a'.repeat(256)))).toBe('a'.repeat(256));
  expect(decode(encode('a'.repeat(65535)))).toBe('a'.repeat(65535));
});
test('str 32', () => {
  expect(decode(encode('a'.repeat(65536)))).toBe('a'.repeat(65536));
});

test('zero', () => {
  expect(decode(encode(0))).toBe(0);
});
test('positive fixint', () => {
  expect(decode(encode(0x00))).toBe(0x00);
  expect(decode(encode(0x44))).toBe(0x44);
  expect(decode(encode(0x7f))).toBe(0x7f);
});
test('negative  fixint', () => {
  expect(decode(encode(-0x01))).toBe(-0x01);
  expect(decode(encode(-0x10))).toBe(-0x10);
  expect(decode(encode(-0x20))).toBe(-0x20);
});

test('uint 8', () => {
  expect(decode(encode(128))).toBe(128);
  expect(decode(encode(255))).toBe(255);
});
test('uint 16', () => {
  expect(decode(encode(256))).toBe(256);
  expect(decode(encode(65535))).toBe(65535);
});
test('uint 32', () => {
  expect(decode(encode(65536))).toBe(65536);
  expect(decode(encode(4294967295))).toBe(4294967295);
});
test('uint 64', () => {
  expect(decode(encode(4294967296))).toBe(4294967296);
  expect(decode(encode(Math.pow(2, 53) - 1))).toBe(Math.pow(2, 53) - 1);
  expect(decode(encode(Math.pow(2, 63) + 1024))).toBe(Math.pow(2, 63) + 1024);
});
test('int 8', () => {
  expect(decode(encode(-128))).toBe(-128);
  expect(decode(encode(-255))).toBe(-255);
});
test('int 16', () => {
  expect(decode(encode(256))).toBe(256);
  expect(decode(encode(-65535))).toBe(-65535);
});
test('int 32', () => {
  expect(decode(encode(-65536))).toBe(-65536);
  expect(decode(encode(-4294967295))).toBe(-4294967295);
});
test('int 64', () => {
  expect(decode(encode(-4294967296))).toBe(-4294967296);
  expect(decode(encode(-(Math.pow(2, 53) - 1)))).toBe(-(Math.pow(2, 53) - 1));
  expect(decode(encode(-(Math.pow(2, 63) - 1024)))).toBe(-(Math.pow(2, 63) - 1024));
});
test('float 32', () => {
  expect(decode(encode(0.5))).toBe(0.5);
  expect(decode(encode(0.25))).toBe(0.25);
  expect(decode(encode(0.125))).toBe(0.125);
  expect(decode(encode(0.0625))).toBe(0.0625);
  expect(decode(encode(0.03125))).toBe(0.03125);
  expect(decode(encode(0.015625))).toBe(0.015625);
});
test('float 64', () => {
  expect(decode(encode(1.1))).toBe(1.1);
  expect(decode(encode(1.000001))).toBe(1.000001);
  expect(decode(encode(1.1234567890))).toBe(1.1234567890);
});

test('true, false, undefined, NaN, +Infinity, -Infinity', () => {
  expect(decode(encode(true))).toBe(true);
  expect(decode(encode(false))).toBe(false);
  expect(decode(encode(undefined))).toBe(undefined);
  expect(decode(encode(NaN))).toBe(NaN);
  expect(decode(encode(+Infinity))).toBe(+Infinity);
  expect(decode(encode(-Infinity))).toBe(-Infinity);
});

test('flat & nested empty arrays', () => {
  [
    [],
    [
      [],
      []
    ],
    [
      [
        [],
        [],
        []
      ]
    ]
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
test('flat arrays', () => {
  [
    [1, 2, 3],
    [1, 2, 3, 'a', 'b', 'c'],
    [1.5, 1.1, 1.1234567890, 'a', 'b'.repeat(10000), 'c'.repeat(70000)],
    [1, 0x80, 0x100, 0x10000, 0x100000000], // positive numbers
    [-1, -0x80, -0x100, -0x10000, -0x100000000], // negative numbers
    ['a'.repeat(31), 'b'.repeat(255), 'c'.repeat(10000), 'd'.repeat(70000), 'e'.repeat(2**27)] // strings
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
test('nested arrays', () => {
  [
    [
      [1, 2, 3],
      [1, 2, 3, 'a', 'b', 'c'],
      [1.5, 1.1, 1.1234567890, 'a', 'b'.repeat(10000), 'c'.repeat(70000)]
    ],
    [
      [ true, false, undefined, NaN, +Infinity, -Infinity ],
      [1.5, 1.1, 1.1234567890, 'a', 'b'.repeat(10000), 'c'.repeat(70000)]
    ]
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
test('highly nested arrays', () => {
  [
    [
      [1, 2, 3],
      [
        [ true, false, undefined, NaN, +Infinity, -Infinity ],
        [1.5, 1.1, 1.1234567890, 'a', 'b'.repeat(10000), 'c'.repeat(70000)]
      ],
      [
        [
          [1, 2, 3],
          [1, 2, 3, 'a', 'b', 'c'],
          [1.5, 1.1, 1.1234567890, 'a', 'b'.repeat(10000), 'c'.repeat(70000)]
        ],
      ]
    ]
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});

test('buffers, bin8', () => {
  [
    Buffer.allocUnsafe(1),
    Buffer.allocUnsafe(0x100 - 1)
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
test('buffers, bin16', () => {
  [
    Buffer.allocUnsafe(0x10000 - 1)
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
test('buffers, bin32', () => {
  [
    Buffer.allocUnsafe(0x10000 * 10)
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
test('arraybuffers as buffer', () => {
  [
    new ArrayBuffer(1),
    new ArrayBuffer(0x100),
    new ArrayBuffer(0x10000),
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(Buffer.from(value)));
});
test('typedarrays as buffer', () => {
  [
    new Uint8Array(0x100),
    new Uint16Array(0x100),
    new Uint32Array(0x100),
    new Int8Array(0x100),
    new Int16Array(0x100),
    new Int32Array(0x100),
    new Float32Array(0x100),
    new Float64Array(0x100)
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(Buffer.from(value.buffer)));
});
test('tiny object', () => {
  [
    {
      foo: 1,
      bar: 'abc'
    }
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
test('small object', () => {
  [
    {
      foo: 1,
      bar: [1, 2, 3, 4, 'abc', 'def'],
      foobar: {
        foo: true,
        bar: -2147483649,
        foobar: {
          foo: Buffer.from([1, 2, 3, 4, 5]),
          bar: 1.5,
          foobar: [true, false, 'abcdefghijkmonpqrstuvwxyz']
        }
      }
    }
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});

const array = (length) => {
  const arr = new Array(length);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = i;
  }
  return arr;
}

test('medium object', () => {
  [
    {
      unsigned: [1, 2, 3, 4, { b: { c: [128, 256, 65536, 4294967296] } }],
      signed: [-1, -2, -3, -4, { b: { c: [-33, -129, -32769, -2147483649] } }],
      str: ['abc', 'g'.repeat(32), 'h'.repeat(256)],
      array: [[], array(16)],
      map: {},
      nil: null,
      bool: { 'true': true, 'false': false, both: [true, false, false, false, true] },
      'undefined': [undefined, true, false, null, undefined]
    }
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});

const large = {
  unsigned: [1, 2, 3, 4, { b: { c: [128, 256, 65536, 4294967296] } }],
  signed: [-1, -2, -3, -4, { b: { c: [-33, -129, -32769, -2147483649] } }],
  bin: [Buffer.from('abc'), Buffer.from('a'.repeat(256)), Buffer.from('a'.repeat(65535))],
  str: ['abc', 'g'.repeat(32), 'h'.repeat(256), 'g'.repeat(65535)],
  array: [[], array(16), array(256)],
  map: {},
  nil: null,
  bool: { 'true': true, 'false': false, both: [true, false, false, false, true] },
  'undefined': [undefined, true, false, null, undefined]
};

for (var i = 0; i < 1024; i++) {
  large.map['a'.repeat(i)] = 'a'.repeat(i);
  large.map['b'.repeat(i)] = Buffer.from('b'.repeat(i));
}

test('large object', () => {
  [
    large
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});