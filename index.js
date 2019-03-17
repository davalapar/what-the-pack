/* eslint-disable no-console */

const pb = require('pretty-bytes');

const initialize = (tempEncodeArrayLength, logFunction) => {
  if (typeof tempEncodeArrayLength !== 'number' || Number.isNaN(tempEncodeArrayLength) === true) {
    throw Error('@initialize : expecting "tempEncodeArrayLength" to be a number.');
  }
  if (tempEncodeArrayLength < 1) {
    throw Error('@initialize : expecting "tempEncodeArrayLength" to be greater than zero.');
  }
  if (logFunction !== undefined) {
    if (typeof logFunction !== 'function') {
      throw Error('@initialize : expecting "logFunction" to be a function.');
    }
    logFunction(`@initialize : setting buffer limit to ${pb(tempEncodeArrayLength)}`);
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
  const tempEncodeArray = new Uint8Array(tempEncodeArrayLength);
  let tempEncodeArrayOffset = -1;
  
  
  // Temporary buffers to convert numbers.
  const float32Array = new Float32Array(1);
  const uInt8Float32Array = new Uint8Array(float32Array.buffer);
  const float64Array = new Float64Array(1);
  const uInt8Float64Array = new Uint8Array(float64Array.buffer);
  const writeFloatBE = (value) => {
    float32Array[0] = value;
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float32Array[0];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float32Array[1];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float32Array[2];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float32Array[3];
  }  
  const writeDoubleBE = (value) => {
    float64Array[0] = value;
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float64Array[0];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float64Array[1];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float64Array[2];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float64Array[3];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float64Array[4];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float64Array[5];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float64Array[6];
    tempEncodeArray[tempEncodeArrayOffset += 1] = uInt8Float64Array[7];
  }

  const internalEncode = (value) => {
    let length = 0;
    switch (typeof value) {
      case 'string':
        /**
         * refactor to convert from double-pass to single-pass:
         * - pad offset to 4
         * - use copyWithin to re-adjust
         */
        // total length calculation
        length = 0;
        for (let a = 0, b = 0, c = value.length; a < c; a += 1) {
          b = value.charCodeAt(a);
          if (b < 128) {
            length += 1;
          } else if (b < 1280) {
            length += 2;
          } else if (b < 55296 || b >= 57344) {
            length += 3;
          } else {
            a += 1;
            length += 4;
          }
        }

        // encoding of format
        if (length < 32) { // fixstr
          tempEncodeArray[tempEncodeArrayOffset += 1] = length | 160;
        } else if (length < 256) { // str8
          tempEncodeArray[tempEncodeArrayOffset += 1] = 217;
          tempEncodeArray[tempEncodeArrayOffset += 1] = length;
          tempEncodeArray[tempEncodeArrayOffset += 1] = value;
        } else if (length < 65536) { // str16
          tempEncodeArray[tempEncodeArrayOffset += 1] = 218;
          tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 8;
          tempEncodeArray[tempEncodeArrayOffset += 1] = length;
        } else if (length < 4294967296) { // str32
          tempEncodeArray[tempEncodeArrayOffset += 1] = 219;
          tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 24;
          tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 16;
          tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 8;
          tempEncodeArray[tempEncodeArrayOffset += 1] = length;
        } else {
          throw Error('@internalEncode : Max supported string length (4294967296) exceeded, encoding failure.');
        }

        // encoding of each character
        for (let a = 0, b = 0, c = value.length; a < c; a += 1) {
          b = value.charCodeAt(a);
          if (b < 128) {
            tempEncodeArray[tempEncodeArrayOffset += 1] = b;
          } else if (b < 1280) {
            tempEncodeArray[tempEncodeArrayOffset += 1] = 192 | (b >> 6);
            tempEncodeArray[tempEncodeArrayOffset += 1] = 128 | (b & 63);
          } else if (b < 55296 || b >= 57344) {
            tempEncodeArray[tempEncodeArrayOffset += 1] = 224 | (b >> 12);
            tempEncodeArray[tempEncodeArrayOffset += 1] = 128 | (b >> 6) & 63;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 128 | (b & 63);
          } else {
            a += 1;
            b = 65536 + (((b & 1023) << 10) | (value.charCodeAt(a) & 1023));
            tempEncodeArray[tempEncodeArrayOffset += 1] = 240 | (b >> 18);
            tempEncodeArray[tempEncodeArrayOffset += 1] = 128 | (b >> 12) & 63;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 128 | (b >> 6) & 63;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 128 | (b & 63);
          }
        }

        break;
      case 'number':
        if (Number.isFinite(value) === false) {
          if (Number.isNaN(value) === true) { // NaN, fixext 1, type = 0, data = 1
            tempEncodeArray[tempEncodeArrayOffset += 1] = 212;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 0;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 1;
            break;
          }
          if (value === Infinity) { // +Infinity, fixext 1, type = 0, data = 2
            tempEncodeArray[tempEncodeArrayOffset += 1] = 212;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 0;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 2;
            break;
          }
          if (value === -Infinity) { // -Infinity, fixext 1, type = 0, data = 3
            tempEncodeArray[tempEncodeArrayOffset += 1] = 212;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 0;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 3;
            break;
          }
        }
        if (Math.floor(value) !== value) {
          if (Math.fround(value) === value) {
            tempEncodeArray[tempEncodeArrayOffset += 1] = 202;
            writeFloatBE(value);
            break;
          } else {
            tempEncodeArray[tempEncodeArrayOffset += 1] = 203;
            writeDoubleBE(value);
            break;
          }
        }
        if (value >= 0) {
          if (value < 128) { // positive fixint
            tempEncodeArray[tempEncodeArrayOffset += 1] = value;
            break;
          }
          if (value < 256) { // uint 8
            tempEncodeArray[tempEncodeArrayOffset += 1] = 204;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value;
            break;
          }
          if (value < 65536) {  // uint 16
            tempEncodeArray[tempEncodeArrayOffset += 1] = 205;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value;
            break;
          }
          if (value < 4294967296) { // uint 32
            tempEncodeArray[tempEncodeArrayOffset += 1] = 206;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value >> 24;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value >> 16;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value;
            break;
          }
          // uint 64
          let hi = (value / Math.pow(2, 32)) >> 0, lo = value >>> 0;
          tempEncodeArray[tempEncodeArrayOffset += 1] = 207;
          tempEncodeArray[tempEncodeArrayOffset += 1] = hi >> 24;
          tempEncodeArray[tempEncodeArrayOffset += 1] = hi >> 16;
          tempEncodeArray[tempEncodeArrayOffset += 1] = hi >> 8;
          tempEncodeArray[tempEncodeArrayOffset += 1] = hi;
          tempEncodeArray[tempEncodeArrayOffset += 1] = lo >> 24;
          tempEncodeArray[tempEncodeArrayOffset += 1] = lo >> 16;
          tempEncodeArray[tempEncodeArrayOffset += 1] = lo >> 8;
          tempEncodeArray[tempEncodeArrayOffset += 1] = lo;
        } else {
          if (value >= -32) { // negative fixint
            tempEncodeArray[tempEncodeArrayOffset += 1] = value;
            break;
          }
          if (value >= -128) { // int 8
            tempEncodeArray[tempEncodeArrayOffset += 1] = 208;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value;
            break;
          }
          if (value >= -12800) { // int 16
            tempEncodeArray[tempEncodeArrayOffset += 1] = 209;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value;
            break;
          }
          if (value >= -128000000) { // int 32
            tempEncodeArray[tempEncodeArrayOffset += 1] = 210;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value >> 24;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value >> 16;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = value;
            break;
          }
          // int 64
          let hi = Math.floor(value / Math.pow(2, 32)), lo = value >>> 0;
          tempEncodeArray[tempEncodeArrayOffset += 1] = 211;
          tempEncodeArray[tempEncodeArrayOffset += 1] = hi >> 24;
          tempEncodeArray[tempEncodeArrayOffset += 1] = hi >> 16;
          tempEncodeArray[tempEncodeArrayOffset += 1] = hi >> 8;
          tempEncodeArray[tempEncodeArrayOffset += 1] = hi;
          tempEncodeArray[tempEncodeArrayOffset += 1] = lo >> 24;
          tempEncodeArray[tempEncodeArrayOffset += 1] = lo >> 16;
          tempEncodeArray[tempEncodeArrayOffset += 1] = lo >> 8;
          tempEncodeArray[tempEncodeArrayOffset += 1] = lo;
        }
        break;
      case 'object':
        if (value === null) { // null
          tempEncodeArray[tempEncodeArrayOffset += 1] = 192;
          break;
        }
        if (Array.isArray(value) === true) {
          length = value.length;
          if (length < 16) { // fixarray
            tempEncodeArray[tempEncodeArrayOffset += 1] = length | 144;
          } else if (length < 65536) { // array 16
            tempEncodeArray[tempEncodeArrayOffset += 1] = 220;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length;
          } else if (length < 4294967296) { // array 32
            tempEncodeArray[tempEncodeArrayOffset += 1] = 221;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 24;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 16;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length;
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
            tempEncodeArray[tempEncodeArrayOffset += 1] = 196;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length;
            if (length > 32) {
              value.copy(tempEncodeBuffer, tempEncodeArrayOffset += 1, 0, length);
              tempEncodeArrayOffset += length - 1;
            } else {
              for (let i = 0; i < length; i++) {
                tempEncodeArray[tempEncodeArrayOffset += 1] = value[i];
              }
            }
          } else if (length < 65536) { // bin16
            tempEncodeArray[tempEncodeArrayOffset += 1] = 197;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length;
            value.copy(tempEncodeBuffer, tempEncodeArrayOffset += 1, 0, length);
            tempEncodeArrayOffset += length - 1;
          } else if (length < 4294967296) { // bin32
            tempEncodeArray[tempEncodeArrayOffset += 1] = 198;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 24;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 16;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length;
            value.copy(tempEncodeBuffer, tempEncodeArrayOffset += 1, 0, length);
            tempEncodeArrayOffset += length - 1;
          } else {
            throw Error('@internalEncode : Max supported buffer length (4294967296) exceeded, encoding failure.');
          }
          break;
        } else { // plain javascript object
          let keys = Object.keys(value);
          length = keys.length;
          if (length < 16) { // fixmap
            tempEncodeArray[tempEncodeArrayOffset += 1] = length | 128;
          } else if (length < 65536) { // map16
            tempEncodeArray[tempEncodeArrayOffset += 1] = 222;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length;
          } else if (length < 4294967296) { // map32
            tempEncodeArray[tempEncodeArrayOffset += 1] = 223;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 24;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 16;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length >> 8;
            tempEncodeArray[tempEncodeArrayOffset += 1] = length;
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
            tempEncodeArray[tempEncodeArrayOffset += 1] =  195;
            break;
          case false: // false
            tempEncodeArray[tempEncodeArrayOffset += 1] =  194;
            break;
          case undefined: // undefined, fixext 1, type = 0, data = 0
            tempEncodeArray[tempEncodeArrayOffset += 1] = 212;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 0;
            tempEncodeArray[tempEncodeArrayOffset += 1] = 0;
            break;
          default:
            throw Error('@internalEncode : Error encoding value.');
        }
    }
  };
  const encode = (value) => {
    try {
      tempEncodeArrayOffset = -1;
      internalEncode(value);
      const encoded = new Uint8Array(tempEncodeArray);
      return encoded;
    } catch (e) {
      throw Error(`Encode error : ${e.message}`);
    }
  };
  let tempDecodeArray = undefined;
  let tempDecodeArrayOffset = 0;
  
  const decodeCodePointsArray = (codePoints) => {
    var len = codePoints.length
    if (len <= 4096) {
      return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    var res = ''
    var i = 0
    while (i < len) {
      res += String.fromCharCode.apply(
        String,
        codePoints.slice(i, i += 4096)
      )
    }
    return res
  }
  const utf8Slice = (buf, start, end) => {
    end = Math.min(buf.length, end)
    var res = []

    var i = start
    while (i < end) {
      var firstByte = buf[i]
      var codePoint = null
      var bytesPerSequence = (firstByte > 0xEF) ? 4
        : (firstByte > 0xDF) ? 3
          : (firstByte > 0xBF) ? 2
            : 1

      if (i + bytesPerSequence <= end) {
        var secondByte, thirdByte, fourthByte, tempCodePoint

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte
            }
            break
          case 2:
            secondByte = buf[i + 1]
            if ((secondByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
              if (tempCodePoint > 0x7F) {
                codePoint = tempCodePoint
              }
            }
            break
          case 3:
            secondByte = buf[i + 1]
            thirdByte = buf[i + 2]
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
              if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                codePoint = tempCodePoint
              }
            }
            break
          case 4:
            secondByte = buf[i + 1]
            thirdByte = buf[i + 2]
            fourthByte = buf[i + 3]
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
              if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xFFFD
        bytesPerSequence = 1
      } else if (codePoint > 0xFFFF) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000
        res.push(codePoint >>> 10 & 0x3FF | 0xD800)
        codePoint = 0xDC00 | codePoint & 0x3FF
      }

      res.push(codePoint)
      i += bytesPerSequence
    }

    return decodeCodePointsArray(res)
  }
  const readUInt8 = () => {
    return tempDecodeArray[tempDecodeArrayOffset += 1];
  };
  const readUInt16BE = () => {
    return tempDecodeArray[tempDecodeArrayOffset += 1] * 2 ** 8 + tempDecodeArray[tempDecodeArrayOffset += 1];
  };
  const readUInt32BE = () => {
    return tempDecodeArray[tempDecodeArrayOffset += 1] * 2 ** 24 +
      tempDecodeArray[tempDecodeArrayOffset += 1] * 2 ** 16 +
      tempDecodeArray[tempDecodeArrayOffset += 1] * 2 ** 8 +
      tempDecodeArray[tempDecodeArrayOffset += 1];
  };
  const internalDecode = () => {
    let value, length;
    if (tempDecodeArray[tempDecodeArrayOffset] < 192) {
      if (tempDecodeArray[tempDecodeArrayOffset] < 128) { // positive fixint
        value = tempDecodeArray[tempDecodeArrayOffset];
        tempDecodeArrayOffset += 1;
        return value;
      } else if (tempDecodeArray[tempDecodeArrayOffset] < 144) { // fixmap
        length = tempDecodeArray[tempDecodeArrayOffset] & 31;
        value = {};
        tempDecodeArrayOffset += 1;
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
      } else if (tempDecodeArray[tempDecodeArrayOffset] < 160) { // fixarray
        length = tempDecodeArray[tempDecodeArrayOffset] & 15;
        tempDecodeArrayOffset += 1;
        value = new Array(length);
        for (let i = 0; i < length; i += 1) {
          value[i] = internalDecode();
        }
        return value;
      } else { // fixstr
        length = tempDecodeArray[tempDecodeArrayOffset] & 31;
        tempDecodeArrayOffset += 1;
        value = utf8Slice(tempDecodeArray, tempDecodeArrayOffset, tempDecodeArrayOffset + length);
        tempDecodeArrayOffset += length;
        return value;
      }
    } else if (tempDecodeArray[tempDecodeArrayOffset] > 223) { // negative fixint
      value = (255 - tempDecodeArray[tempDecodeArrayOffset] + 1) * -1;
      tempDecodeArrayOffset += 1;
      return value;
    } else {
      switch (tempDecodeArray[tempDecodeArrayOffset]) {
        case 202: // float 32
          value = tempDecodeBuffer.readFloatBE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 4;
          return value;
        case 203: // float 64
          value = tempDecodeBuffer.readDoubleBE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 8;
          return value;
        case 204: // uint 8
          value = tempDecodeBuffer.readUInt8(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 1;
          return value;
        case 205: // uint 16
          value = tempDecodeBuffer.readUInt16BE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 2;
          return value;
        case 206: // uint 32
          value = tempDecodeBuffer.readUInt32BE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 4;
          return value;
        case 207: // uint 64
          value = ( tempDecodeBuffer.readUInt32BE(tempDecodeArrayOffset += 1) * Math.pow(2, 32) ) + tempDecodeBuffer.readUInt32BE(tempDecodeArrayOffset += 4);
          tempDecodeArrayOffset += 4;
          return value;
        case 208: // int 8
          value = tempDecodeBuffer.readInt8(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 1;
          return value;
        case 209: // int 16
          value = tempDecodeBuffer.readInt16BE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 2;
          return value;
        case 210: // int 32
          value = tempDecodeBuffer.readInt32BE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 4;
          return value;
        case 211: // int 64
          value = ( tempDecodeBuffer.readInt32BE(tempDecodeArrayOffset += 1) * Math.pow(2, 32) ) + tempDecodeBuffer.readUInt32BE(tempDecodeArrayOffset += 4);
          tempDecodeArrayOffset += 4;
          return value;

        case 217: // str 8
          length = readUInt8();
          tempDecodeArrayOffset += 1;
          value = utf8Slice(tempDecodeArray, tempDecodeArrayOffset += 1, tempDecodeArrayOffset + length);
          tempDecodeArrayOffset += length;
          return value;
        case 218: // str 16
          length = readUInt16BE();
          value = utf8Slice(tempDecodeArray, tempDecodeArrayOffset += 1, tempDecodeArrayOffset + length);
          tempDecodeArrayOffset += length;
          return value;
        case 219: // str 32
          length = readUInt32BE();
          value = utf8Slice(tempDecodeArray, tempDecodeArrayOffset += 1, tempDecodeArrayOffset + length);
          tempDecodeArrayOffset += length;
          return value;

        case 212: // fixext 1
          switch ( tempDecodeBuffer.readInt8(tempDecodeArrayOffset += 1) ) { // fixext 1, type = ?
            case 0:
              switch ( tempDecodeBuffer.readInt8(tempDecodeArrayOffset += 1) ) { // fixext 1, type = 0, data = ?
                case 0: // undefined, fixext 1, type = 0, data = 0
                  value = undefined;
                  tempDecodeArrayOffset += 1;
                  return value;
                case 1: // NaN, fixext 1, type = 0, data = 1
                  value = NaN;
                  tempDecodeArrayOffset += 1;
                  return value;
                case 2: // +Infinity, fixext 1, type = 0, data = 2
                  value = Infinity;
                  tempDecodeArrayOffset += 1;
                  return value;
                case 3: // -Infinity, fixext 1, type = 0, data = 3
                  value = -Infinity;
                  tempDecodeArrayOffset += 1;
                  return value;
              }
            break;
          }
          break;
        case 192: // nil
          value = null;
          tempDecodeArrayOffset += 1;
          return value;
        case 194: // false
          value = false;
          tempDecodeArrayOffset += 1;
          return value;
        case 195: // true
          value = true;
          tempDecodeArrayOffset += 1;
          return value;
        case 220: // array16
          length = tempDecodeBuffer.readUInt16BE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 2;
          value = new Array(length);
          for (let i = 0; i < length; i += 1) {
            value[i] = internalDecode();
          }
          return value;
        case 221: // array32
          length = tempDecodeBuffer.readUInt32BE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 4;
          value = new Array(length);
          for (let i = 0; i < length; i += 1) {
            value[i] = internalDecode();
          }
          return value;
        case 222: // map16
          length = tempDecodeBuffer.readUInt16BE(tempDecodeArrayOffset += 1);
          value = {};
          tempDecodeArrayOffset += 2;
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
          length = tempDecodeBuffer.readUInt32BE(tempDecodeArrayOffset += 1);
          value = {};
          tempDecodeArrayOffset += 4;
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
          length = tempDecodeBuffer.readUInt8(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 1;
          value = tempDecodeBuffer.slice(tempDecodeArrayOffset, tempDecodeArrayOffset + length);
          tempDecodeArrayOffset += length;
          return value;
        case 197: // bin16
          length = tempDecodeBuffer.readUInt16BE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 2;
          value = tempDecodeBuffer.slice(tempDecodeArrayOffset, tempDecodeArrayOffset + length);
          tempDecodeArrayOffset += length;
          return value;
        case 198: // bin32
          length = tempDecodeBuffer.readUInt32BE(tempDecodeArrayOffset += 1);
          tempDecodeArrayOffset += 4;
          value = tempDecodeBuffer.slice(tempDecodeArrayOffset, tempDecodeArrayOffset + length);
          tempDecodeArrayOffset += length;
          return value;
      }
      throw Error('@internalDecode : Error decoding value.');
    }
  };
  const decode = (buffer) => {
    try {
      tempDecodeArray = buffer;
      tempDecodeArrayOffset = 0;
      const result = internalDecode();
      tempDecodeArray = undefined;
      return result;
    } catch (e) {
      const error = new Error(`Decode error : ${e.message}`);
      error.stack = e.stack;
      throw error;
    }
  };
  return { encode, decode, register };
};

module.exports = { initialize };