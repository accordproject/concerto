import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from "rollup-plugin-terser";
import pkg from './package.json';

export default [
	// browser-friendly UMD build
	{
		input: 'index.js',
		output: {
			name: 'concerto',
			file: pkg.browser,
			format: 'iife',
      exports: 'named'
		},
		plugins: [
			resolve(),
			commonjs(),
      json(),
      terser(),
		]
	},
];