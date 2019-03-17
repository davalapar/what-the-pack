/* eslint-disable no-console */

const Benchmark = require('benchmark');
const suite = new Benchmark.Suite;

const MessagePack = require('./index');

const notepack = require('notepack.io');

const wtp = MessagePack.initialize(2 ** 24);

const subjects = {
  fixstr: 'x'.repeat(31),
  str8: 'x'.repeat(255),
  str16: 'x'.repeat(65535),
  str32: 'x'.repeat(65536),
}

suite
  .add('JSON stringify str32', () => {
    JSON.stringify(subjects.str32);
  })
  .add('JSON stringify+parse str32', () => {
    JSON.parse(JSON.stringify(subjects.str32));
  })
  .add('what-the-pack encode str32', () => {
    wtp.encode(subjects.str32);
  })
  .add('what-the-pack encode+decode str32', () => {
    wtp.decode(wtp.encode(subjects.str32));
  })
  .add('notepack.encode str32', () => {
    notepack.encode(subjects.str32);
  })
  .add('notepack encode+decode str32', () => {
    notepack.decode(notepack.encode(subjects.str32));
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .run({ 'async': true });
