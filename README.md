# what-the-pack
The fastest MessagePack implementation in JS.

## implementation notes

* this implementation uses pre-allocated buffers and buffer.copy() for encoding, instead of regular arrays
* uses a buffer polyfill if used in browser environments

## backward compatibility issues with other libraries

* used extensions
  * `fixext 1, type 0, data 0` = `undefined`
  * `fixext 1, type 0, data 1` = `NaN`
  * `fixext 1, type 0, data 2` = `+Infinity`
  * `fixext 1, type 0, data 3` = `-Infinity`
* Buffers, ArrayBuffers and TypedArrays
  * Buffers : encoded as Buffers, decoded as Buffers
  * ArrayBuffers : encoded as Buffers, decoded as Buffers
  ```js
  const decoded = MessagePack.decode(encoded);
  const your_arraybuffer = decoded.buffer;
  ```
  * TypedArrays : encoded as Buffers, decoded as Buffers
  ```js
  const decoded = MessagePack.decode(encoded);
  const your_typedarray = new Uint8Array(decoded.buffer);
  ```

## future improvements

* preallocating a larger buffer and using it like a circular buffer and using buffer.slice() instead of buffer.copy()

## references

* `buffer re-alloc idea`
  * https://github.com/darrachequesne/notepack/issues/12#issuecomment-320872590 (Manuel Astudillo)
* `notepack.io`
  * https://github.com/darrachequesne/notepack (MIT, Damien Arrachequesne)
* `notepack`
  * https://github.com/hypergeometric/notepack (MIT, Ben Shepheard)
* `buffer`:
  * https://github.com/feross/buffer (MIT, Feross Aboukhadijeh)
* `pretty-bytes`
  * https://github.com/sindresorhus/pretty-bytes (MIT, Sindre Sorhus)

## usage

```
yarn add what-the-pack
```

```js
const MessagePack = require('what-the-pack');

const data = {
  name: 'Lunox',
  age: 20
};

const encoded = MessagePack.encode(data);
const decoded = MessagePack.decode(encoded);

console.log({
  encoded,
  decoded
});
```

## result

```js
{ encoded: <Buffer 82 a4 6e 61 6d 65 a5 4c 75 6e 6f 78 a3 61 67 65 14>,
  decoded: { name: 'Lunox', age: 20 } }
```

## pre-allocating a larger buffer

```js
const MessagePack = require('what-the-pack');

// sets our log function to console.info
MessagePack.log = console.info;
// by default, our log function is console.log

// reallocates our buffer to 2 ^ 30 / 1 GB
// logs "MessagePack: Setting buffer limit to 1.07 GB"
MessagePack.reallocate(2**30);
// by default, our value is 8192 or 8KB

const data = {
  // large data goes here
};

```

```
2^7 = 128 B
2^8 = 256 B
2^9 = 512 B
2^10 = 1.02 kB
2^11 = 2.05 kB
2^12 = 4.1 kB
2^13 = 8.19 kB
2^14 = 16.4 kB
2^15 = 32.8 kB
2^16 = 65.5 kB
2^17 = 131 kB
2^18 = 262 kB
2^19 = 524 kB
2^20 = 1.05 MB
2^21 = 2.1 MB
2^22 = 4.19 MB
2^23 = 8.39 MB
2^24 = 16.8 MB
2^25 = 33.6 MB
2^26 = 67.1 MB
2^27 = 134 MB
2^28 = 268 MB
2^29 = 537 MB
2^30 = 1.07 GB
```

## minified build for browsers

```
<!-- latest umd build -->
<script src="https://unpkg.com/what-the-pack/dist/MessagePack.min.js"></script>

<!-- exposed as 'MessagePack' -->
<script>
  const data = {
    name: 'Lunox',
    age: 20
  };

  const encoded = MessagePack.encode(data);
  const decoded = MessagePack.decode(encoded);

  console.log({
    encoded,
    decoded
  });
</script>
```

## benchmarks

```
yarn run benchmark
```

```
$ yarn run benchmark
yarn run v1.5.1
$ node benchmark.js
MessagePack: Setting buffer limit to 4.19 MB
notepack.encode tiny x 237,430 ops/sec ±44.27% (85 runs sampled)
notepack encode small x 235,976 ops/sec ±1.13% (90 runs sampled)
notepack encode medium x 116,554 ops/sec ±0.58% (92 runs sampled)
notepack encode large x 228 ops/sec ±1.46% (81 runs sampled)
notepack decode tiny x 1,049,417 ops/sec ±0.79% (92 runs sampled)
notepack decode small x 239,018 ops/sec ±0.21% (94 runs sampled)
notepack decode medium x 143,825 ops/sec ±0.23% (90 runs sampled)
notepack decode large x 215 ops/sec ±0.51% (82 runs sampled)
what-the-pack encode tiny x 1,795,238 ops/sec ±0.40% (91 runs sampled)
what-the-pack encode small x 488,628 ops/sec ±0.41% (92 runs sampled)
what-the-pack encode medium x 217,942 ops/sec ±0.43% (94 runs sampled)
what-the-pack encode large x 221 ops/sec ±1.15% (82 runs sampled)
what-the-pack decode tiny x 1,037,703 ops/sec ±1.11% (85 runs sampled)
what-the-pack decode small x 243,569 ops/sec ±1.03% (92 runs sampled)
what-the-pack decode medium x 144,167 ops/sec ±1.02% (88 runs sampled)
what-the-pack decode large x 215 ops/sec ±0.30% (82 runs sampled)
Done in 96.26s.
```
## tests

```
yarn run test
```

```
$ yarn run test
yarn run v1.5.1
$ jest
 PASS  ./test.js
  √ fixstr (6ms)
  √ str 8 (2ms)
  √ str 16 (1ms)
  √ str 32 (1ms)
  √ zero
  √ positive fixint (1ms)
  √ negative  fixint (1ms)
  √ uint 8 (1ms)
  √ uint 16 (1ms)
  √ uint 32
  √ uint 64 (1ms)
  √ int 8 (1ms)
  √ int 16
  √ int 32 (2ms)
  √ int 64
  √ float 32 (2ms)
  √ float 64 (1ms)
  √ true, false, undefined, NaN, +Infinity, -Infinity (2ms)
  √ flat & nested empty arrays (1ms)
  √ flat arrays (456ms)
  √ nested arrays (5ms)
  √ highly nested arrays (2ms)
  √ buffers, bin8 (2ms)
  √ buffers, bin16 (96ms)
  √ buffers, bin32 (473ms)
  √ arraybuffers as buffer (54ms)
  √ typedarrays as buffer (7ms)
  √ tiny object (1ms)
  √ small object
  √ medium object (1ms)
  √ large object (1736ms)

  console.log index.js:49
    MessagePack: Setting buffer limit to 1.07 GB

Test Suites: 1 passed, 1 total
Tests:       31 passed, 31 total
Snapshots:   0 total
Time:        5.477s
Ran all test suites.
Done in 6.59s.
```

MIT | @davalapar
