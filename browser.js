
/* eslint-disable no-console */

const pb = require('pretty-bytes');
const Buffer = require('buffer').Buffer;

const initialize = (tempBufferLength, logFunction) => {
  if (typeof tempBufferLength !== 'number' || Number.isNaN(tempBufferLength) === true) {
    throw Error('@initialize : expecting "tempBufferLength" to be a number.');
  }
  if (tempBufferLength < 1) {
    throw Error('@initialize : expecting "tempBufferLength" to be greater than zero.');
  }
  if (logFunction !== undefined) {
    if (typeof logFunction !== 'function') {
      throw Error('@initialize : expecting "logFunction" to be a function.');
    }
    logFunction(`@initialize : setting buffer limit to ${pb(tempBufferLength)}`);
  }
  const dictionary = {};
  let dictionaryEnabled = false;
  let dictionaryOffset = -33;
  /**
   * Why -33:
   * - This allows us to use the negative (-32 to -1) and positive fixint range (0 to 127)
   * - So instead of encoding the whole key string, we only encode a single byte
   * - That's (32 + 128) = 160 of your first entries being encoded in a single damn byte
   */
  const register = (...args) => {
    if (dictionaryEnabled === false) dictionaryEnabled = true;
    for (let i = 0, l = args.length; i < l; i += 1) {
      dictionaryOffset += 1;
      dictionary[dictionaryOffset] = args[i];
      dictionary[args[i]] = dictionaryOffset;
    }
  };
  const tempEncodeBuffer = Buffer.allocUnsafe(tempBufferLength).fill(0);
  let tempEncodeBufferOffset = -1;
  const internalEncode = (value) => {
    let length = 0;
    switch (typeof value) {
      case 'string':
        length = Buffer.byteLength(value);
        if (length < 32) { // < 32, fixstr
          length = 0;
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
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = length | 160;
          for (let i = 0, c = 0, l = value.length; i < l; i += 1) {
            c = value.charCodeAt(i);
            if (c < 128) {
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = c;
            } else if (c < 1280) {
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 192 | (c >> 6);
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 128 | (c & 63);
            } else if (c < 55296 || c >= 57344) {
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 224 | (c >> 12);
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 128 | (c >> 6) & 63;
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 128 | (c & 63);
            } else {
              i += 1;
              c = 65536 + (((c & 1023) << 10) | (value.charCodeAt(i) & 1023));
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 240 | (c >> 18);
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 128 | (c >> 12) & 63;
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 128 | (c >> 6) & 63;
              tempEncodeBuffer[tempEncodeBufferOffset += 1] = 128 | (c & 63);
            }
          }
        } else if (length < 256) { // str8
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = 217;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
          tempEncodeBuffer.write(value, tempEncodeBufferOffset += 1, length, 'utf8');
          tempEncodeBufferOffset += length - 1;
        } else if (length < 65536) { // str16
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = 218;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 8;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
          tempEncodeBuffer.write(value, tempEncodeBufferOffset += 1, length, 'utf8');
          tempEncodeBufferOffset += length - 1;
        } else if (length < 4294967296) { // str32
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = 219;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 24;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 16;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 8;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
          tempEncodeBuffer.write(value, tempEncodeBufferOffset += 1, length, 'utf8');
          tempEncodeBufferOffset += length - 1;
        } else {
          throw Error('@internalEncode : Max supported string length (4294967296) exceeded, encoding failure.');
        }
        break;
      case 'number':
        if (Number.isFinite(value) === false) {
          if (Number.isNaN(value) === true) { // NaN, fixext 1, type = 0, data = 1
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 212;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 0;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 1;
            break;
          }
          if (value === Infinity) { // +Infinity, fixext 1, type = 0, data = 2
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 212;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 0;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 2;
            break;
          }
          if (value === -Infinity) { // -Infinity, fixext 1, type = 0, data = 3
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 212;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 0;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 3;
            break;
          }
        }
        if (Math.floor(value) !== value) {
          if (Math.fround(value) === value) {
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 202;
            tempEncodeBuffer.writeFloatBE(value, tempEncodeBufferOffset += 1);
            tempEncodeBufferOffset += 3;
            break;
          } else {
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 203;
            tempEncodeBuffer.writeDoubleBE(value, tempEncodeBufferOffset += 1);
            tempEncodeBufferOffset += 7;
            break;
          }
        }
        if (value >= 0) {
          if (value < 128) { // positive fixint
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value;
            break;
          }
          if (value < 256) { // uint 8
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 204;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value;
            break;
          }
          if (value < 65536) {  // uint 16
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 205;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value;
            break;
          }
          if (value < 4294967296) { // uint 32
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 206;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value >> 24;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value >> 16;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value;
            break;
          }
          // uint 64
          let hi = (value / Math.pow(2, 32)) >> 0, lo = value >>> 0;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = 207;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = hi >> 24;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = hi >> 16;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = hi >> 8;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = hi;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = lo >> 24;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = lo >> 16;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = lo >> 8;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = lo;
        } else {
          if (value >= -32) { // negative fixint
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value;
            break;
          }
          if (value >= -128) { // int 8
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 208;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value;
            break;
          }
          if (value >= -12800) { // int 16
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 209;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value;
            break;
          }
          if (value >= -128000000) { // int 32
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 210;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value >> 24;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value >> 16;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = value;
            break;
          }
          // int 64
          let hi = Math.floor(value / Math.pow(2, 32)), lo = value >>> 0;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = 211;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = hi >> 24;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = hi >> 16;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = hi >> 8;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = hi;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = lo >> 24;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = lo >> 16;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = lo >> 8;
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = lo;
        }
        break;
      case 'object':
        if (value === null) { // null
          tempEncodeBuffer[tempEncodeBufferOffset += 1] = 192;
          break;
        }
        if (Array.isArray(value) === true) {
          length = value.length;
          if (length < 16) { // fixarray
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length | 144;
          } else if (length < 65536) { // array 16
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 220;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
          } else if (length < 4294967296) { // array 32
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 221;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 24;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 16;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
          } else {
            throw new Error('@internalEncode : Array too large');
          }
          for (let i = 0; i < length; i += 1) {
            internalEncode(value[i]);
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
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 196;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
            if (length > 32) {
              value.copy(tempEncodeBuffer, tempEncodeBufferOffset += 1, 0, length);
              tempEncodeBufferOffset += length - 1;
            } else {
              for (let i = 0; i < length; i++) {
                tempEncodeBuffer[tempEncodeBufferOffset += 1] = value[i];
              }
            }
          } else if (length < 65536) { // bin16
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 197;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
            value.copy(tempEncodeBuffer, tempEncodeBufferOffset += 1, 0, length);
            tempEncodeBufferOffset += length - 1;
          } else if (length < 4294967296) { // bin32
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 198;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 24;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 16;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
            value.copy(tempEncodeBuffer, tempEncodeBufferOffset += 1, 0, length);
            tempEncodeBufferOffset += length - 1;
          } else {
            throw Error('@internalEncode : Max supported buffer length (4294967296) exceeded, encoding failure.');
          }
          break;
        } else { // plain javascript object
          let keys = Object.keys(value);
          length = keys.length;
          if (length < 16) { // fixmap
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length | 128;
          } else if (length < 65536) { // map16
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 222;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
          } else if (length < 4294967296) { // map32
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 223;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 24;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 16;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length >> 8;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = length;
          } else {
            throw new Error('@internalEncode : Object too large');
          }
          if (dictionaryEnabled === true) {
            for (let i = 0; i < length; i += 1) {
              internalEncode(dictionary[keys[i]] || keys[i]);
              internalEncode(value[keys[i]]);
            }
          } else {
            for (let i = 0; i < length; i += 1) {
              internalEncode(keys[i]);
              internalEncode(value[keys[i]]);
            }
          }
        }
        break;
      default:
        switch (value) {
          case true:  // true
            tempEncodeBuffer[tempEncodeBufferOffset += 1] =  195;
            break;
          case false: // false
            tempEncodeBuffer[tempEncodeBufferOffset += 1] =  194;
            break;
          case undefined: // undefined, fixext 1, type = 0, data = 0
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 212;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 0;
            tempEncodeBuffer[tempEncodeBufferOffset += 1] = 0;
            break;
          default:
            throw Error('@internalEncode : Error encoding value.');
        }
    }
  };
  const encode = (value) => {
    tempEncodeBufferOffset = -1;
    internalEncode(value);
    const encoded = Buffer.allocUnsafe(tempEncodeBufferOffset + 1).fill(0);
    tempEncodeBuffer.copy(encoded, 0, 0, tempEncodeBufferOffset + 1);
    return encoded;
  };
  let tempDecodeBuffer = undefined;
  let tempDecodeBufferOffset = 0;
  const internalDecode = () => {
    let value, length;
    if (tempDecodeBuffer[tempDecodeBufferOffset] < 192) {
      if (tempDecodeBuffer[tempDecodeBufferOffset] < 128) { // positive fixint
        value = tempDecodeBuffer[tempDecodeBufferOffset];
        tempDecodeBufferOffset += 1;
        return value;
      } else if (tempDecodeBuffer[tempDecodeBufferOffset] < 144) { // fixmap
        length = tempDecodeBuffer[tempDecodeBufferOffset] & 31;
        value = {};
        tempDecodeBufferOffset += 1;
        if (dictionaryEnabled === true) {
          for (let i = 0, key; i < length; i++) {
            key = internalDecode();
            value[dictionary[key] || key] = internalDecode();
          }
        } else {
          for (let i = 0; i < length; i++) {
            value[internalDecode()] = internalDecode();
          }
        }
        return value;
      } else if (tempDecodeBuffer[tempDecodeBufferOffset] < 160) { // fixarray
        length = tempDecodeBuffer[tempDecodeBufferOffset] & 15;
        tempDecodeBufferOffset += 1;
        value = new Array(length);
        for (let i = 0; i < length; i += 1) {
          value[i] = internalDecode();
        }
        return value;
      } else { // fixstr
        length = tempDecodeBuffer[tempDecodeBufferOffset] & 31;
        tempDecodeBufferOffset += 1;
        value = tempDecodeBuffer.toString('utf8', tempDecodeBufferOffset, tempDecodeBufferOffset + length);
        tempDecodeBufferOffset += length;
        return value;
      }
    } else if (tempDecodeBuffer[tempDecodeBufferOffset] > 223) { // negative fixint
      value = (255 - tempDecodeBuffer[tempDecodeBufferOffset] + 1) * -1;
      tempDecodeBufferOffset += 1;
      return value;
    } else {
      switch (tempDecodeBuffer[tempDecodeBufferOffset]) {
        case 202: // float 32
          value = tempDecodeBuffer.readFloatBE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 4;
          return value;
        case 203: // float 64
          value = tempDecodeBuffer.readDoubleBE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 8;
          return value;
        case 204: // uint 8
          value = tempDecodeBuffer.readUInt8(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 1;
          return value;
        case 205: // uint 16
          value = tempDecodeBuffer.readUInt16BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 2;
          return value;
        case 206: // uint 32
          value = tempDecodeBuffer.readUInt32BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 4;
          return value;
        case 207: // uint 64
          value = ( tempDecodeBuffer.readUInt32BE(tempDecodeBufferOffset += 1) * Math.pow(2, 32) ) + tempDecodeBuffer.readUInt32BE(tempDecodeBufferOffset += 4);
          tempDecodeBufferOffset += 4;
          return value;
        case 208: // int 8
          value = tempDecodeBuffer.readInt8(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 1;
          return value;
        case 209: // int 16
          value = tempDecodeBuffer.readInt16BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 2;
          return value;
        case 210: // int 32
          value = tempDecodeBuffer.readInt32BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 4;
          return value;
        case 211: // int 64
          value = ( tempDecodeBuffer.readInt32BE(tempDecodeBufferOffset += 1) * Math.pow(2, 32) ) + tempDecodeBuffer.readUInt32BE(tempDecodeBufferOffset += 4);
          tempDecodeBufferOffset += 4;
          return value;

        case 217: // str 8
          length = tempDecodeBuffer.readUInt8(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 1;
          value = tempDecodeBuffer.toString('utf8', tempDecodeBufferOffset, tempDecodeBufferOffset + length);
          tempDecodeBufferOffset += length;
          return value;
        case 218: // str 16
          length = tempDecodeBuffer.readUInt16BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 2;
          value = tempDecodeBuffer.toString('utf8', tempDecodeBufferOffset, tempDecodeBufferOffset + length);
          tempDecodeBufferOffset += length;
          return value;
        case 219: // str 32
          length = tempDecodeBuffer.readUInt32BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 4;
          value = tempDecodeBuffer.toString('utf8', tempDecodeBufferOffset, tempDecodeBufferOffset + length);
          tempDecodeBufferOffset += length;
          return value;

        case 212: // fixext 1
          switch ( tempDecodeBuffer.readInt8(tempDecodeBufferOffset += 1) ) { // fixext 1, type = ?
            case 0:
              switch ( tempDecodeBuffer.readInt8(tempDecodeBufferOffset += 1) ) { // fixext 1, type = 0, data = ?
                case 0: // undefined, fixext 1, type = 0, data = 0
                  value = undefined;
                  tempDecodeBufferOffset += 1;
                  return value;
                case 1: // NaN, fixext 1, type = 0, data = 1
                  value = NaN;
                  tempDecodeBufferOffset += 1;
                  return value;
                case 2: // +Infinity, fixext 1, type = 0, data = 2
                  value = Infinity;
                  tempDecodeBufferOffset += 1;
                  return value;
                case 3: // -Infinity, fixext 1, type = 0, data = 3
                  value = -Infinity;
                  tempDecodeBufferOffset += 1;
                  return value;
              }
            break;
          }
          break;
        case 192: // nil
          value = null;
          tempDecodeBufferOffset += 1;
          return value;
        case 194: // false
          value = false;
          tempDecodeBufferOffset += 1;
          return value;
        case 195: // true
          value = true;
          tempDecodeBufferOffset += 1;
          return value;
        case 220: // array16
          length = tempDecodeBuffer.readUInt16BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 2;
          value = new Array(length);
          for (let i = 0; i < length; i += 1) {
            value[i] = internalDecode();
          }
          return value;
        case 221: // array32
          length = tempDecodeBuffer.readUInt32BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 4;
          value = new Array(length);
          for (let i = 0; i < length; i += 1) {
            value[i] = internalDecode();
          }
          return value;
        case 222: // map16
          length = tempDecodeBuffer.readUInt16BE(tempDecodeBufferOffset += 1);
          value = {};
          tempDecodeBufferOffset += 2;
          if (dictionaryEnabled === true) {
            for (let i = 0, key; i < length; i++) {
              key = internalDecode();
              value[dictionary[key] || key] = internalDecode();
            }
          } else {
            for (let i = 0; i < length; i++) {
              value[internalDecode()] = internalDecode();
            }
          }
          return value;
        case 223: // map32
          length = tempDecodeBuffer.readUInt32BE(tempDecodeBufferOffset += 1);
          value = {};
          tempDecodeBufferOffset += 4;
          if (dictionaryEnabled === true) {
            for (let i = 0, key; i < length; i++) {
              key = internalDecode();
              value[dictionary[key] || key] = internalDecode();
            }
          } else {
            for (let i = 0; i < length; i++) {
              value[internalDecode()] = internalDecode();
            }
          }
          return value;
        case 196: // bin8
          length = tempDecodeBuffer.readUInt8(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 1;
          value = tempDecodeBuffer.slice(tempDecodeBufferOffset, tempDecodeBufferOffset + length);
          tempDecodeBufferOffset += length;
          return value;
        case 197: // bin16
          length = tempDecodeBuffer.readUInt16BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 2;
          value = tempDecodeBuffer.slice(tempDecodeBufferOffset, tempDecodeBufferOffset + length);
          tempDecodeBufferOffset += length;
          return value;
        case 198: // bin32
          length = tempDecodeBuffer.readUInt32BE(tempDecodeBufferOffset += 1);
          tempDecodeBufferOffset += 4;
          value = tempDecodeBuffer.slice(tempDecodeBufferOffset, tempDecodeBufferOffset + length);
          tempDecodeBufferOffset += length;
          return value;
      }
      throw Error('@internalDecode : Error decoding value.');
    }
  };
  const decode = (buffer) => {
    tempDecodeBuffer = buffer;
    tempDecodeBufferOffset = 0;
    const result = internalDecode();
    tempDecodeBuffer = undefined;
    return result;
  };
  return { encode, decode, register };
};

module.exports = { initialize, Buffer };