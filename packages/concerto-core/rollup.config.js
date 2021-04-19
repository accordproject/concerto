'use strict';

const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const { babel } = require('@rollup/plugin-babel');
const { terser } = require('rollup-plugin-terser');
const pkg = require('./package.json');

module.exports = [
    {
        input: 'index.js',
        output: {
            name: 'concerto',
            file: pkg.browser,
            format: 'umd',
            exports: 'named'
        },
        plugins: [
            resolve(),
            json(),
            commonjs(),
            babel({ babelHelpers: 'bundled' }),
            terser(),
        ]
    },
];