/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const path = require('path');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

const packageJson = require('./package.json');

const emitWarningPollyfill = 'function(message, options){ console.warn({message: `DEPRECATED: ${message}`,type: options?.type,code: options?.code,detail: options?.detail});}';

module.exports = {
    mode: 'production', // Set the mode to production (as per your npm script)
    entry: './src/index.ts', // Update the entry point to src/index.ts
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'concerto-util.js',
        library: {
            name: 'concerto-util',
            type: 'umd',
        },
        globalObject: 'this', // Ensure compatibility with both browser and Node.js environments
    },
    plugins: [
        new webpack.BannerPlugin(`Concerto Util v${packageJson.version}
        Licensed under the Apache License, Version 2.0 (the "License");
        you may not use this file except in compliance with the License.
        You may obtain a copy of the License at
        http://www.apache.org/licenses/LICENSE-2.0
        Unless required by applicable law or agreed to in writing, software
        distributed under the License is distributed on an "AS IS" BASIS,
        WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
        See the License for the specific language governing permissions and
        limitations under the License.`),
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify('production')
            },
            'process.emitWarning': emitWarningPollyfill
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser', // Provide a shim for the global `process` variable
        }),
        new NodePolyfillPlugin(),
    ],
    module: {
        rules: [
            {
                test: /\.ts$/, // Add rule for TypeScript files
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.js$/, // Retain the rule for JavaScript files (if any remain)
                include: [path.join(__dirname, 'lib')],
                use: ['babel-loader'],
            },
            {
                test: /\.ne$/, // Retain the rule for .ne files
                use: ['raw-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'], // Add .ts to the list of resolved extensions
        fallback: {
            // Webpack 5 no longer polyfills Node.js core modules automatically.
            // See https://webpack.js.org/configuration/resolve/#resolvefallback
            // for the list of Node.js core module polyfills.
            'fs': false,
            'tls': false,
            'net': false,
            'child_process': false,
            'os': false,
            'path': false,
            // 'crypto': require.resolve('crypto-browserify'),
            // 'stream': require.resolve('stream-browserify'),
            // 'http': require.resolve('stream-http'),
            // 'https': require.resolve('https-browserify'),
            // 'zlib': require.resolve('browserify-zlib'),
            // 'vm2': require.resolve('vm-browserify'),
        },
    },
};