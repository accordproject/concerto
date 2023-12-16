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

function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    fs: false,
    tls: false,
    net: false,
    child_process: false,
    os: false,
    path: false,
    // Add other fallbacks as needed
  });
  config.resolve.fallback = fallback;

  const plugins = config.plugins || [];
  plugins.push(
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
      }
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser', // provide a shim for the global `process` variable
    }),
    new NodePolyfillPlugin(),
  );

  config.plugins = plugins;

  return config;
}

module.exports = override({
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'concerto-util.js',
    library: {
      name: 'concerto-util',
      type: 'umd',
    },
  },
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
      // Add other fallbacks as needed
    }
  }
});
