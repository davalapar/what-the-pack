# what-the-pack
The fastest MessagePack implementation in Javascript | msgpack.org[Javascript/NodeJS]

## benchmarks

* `yarn run benchmark`

```
$ yarn run benchmark
yarn run v1.5.1
$ node benchmark.js
MessagePack: Setting buffer limit to 4.19 MB
notepack.encode tiny x 247,711 ops/sec ±43.42% (89 runs sampled)
notepack encode small x 242,347 ops/sec ±1.42% (91 runs sampled)
notepack encode medium x 116,545 ops/sec ±0.85% (90 runs sampled)
notepack encode large x 227 ops/sec ±1.52% (79 runs sampled)
notepack decode tiny x 1,162,552 ops/sec ±0.38% (93 runs sampled)
notepack decode small x 242,453 ops/sec ±0.39% (93 runs sampled)
notepack decode medium x 144,211 ops/sec ±0.32% (89 runs sampled)
notepack decode large x 216 ops/sec ±0.46% (82 runs sampled)
what-the-pack encode tiny x 1,917,150 ops/sec ±0.35% (92 runs sampled)
what-the-pack encode small x 505,716 ops/sec ±0.48% (92 runs sampled)
what-the-pack encode medium x 221,065 ops/sec ±0.57% (89 runs sampled)
what-the-pack encode large x 220 ops/sec ±1.16% (83 runs sampled)
what-the-pack decode tiny x 1,143,586 ops/sec ±1.04% (91 runs sampled)
what-the-pack decode small x 254,397 ops/sec ±0.88% (93 runs sampled)
what-the-pack decode medium x 147,996 ops/sec ±0.27% (95 runs sampled)
what-the-pack decode large x 217 ops/sec ±0.29% (83 runs sampled)
Done in 96.34s.
```
## tests

* `yarn run test`

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
