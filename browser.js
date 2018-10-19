
/* eslint-disable no-console */

const pb = require('pretty-bytes');
const Buffer = require('buffer').Buffer;

class Allocator {
  constructor (length) {
    this.buffer = Buffer.allocUnsafe(length || Buffer.poolSize).fill(0);
    this.offset = -1;
  }
  copy () {
    const latest = Buffer.allocUnsafe(this.offset + 1).fill(0);
    this.buffer.copy(latest, 0, 0, this.offset + 1);
    return latest;
  }
}

class Iterator {
  constructor (buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }
}

let allocator = new Allocator();
const iterator = new Iterator();
const dictionary = {};
let dictionaryEnabled = false;
let dictionaryOffset = -33;
/**
 * Why -33:
 * - This allows us to use the negative (-32 to -1) and positive fixint range (0 to 127)
 * - So instead of encoding the whole key string, we only encode a single byte
 * - That's (32 + 128) = 160 of your first entries being encoded in a single damn byte
 */
class MessagePack {
  static register (...args) {
    dictionaryEnabled = true;
    args.forEach((item) => {
      dictionaryOffset += 1;
      dictionary[dictionaryOffset] = item;
      dictionary[item] = dictionaryOffset;
    });
  }
  static get dictionary () {
    return dictionary;
  }
  static reallocate (length) {
    MessagePack.log('MessagePack: Setting buffer limit to', pb(length || Buffer.poolSize));
    allocator = new Allocator(length);
  }
  static get allocator () {
    return allocator;
  }
  static get iterator () {
    return iterator;
  }
  static encode (value, persist) {
    if (persist !== true) allocator.offset = -1;
    let length = 0;
    switch (typeof value) {
      case 'string':
        if (value.length < 32) { // < 32, fixstr
          for (let i = 0, c = 0, l = value.length; i < l; i += 1) {
            c = value.charCodeAt(i);
            if (c < 128) {
              length += 1;
            } else if (c < 1280) {
              length += 2;
            } else if (c < 55296 || c >= 57344) {
              length += 3;
            } else {
              i += 1;
              length += 4;
            }
          }
          allocator.buffer[allocator.offset += 1] = length | 160;
          for (let i = 0, c = 0, l = value.length; i < l; i += 1) {
            c = value.charCodeAt(i);
            if (c < 128) {
              allocator.buffer[allocator.offset += 1] = c;
            } else if (c < 1280) {
              allocator.buffer[allocator.offset += 1] = 192 | (c >> 6);
              allocator.buffer[allocator.offset += 1] = 128 | (c & 63);
            } else if (c < 55296 || c >= 57344) {
              allocator.buffer[allocator.offset += 1] = 224 | (c >> 12);
              allocator.buffer[allocator.offset += 1] = 128 | (c >> 6) & 63;
              allocator.buffer[allocator.offset += 1] = 128 | (c & 63);
            } else {
              i += 1;
              c = 65536 + (((c & 1023) << 10) | (value.charCodeAt(i) & 1023));
              allocator.buffer[allocator.offset += 1] = 240 | (c >> 18);
              allocator.buffer[allocator.offset += 1] = 128 | (c >> 12) & 63;
              allocator.buffer[allocator.offset += 1] = 128 | (c >> 6) & 63;
              allocator.buffer[allocator.offset += 1] = 128 | (c & 63);
            }
          }
          break;
        } else { // > 32, str8, str16, str32
          length = Buffer.byteLength(value);
          if (length < 256) { // str8
            allocator.buffer[allocator.offset += 1] = 217;
            allocator.buffer[allocator.offset += 1] = length;
            allocator.buffer.write(value, allocator.offset += 1, length, 'utf8');
            allocator.offset += length - 1;
          } else if (length < 65536) { // str16
            allocator.buffer[allocator.offset += 1] = 218;
            allocator.buffer[allocator.offset += 1] = length >> 8;
            allocator.buffer[allocator.offset += 1] = length;
            allocator.buffer.write(value, allocator.offset += 1, length, 'utf8');
            allocator.offset += length - 1;
          } else if (length < 4294967296) { // str32
            allocator.buffer[allocator.offset += 1] = 219;
            allocator.buffer[allocator.offset += 1] = length >> 24;
            allocator.buffer[allocator.offset += 1] = length >> 16;
            allocator.buffer[allocator.offset += 1] = length >> 8;
            allocator.buffer[allocator.offset += 1] = length;
            allocator.buffer.write(value, allocator.offset += 1, length, 'utf8');
            allocator.offset += length - 1;
          } else {
            throw Error('Max supported string length (4294967296) exceeded, encoding failure.');
          }
        }
        break;
      case 'number':
        if (Number.isFinite(value) === false) {
          if (Number.isNaN(value) === true) { // NaN, fixext 1, type = 0, data = 1
            allocator.buffer[allocator.offset += 1] = 212;
            allocator.buffer[allocator.offset += 1] = 0;
            allocator.buffer[allocator.offset += 1] = 1;
            break;
          }
          if (value === Infinity) { // +Infinity, fixext 1, type = 0, data = 2
            allocator.buffer[allocator.offset += 1] = 212;
            allocator.buffer[allocator.offset += 1] = 0;
            allocator.buffer[allocator.offset += 1] = 2;
            break;
          }
          if (value === -Infinity) { // -Infinity, fixext 1, type = 0, data = 3
            allocator.buffer[allocator.offset += 1] = 212;
            allocator.buffer[allocator.offset += 1] = 0;
            allocator.buffer[allocator.offset += 1] = 3;
            break;
          }
        }
        if (Math.floor(value) !== value) {
          if (Math.fround(value) === value) {
            allocator.buffer[allocator.offset += 1] = 202;
            allocator.buffer.writeFloatBE(value, allocator.offset += 1);
            allocator.offset += 3;
            break;
          } else {
            allocator.buffer[allocator.offset += 1] = 203;
            allocator.buffer.writeDoubleBE(value, allocator.offset += 1);
            allocator.offset += 7;
            break;
          }
        }
        if (value >= 0) {
          if (value < 128) { // positive fixint
            allocator.buffer[allocator.offset += 1] = value;
            break;
          }
          if (value < 256) { // uint 8
            allocator.buffer[allocator.offset += 1] = 204;
            allocator.buffer[allocator.offset += 1] = value;
            break;
          }
          if (value < 65536) {  // uint 16
            allocator.buffer[allocator.offset += 1] = 205;
            allocator.buffer[allocator.offset += 1] = value >> 8;
            allocator.buffer[allocator.offset += 1] = value;
            break;
          }
          if (value < 4294967296) { // uint 32
            allocator.buffer[allocator.offset += 1] = 206;
            allocator.buffer[allocator.offset += 1] = value >> 24;
            allocator.buffer[allocator.offset += 1] = value >> 16;
            allocator.buffer[allocator.offset += 1] = value >> 8;
            allocator.buffer[allocator.offset += 1] = value;
            break;
          }
          // uint 64
          let hi = (value / Math.pow(2, 32)) >> 0, lo = value >>> 0;
          allocator.buffer[allocator.offset += 1] = 207;
          allocator.buffer[allocator.offset += 1] = hi >> 24;
          allocator.buffer[allocator.offset += 1] = hi >> 16;
          allocator.buffer[allocator.offset += 1] = hi >> 8;
          allocator.buffer[allocator.offset += 1] = hi;
          allocator.buffer[allocator.offset += 1] = lo >> 24;
          allocator.buffer[allocator.offset += 1] = lo >> 16;
          allocator.buffer[allocator.offset += 1] = lo >> 8;
          allocator.buffer[allocator.offset += 1] = lo;
        } else {
          if (value >= -32) { // negative fixint
            allocator.buffer[allocator.offset += 1] = value;
            break;
          }
          if (value >= -128) { // int 8
            allocator.buffer[allocator.offset += 1] = 208;
            allocator.buffer[allocator.offset += 1] = value;
            break;
          }
          if (value >= -12800) { // int 16
            allocator.buffer[allocator.offset += 1] = 209;
            allocator.buffer[allocator.offset += 1] = value >> 8;
            allocator.buffer[allocator.offset += 1] = value;
            break;
          }
          if (value >= -128000000) { // int 32
            allocator.buffer[allocator.offset += 1] = 210;
            allocator.buffer[allocator.offset += 1] = value >> 24;
            allocator.buffer[allocator.offset += 1] = value >> 16;
            allocator.buffer[allocator.offset += 1] = value >> 8;
            allocator.buffer[allocator.offset += 1] = value;
            break;
          }
          // int 64
          let hi = Math.floor(value / Math.pow(2, 32)), lo = value >>> 0;
          allocator.buffer[allocator.offset += 1] = 211;
          allocator.buffer[allocator.offset += 1] = hi >> 24;
          allocator.buffer[allocator.offset += 1] = hi >> 16;
          allocator.buffer[allocator.offset += 1] = hi >> 8;
          allocator.buffer[allocator.offset += 1] = hi;
          allocator.buffer[allocator.offset += 1] = lo >> 24;
          allocator.buffer[allocator.offset += 1] = lo >> 16;
          allocator.buffer[allocator.offset += 1] = lo >> 8;
          allocator.buffer[allocator.offset += 1] = lo;
        }
        break;
      case 'object':
        if (value === null) { // null
          allocator.buffer[allocator.offset += 1] = 192;
          break;
        }
        if (Array.isArray(value) === true) {
          length = value.length;
          if (length < 16) { // fixarray
            allocator.buffer[allocator.offset += 1] = length | 144;
          } else if (length < 65536) { // array 16
            allocator.buffer[allocator.offset += 1] = 220;
            allocator.buffer[allocator.offset += 1] = length >> 8;
            allocator.buffer[allocator.offset += 1] = length;
          } else if (length < 4294967296) { // array 32
            allocator.buffer[allocator.offset += 1] = 221;
            allocator.buffer[allocator.offset += 1] = length >> 24;
            allocator.buffer[allocator.offset += 1] = length >> 16;
            allocator.buffer[allocator.offset += 1] = length >> 8;
            allocator.buffer[allocator.offset += 1] = length;
          } else {
            throw new Error('Array too large');
          }
          for (let i = 0; i < length; i += 1) {
            MessagePack.encode(value[i], true);
          }
          break;
        }
        if (value instanceof ArrayBuffer) { // arraybuffer to buffer
          value = Buffer.from(value);
        }
        if (
          value instanceof Buffer === false &&
          (
            value instanceof Int8Array
            || value instanceof Int16Array
            || value instanceof Int32Array
            || value instanceof Uint8Array
            || value instanceof Uint8ClampedArray
            || value instanceof Uint16Array
            || value instanceof Uint32Array
            || value instanceof Float32Array
            || value instanceof Float64Array
          )
        ) {
          let temp = Buffer.from(value.buffer);
          if (value.byteLength !== value.buffer.byteLength) {
            temp = temp.slice(value.byteOffset, value.byteOffset + value.byteLength)
          }
          value = temp;
        }
        if (value instanceof Buffer) { // typedarrays and buffer
          length = value.length;
          if (length < 256) { // bin8
            allocator.buffer[allocator.offset += 1] = 196;
            allocator.buffer[allocator.offset += 1] = length;
            if (length > 32) {
              value.copy(allocator.buffer, allocator.offset += 1, 0, length);
              allocator.offset += length - 1;
            } else {
              for (let i = 0; i < length; i++) {
                allocator.buffer[allocator.offset += 1] = value[i];
              }
            }
          } else if (length < 65536) { // bin16
            allocator.buffer[allocator.offset += 1] = 197;
            allocator.buffer[allocator.offset += 1] = length >> 8;
            allocator.buffer[allocator.offset += 1] = length;
            value.copy(allocator.buffer, allocator.offset += 1, 0, length);
            allocator.offset += length - 1;
          } else if (length < 4294967296) { // bin32
            allocator.buffer[allocator.offset += 1] = 198;
            allocator.buffer[allocator.offset += 1] = length >> 24;
            allocator.buffer[allocator.offset += 1] = length >> 16;
            allocator.buffer[allocator.offset += 1] = length >> 8;
            allocator.buffer[allocator.offset += 1] = length;
            value.copy(allocator.buffer, allocator.offset += 1, 0, length);
            allocator.offset += length - 1;
          } else {
            throw Error('Max supported buffer length (4294967296) exceeded, encoding failure.');
          }
          break;
        } else { // plain javascript object
          let keys = Object.keys(value);
          length = keys.length;
          if (length < 16) { // fixmap
            allocator.buffer[allocator.offset += 1] = length | 128;
          } else if (length < 65536) { // map16
            allocator.buffer[allocator.offset += 1] = 222;
            allocator.buffer[allocator.offset += 1] = length >> 8;
            allocator.buffer[allocator.offset += 1] = length;
          } else if (length < 4294967296) { // map32
            allocator.buffer[allocator.offset += 1] = 223;
            allocator.buffer[allocator.offset += 1] = length >> 24;
            allocator.buffer[allocator.offset += 1] = length >> 16;
            allocator.buffer[allocator.offset += 1] = length >> 8;
            allocator.buffer[allocator.offset += 1] = length;
          } else {
            throw new Error('Object too large');
          }
          if (dictionaryEnabled === true) {
            for (let i = 0; i < length; i += 1) {
              MessagePack.encode(dictionary[keys[i]] || keys[i], true);
              MessagePack.encode(value[keys[i]], true);
            }
          } else {
            for (let i = 0; i < length; i += 1) {
              MessagePack.encode(keys[i], true);
              MessagePack.encode(value[keys[i]], true);
            }
          }
        }
        break;
      default:
        switch (value) {
          case true:  // true
            allocator.buffer[allocator.offset += 1] =  195;
            break;
          case false: // false
            allocator.buffer[allocator.offset += 1] =  194;
            break;
          case undefined: // undefined, fixext 1, type = 0, data = 0
            allocator.buffer[allocator.offset += 1] = 212;
            allocator.buffer[allocator.offset += 1] = 0;
            allocator.buffer[allocator.offset += 1] = 0;
            break;
          default:
            throw Error('Error encoding value.');
        }
    }
    if (persist !== true) {
      return allocator.copy();
    }
  }

