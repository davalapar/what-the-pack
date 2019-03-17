/* eslint-disable no-console */

const { initialize } = require('./index');

const { encode, decode } = initialize(2**24, console.log);

const subjects = [
  ['fixstr', 'x'.repeat(31)],
  ['str8', 'x'.repeat(255)],
  ['str16', 'x'.repeat(65535)],
  ['str32', 'x'.repeat(65536)],
];

for (let i = 0, l = subjects.length; i < l; i += 1) {
  const [label, value] = subjects[i];
  let encoded;
  let decoded;
  try {
    encoded = encode(value);
  } catch (e) {
    const error = new Error(`@ "${label}" ${e.message}`);
    error.stack = e.stack;
    throw error;
  }
  try {
    decoded = decode(encoded);
  } catch (e) {
    const error = new Error(`@ "${label}" ${e.message}`);
    error.stack = e.stack;
    throw error;
  }
  const type = typeof value;
  switch (type) {
    case 'string':
    case 'number':
    case 'boolean': {
      if (typeof decoded !== type) {
        throw Error(`Type mismatch at "${label}", expecting ${type}, received ${typeof decoded}`);
      }
      if (decoded !== value) {
        // console.error(JSON.stringify({ encoded, decoded }));
        console.log(`${value.length} !== ${decoded.length}`);
        const error = new Error(`Value mismatch at "${label}"`);
        delete error.stack;
        throw error;
      }
      break;
    }
    default: {
      throw Error(`Unhandled type ${type}`);
    }
  }
  console.log(`✔ ${label}`);
}