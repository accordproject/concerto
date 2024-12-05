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
const TerserPlugin = require('terser-webpack-plugin'); // For minification

const packageJson = require('./package.json');

module.exports = {
    mode: 'production', // Explicit production mode for optimization
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'concerto-core.js',
        library: {
            name: 'concerto-core',
            type: 'umd',
        },
    },
    plugins: [
        new webpack.BannerPlugin(`Concerto v${packageJson.version}
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
                'NODE_ENV': JSON.stringify('production'),
            },
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'], // Polyfill Buffer
            process: 'process/browser',  // Shim global process variable
        }),
        new NodePolyfillPlugin(), // Add polyfills for Node.js core modules
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                include: [path.join(__dirname, 'lib')],
                use: ['babel-loader'], // Transpile JavaScript files
            },
            {
                test: /\.ne$/,
                use: ['raw-loader'], // Handle raw `.ne` files
            },
        ],
    },
    resolve: {
        fallback: {
            // Polyfills for Node.js core modules
            'fs': false,
            'tls': false,
            'net': false,
            'child_process': false,
            'os': require.resolve('os-browserify/browser'),
            'path': require.resolve('path-browserify'),
            'crypto': require.resolve('crypto-browserify'),
            'stream': require.resolve('stream-browserify'),
            'http': require.resolve('stream-http'),
            'https': require.resolve('https-browserify'),
            'zlib': require.resolve('browserify-zlib'),
        },
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()], // Minify output using Terser
    },
};
