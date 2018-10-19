const { reallocate, encode, decode } = require('./index');

/**
 * Reallocate our temporary buffer from 8KB to 1GB:
 */
reallocate(2 ** 30);

test('fixstr', () => {
  [ '', 'hello' ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('str 8', () => {
  [ 'α', '亜', '\uD83D\uDC26', 'a'.repeat(32), 'a'.repeat(255) ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('str 16', () => {
  [ 'a'.repeat(256), 'a'.repeat(65535) ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('str 32', () => {
  [ 'a'.repeat(65536) ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});

test('zero', () => {
  [ 0 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
test('positive fixint', () => {
  [ 0x00, 0x44, 0x7f ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
test('negative  fixint', () => {
  [ -0x01, -0x10, -0x20 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});

it('uint 8', () => {
  [ 128, 255 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('uint 16', () => {
  [ 256, 65535 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('uint 32', () => {
  [ 65536, 4294967295 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('uint 64', () => {
  [ 4294967296, Math.pow(2, 53) - 1, Math.pow(2, 63) + 1024 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('int 8', () => {
  [ -128, -255 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('int 16', () => {
  [ 256, -65535 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('int 32', () => {
  [ -65536, -4294967295 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('int 64', () => {
  [ -4294967296, - (Math.pow(2, 53) - 1), -(Math.pow(2, 63) - 1024) ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('float 32', () => {
  [ 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});
it('float 64', () => {
  [ 1.1, 1.000001, 1.1234567890 ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});

it('true, false, undefined, NaN, +Infinity, -Infinity', () => {
  [ true, false, undefined, NaN, +Infinity, -Infinity ].forEach((value) =>  expect(decode(encode(value))).toBe(value));
});

it('flat & nested empty arrays', () => {
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
it('flat arrays', () => {
  [
    [1, 2, 3],
    [1, 2, 3, 'a', 'b', 'c'],
    [1.5, 1.1, 1.1234567890, 'a', 'b'.repeat(10000), 'c'.repeat(70000)],
    [1, 0x80, 0x100, 0x10000, 0x100000000], // positive numbers
    [-1, -0x80, -0x100, -0x10000, -0x100000000], // negative numbers
    ['a'.repeat(31), 'b'.repeat(255), 'c'.repeat(10000), 'd'.repeat(70000), 'e'.repeat(2**27)] // strings
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
it('nested arrays', () => {
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
it('highly nested arrays', () => {
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

it('buffers, bin8', () => {
  [
    Buffer.allocUnsafe(1),
    Buffer.allocUnsafe(0x100 - 1)
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
it('buffers, bin16', () => {
  [
    Buffer.allocUnsafe(0x10000 - 1)
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
it('buffers, bin32', () => {
  [
    Buffer.allocUnsafe(0x10000 * 10)
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
it('arraybuffers as buffer', () => {
  [
    new ArrayBuffer(1),
    new ArrayBuffer(0x100),
    new ArrayBuffer(0x10000),
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(Buffer.from(value)));
});
it('typedarrays as buffer', () => {
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
it('tiny object', () => {
  [
    {
      foo: 1,
      bar: 'abc'
    }
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
it('small object', () => {
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

it('medium object', () => {
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

const map = (length) => {
  const result = {};
  for (let i = 0; i < length; i++) {
    result[i + ''] = i;
  }
  return result;
}

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

it('large object', () => {
  [
    large
  ].forEach((value) =>  expect(decode(encode(value))).toStrictEqual(value));
});
