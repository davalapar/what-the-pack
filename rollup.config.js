const { terser } = require('rollup-plugin-terser');
const commonjs = require('rollup-plugin-commonjs');
const node = require('rollup-plugin-node-resolve');

export default {
  input: 'browser.js',
  output: {
    file: 'dist/MessagePack.min.js',
    format: 'umd',
    name: 'MessagePack',
    sourcemap: true,
    exports: 'named'
  },
  plugins: [node({ preferBuiltins: false }), commonjs(), terser()]
}
