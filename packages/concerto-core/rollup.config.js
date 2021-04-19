import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { babel } from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

export default [
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