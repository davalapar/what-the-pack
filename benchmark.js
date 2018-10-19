const Benchmark = require('benchmark');
const suite = new Benchmark.Suite;

const wtp = require('./index');

const notepack = require('notepack.io');

/**
 * Reallocate our temporary buffer from 8KB to 4MB:
 */
wtp.reallocate(2 ** 22);

const tiny = {
  foo: 1,
  bar: 'abc'
};
const small = {
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
};

const array = (length) => {
  const arr = new Array(length);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = i;
  }
  return arr;
}
const map = (length) => {
  const result = {};
  for (let i = 0; i < length; i++) {
    result[i + ''] = i;
  }
  return result;
}

const medium = {
  unsigned: [1, 2, 3, 4, { b: { c: [128, 256, 65536, 4294967296] } }],
  signed: [-1, -2, -3, -4, { b: { c: [-33, -129, -32769, -2147483649] } }],
  str: ['abc', 'g'.repeat(32), 'h'.repeat(256)],
  array: [[], array(16)],
  map: {},
  nil: null,
  bool: { 'true': true, 'false': false, both: [true, false, false, false, true] },
  'undefined': [undefined, true, false, null, undefined]
};

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

const encoded = {
  wtp: {
    tiny: wtp.encode(tiny),
    small: wtp.encode(small),
    medium: wtp.encode(medium),
    large: wtp.encode(large)
  },
  notepack: {
    tiny: notepack.encode(tiny),
    small: notepack.encode(small),
    medium: notepack.encode(medium),
    large: notepack.encode(large)
  }
};

suite
  .add('notepack.encode tiny', () => {
    notepack.encode(tiny);
  })
  .add('notepack encode small', () => {
    notepack.encode(small);
  })
  .add('notepack encode medium', () => {
    notepack.encode(medium);
  })
  .add('notepack encode large', () => {
    notepack.encode(large);
  })
  .add('notepack decode tiny', () => {
    notepack.decode(encoded.notepack.tiny);
  })
  .add('notepack decode small', () => {
    notepack.decode(encoded.notepack.small);
  })
  .add('notepack decode medium', () => {
    notepack.decode(encoded.notepack.medium);
  })
  .add('notepack decode large', () => {
    notepack.decode(encoded.notepack.large);
  })
  .add('what-the-pack encode tiny', () => {
    wtp.encode(tiny);
  })
  .add('what-the-pack encode small', () => {
    wtp.encode(small);
  })
  .add('what-the-pack encode medium', () => {
    wtp.encode(medium);
  })
  .add('what-the-pack encode large', () => {
    wtp.encode(large);
  })
  .add('what-the-pack decode tiny', () => {
    wtp.decode(encoded.wtp.tiny);
  })
  .add('what-the-pack decode small', () => {
    wtp.decode(encoded.wtp.small);
  })
  .add('what-the-pack decode medium', () => {
    wtp.decode(encoded.wtp.medium);
  })
  .add('what-the-pack decode large', () => {
    wtp.decode(encoded.wtp.large);
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .run({ 'async': true });