  static decode (buffer, persist) {
    let value, length;
    if (persist !== true) { // reset our iterator
      iterator.buffer = buffer;
      iterator.offset = 0;
    }
    if (iterator.buffer[iterator.offset] < 192) {
      if (iterator.buffer[iterator.offset] < 128) { // positive fixint
        value = iterator.buffer[iterator.offset];
        iterator.offset += 1;
        return value;
      } else if (iterator.buffer[iterator.offset] < 144) { // fixmap
        length = iterator.buffer[iterator.offset] & 31;
        value = {};
        iterator.offset += 1;
        if (dictionaryEnabled === true) {
          for (let i = 0, key; i < length; i++) {
            key = MessagePack.decode(undefined, true);
            value[dictionary[key] || key] = MessagePack.decode(undefined, true);
          }
        } else {
          for (let i = 0; i < length; i++) {
            value[MessagePack.decode(undefined, true)] = MessagePack.decode(undefined, true);
          }
        }
        return value;
      } else if (iterator.buffer[iterator.offset] < 160) { // fixarray
        length = iterator.buffer[iterator.offset] & 15;
        iterator.offset += 1;
        value = new Array(length);
        for (let i = 0; i < length; i += 1) {
          value[i] = MessagePack.decode(undefined, true);
        }
        return value;
      } else { // fixstr
        length = iterator.buffer[iterator.offset] & 31;
        iterator.offset += 1;
        value = iterator.buffer.toString('utf8', iterator.offset, iterator.offset + length);
        iterator.offset += length;
        return value;
      }
    } else if (iterator.buffer[iterator.offset] > 223) { // negative fixint
      value = (255 - iterator.buffer[iterator.offset] + 1) * -1;
      iterator.offset += 1;
      return value;
    } else {
      switch (iterator.buffer[iterator.offset]) {
        case 202: // float 32
          value = iterator.buffer.readFloatBE(iterator.offset += 1);
          iterator.offset += 4;
          return value;
        case 203: // float 64
          value = iterator.buffer.readDoubleBE(iterator.offset += 1);
          iterator.offset += 8;
          return value;
        case 204: // uint 8
          value = iterator.buffer.readUInt8(iterator.offset += 1);
          iterator.offset += 1;
          return value;
        case 205: // uint 16
          value = iterator.buffer.readUInt16BE(iterator.offset += 1);
          iterator.offset += 2;
          return value;
        case 206: // uint 32
          value = iterator.buffer.readUInt32BE(iterator.offset += 1);
          iterator.offset += 4;
          return value;
        case 207: // uint 64
          value = ( iterator.buffer.readUInt32BE(iterator.offset += 1) * Math.pow(2, 32) ) + iterator.buffer.readUInt32BE(iterator.offset += 4);
          iterator.offset += 4;
          return value;
        case 208: // int 8
          value = iterator.buffer.readInt8(iterator.offset += 1);
          iterator.offset += 1;
          return value;
        case 209: // int 16
          value = iterator.buffer.readInt16BE(iterator.offset += 1);
          iterator.offset += 2;
          return value;
        case 210: // int 32
          value = iterator.buffer.readInt32BE(iterator.offset += 1);
          iterator.offset += 4;
          return value;
        case 211: // int 64
          value = ( iterator.buffer.readInt32BE(iterator.offset += 1) * Math.pow(2, 32) ) + iterator.buffer.readUInt32BE(iterator.offset += 4);
          iterator.offset += 4;
          return value;

        case 217: // str 8
          length = iterator.buffer.readUInt8(iterator.offset += 1);
          iterator.offset += 1;
          value = iterator.buffer.toString('utf8', iterator.offset, iterator.offset + length);
          iterator.offset += length;
          return value;
        case 218: // str 16
          length = iterator.buffer.readUInt16BE(iterator.offset += 1);
          iterator.offset += 2;
          value = iterator.buffer.toString('utf8', iterator.offset, iterator.offset + length);
          iterator.offset += length;
          return value;
        case 219: // str 32
          length = iterator.buffer.readUInt32BE(iterator.offset += 1);
          iterator.offset += 4;
          value = iterator.buffer.toString('utf8', iterator.offset, iterator.offset + length);
          iterator.offset += length;
          return value;

        case 212: // fixext 1
          switch ( iterator.buffer.readInt8(iterator.offset += 1) ) { // fixext 1, type = ?
            case 0:
              switch ( iterator.buffer.readInt8(iterator.offset += 1) ) { // fixext 1, type = 0, data = ?
                case 0: // undefined, fixext 1, type = 0, data = 0
                  value = undefined;
                  iterator.offset += 1;
                  return value;
                case 1: // NaN, fixext 1, type = 0, data = 1
                  value = NaN;
                  iterator.offset += 1;
                  return value;
                case 2: // +Infinity, fixext 1, type = 0, data = 2
                  value = Infinity;
                  iterator.offset += 1;
                  return value;
                case 3: // -Infinity, fixext 1, type = 0, data = 3
                  value = -Infinity;
                  iterator.offset += 1;
                  return value;
              }
            break;
          }
          break;
        case 192: // nil
          value = null;
          iterator.offset += 1;
          return value;
        case 194: // false
          value = false;
          iterator.offset += 1;
          return value;
        case 195: // true
          value = true;
          iterator.offset += 1;
          return value;
        case 220: // array16
          length = iterator.buffer.readUInt16BE(iterator.offset += 1);
          iterator.offset += 2;
          value = new Array(length);
          for (let i = 0; i < length; i += 1) {
            value[i] = MessagePack.decode(undefined, true);
          }
          return value;
        case 221: // array32
          length = iterator.buffer.readUInt32BE(iterator.offset += 1);
          iterator.offset += 4;
          value = new Array(length);
          for (let i = 0; i < length; i += 1) {
            value[i] = MessagePack.decode(undefined, true);
          }
          return value;
        case 222: // map16
          length = iterator.buffer.readUInt16BE(iterator.offset += 1);
          value = {};
          iterator.offset += 2;
          if (dictionaryEnabled === true) {
            for (let i = 0, key; i < length; i++) {
              key = MessagePack.decode(undefined, true);
              value[dictionary[key] || key] = MessagePack.decode(undefined, true);
            }
          } else {
            for (let i = 0; i < length; i++) {
              value[MessagePack.decode(undefined, true)] = MessagePack.decode(undefined, true);
            }
          }
          return value;
        case 223: // map32
          length = iterator.buffer.readUInt32BE(iterator.offset += 1);
          value = {};
          iterator.offset += 4;
          if (dictionaryEnabled === true) {
            for (let i = 0, key; i < length; i++) {
              key = MessagePack.decode(undefined, true);
              value[dictionary[key] || key] = MessagePack.decode(undefined, true);
            }
          } else {
            for (let i = 0; i < length; i++) {
              value[MessagePack.decode(undefined, true)] = MessagePack.decode(undefined, true);
            }
          }
          return value;
        case 196: // bin8
          length = iterator.buffer.readUInt8(iterator.offset += 1);
          iterator.offset += 1;
          value = iterator.buffer.slice(iterator.offset, iterator.offset + length);
          iterator.offset += length;
          return value;
        case 197: // bin16
          length = iterator.buffer.readUInt16BE(iterator.offset += 1);
          iterator.offset += 2;
          value = iterator.buffer.slice(iterator.offset, iterator.offset + length);
          iterator.offset += length;
          return value;
        case 198: // bin32
          length = iterator.buffer.readUInt32BE(iterator.offset += 1);
          iterator.offset += 4;
          value = iterator.buffer.slice(iterator.offset, iterator.offset + length);
          iterator.offset += length;
          return value;
      }
      throw Error('Error decoding value.');
    }
  }
}

MessagePack.log = console.log;

module.exports = MessagePack;
