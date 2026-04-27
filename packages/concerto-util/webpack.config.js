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

let path = require('path');
const webpack = require('webpack');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

const packageJson = require('./package.json');

const emitWarningPollyfill = 'function(message, options){ console.warn({message: `DEPRECATED: ${message}`,type: options?.type,code: options?.code,detail: options?.detail});}';

module.exports = {
    entry: './dist/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'concerto-util.js',
        library: {
            name: 'concerto-util',
            type: 'umd',
        },
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
            process: 'process/browser', // provide a shim for the global `process` variable
        }),
        new NodePolyfillPlugin(),],
    module: {
        rules: [
            {
                test: /\.js$/,
                include: [path.join(__dirname, 'lib')],
                use: ['babel-loader']
            },
            {
                test: /\.ne$/,
                use: ['raw-loader']
            }
        ]
    },
    resolve: {
        fallback: {
            // Webpack 5 no longer polyfills Node.js core modules automatically.
            // see https://webpack.js.org/configuration/resolve/#resolvefallback
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
        }
    }
};
