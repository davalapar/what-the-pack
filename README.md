# what-the-pack
Ultra-fast MessagePack for NodeJS & Browsers.

## implementation notes

- this implementation uses pre-allocated buffers and buffer.copy() for encoding, instead of regular arrays
- uses a buffer polyfill if used in browser environments
- has dictionary support, to further reduce payload size

## backward compatibility notes with other libraries

- used extensions
  - `fixext 1, type 0, data 0` = `undefined`
  - `fixext 1, type 0, data 1` = `NaN`
  - `fixext 1, type 0, data 2` = `+Infinity`
  - `fixext 1, type 0, data 3` = `-Infinity`
- `Buffers`, `ArrayBuffers` and `TypedArrays`
  - `Buffers` : encoded as Buffers, decoded as Buffers
  - `ArrayBuffers` : encoded as Buffers, decoded as Buffers
  ```js
  const decoded = decode(encoded);
  const your_arraybuffer = decoded.buffer;
  ```
  - `TypedArrays` : encoded as Buffers, decoded as Buffers
  ```js
  const decoded = decode(encoded);
  const your_typedarray = new Uint8Array(decoded.buffer);
  ```

## usage

```sh
yarn add what-the-pack
```

```js
const MessagePack = require('what-the-pack');
const { encode, decode } = MessagePack.initialize(2**22); // 4MB

const data = {
  name: 'Lunox',
  age: 20
};

const encoded = encode(data);
const decoded = decode(encoded);

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
const { encode, decode } = MessagePack.initialize(2**30); // 1GB
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

## using dictionaries (added in 1.1.3)

- this feature isn't in MessagePack spec but added as a convenience feature in 1.1.3
- dictionaries allow us to decrease our buffer output size by recognizing strings used as object keys and replacing them with shorter-byte integer values during the encoding process
- these shorter-byte placeholder values are then restored to their respective strings during the decoding process
- the trade-off in using dictionaries is an insignificantly slower encoding and decoding time in exchange of a significantly smaller buffer output, which results into a lower network bandwidth and storage consumption in the long run
- the best part: the byte placeholders starts from -32 then increments upwards, values -32 to 127 are encoded in single byte, which means your first (32 + 128) = 160 keys will be encoded as a single byte instead of encoding the whole string

```js
const MessagePack = require('what-the-pack');
const { encode, decode, register } = MessagePack.initialize(2**22); // 4MB
let encoded, decoded, data;
data = { name: 'Lunox', age: 20 };

encoded = encode(data);
decoded = decode(encoded);
console.log({ encoded, decoded });
/**
 - encoded: <Buffer 82 a4 6e 61 6d 65 a5 4c 75 6e 6f 78 a3 61 67 65 14> (17)
 - decoded: { name: 'Lunox', age: 20 }
 **/

register('name', 'age');
encoded = encode(data);
decoded = decode(encoded);
console.log({ encoded, decoded });
/**
 - encoded: <Buffer 82 e0 a5 4c 75 6e 6f 78 e1 14> (10)
 - decoded: { name: 'Lunox', age: 20 }
 **/
```

## minified build for browsers

```js
<!-- latest umd build -->
<script src="https://unpkg.com/what-the-pack/dist/MessagePack.min.js"></script>

<!-- exposed as 'MessagePack' -->
<script>
  const { encode, decode } = MessagePack.initialize(2**22); // 4MB
  const data = {
    name: 'Lunox',
    age: 20
  };
  const encoded = encode(data);
  const decoded = decode(encoded);
  console.log({ encoded, decoded });
</script>
```

## using with browser websockets

#### server

```js
const WebSocket = require('ws');
const MessagePack = require('what-the-pack');
const { encode, decode } = MessagePack.initialize(2**22); // 4MB

const wss = new WebSocket.Server(
  /- options go here */
);
wss.on('connection', (client, req) => {
  console.log('A client has connected.');
  console.log('IP address:', req.connection.remoteAddress);
  client.send(
    encode({
      message: 'something'
    })
  );
});
```

#### client

- On browsers, `Buffer` object is exposed as `MessagePack.Buffer`
- On browsers, call `MessagePack.Buffer.from(x)` on received ArrayBuffers

```js
// Create WebSocket connection.
const socket = new WebSocket('ws://localhost:8080');
const { encode, decode, Buffer } = MessagePack.initialize(2**22); // 4MB

// Connection opened
socket.addEventListener('open', (event) => {
  socket.binaryType = 'arraybuffer'; // important
  console.log('Connected to server.');
});

// Listen for messages
socket.addEventListener('message', (event) => {
  const data = MessagePack.decode(
    Buffer.from(event.data)
  );
  console.log(data);
  // logs: { message: 'something' }
});
```

## benchmarks

```sh
yarn run benchmark
```

```sh
$ yarn run benchmark
JSON stringify tiny x 1,477,866 ops/sec ±0.58% (93 runs sampled)
JSON stringify small x 232,645 ops/sec ±0.25% (91 runs sampled)
JSON stringify medium x 117,357 ops/sec ±0.31% (93 runs sampled)
JSON stringify large x 24.01 ops/sec ±0.37% (43 runs sampled)
JSON parse tiny x 1,301,925 ops/sec ±3.18% (82 runs sampled)
JSON parse small x 264,410 ops/sec ±0.57% (90 runs sampled)
JSON parse medium x 133,865 ops/sec ±0.52% (87 runs sampled)
JSON parse large x 31.52 ops/sec ±0.34% (53 runs sampled)
what-the-pack encode tiny x 1,175,981 ops/sec ±0.39% (92 runs sampled)
what-the-pack encode small x 365,533 ops/sec ±0.85% (90 runs sampled)
what-the-pack encode medium x 173,746 ops/sec ±0.41% (91 runs sampled)
what-the-pack encode large x 218 ops/sec ±0.85% (82 runs sampled)
what-the-pack decode tiny x 1,130,260 ops/sec ±0.30% (91 runs sampled)
what-the-pack decode small x 254,931 ops/sec ±0.79% (94 runs sampled)
what-the-pack decode medium x 146,809 ops/sec ±0.79% (92 runs sampled)
what-the-pack decode large x 211 ops/sec ±0.37% (87 runs sampled)
notepack.encode tiny x 1,291,361 ops/sec ±0.22% (95 runs sampled)
notepack encode small x 325,882 ops/sec ±1.20% (95 runs sampled)
notepack encode medium x 133,398 ops/sec ±0.20% (94 runs sampled)
notepack encode large x 231 ops/sec ±1.65% (81 runs sampled)
notepack decode tiny x 1,097,597 ops/sec ±0.67% (93 runs sampled)
notepack decode small x 231,895 ops/sec ±0.69% (96 runs sampled)
notepack decode medium x 137,385 ops/sec ±2.45% (86 runs sampled)
notepack decode large x 210 ops/sec ±0.85% (86 runs sampled)
```

## tests

```sh
yarn run test
```

```sh
$ yarn run test
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

## changelog

- 1.x
  - basic support
  - dictionary support
- 2.0.0
  - rewrite to use raw functions instead of classes
  - update dev-deps
  - jest test-cov @ `86.06%`
    - statements `389/452`
    - branches `137/169`
    - functions `11/12`
    - lines `374/428`
- 2.0.x
  - fix tempBufferLength check
  - rebuild for browser
  - fix leak on buffer decode

## references

- `buffer re-alloc idea`
  - https://github.com/darrachequesne/notepack/issues/12#issuecomment-320872590 (Manuel Astudillo)
- `notepack.io`
  - https://github.com/darrachequesne/notepack (MIT, Damien Arrachequesne)
- `notepack`
  - https://github.com/hypergeometric/notepack (MIT, Ben Shepheard)
- `buffer`:
  - https://github.com/feross/buffer (MIT, Feross Aboukhadijeh)
- `pretty-bytes`
  - https://github.com/sindresorhus/pretty-bytes (MIT, Sindre Sorhus)

MIT | @davalapar
