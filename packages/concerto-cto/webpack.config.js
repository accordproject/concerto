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

const packageJson = require('./package.json');

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    path: require.resolve('path-browserify'),
    // Add other fallbacks as needed
  });
  config.resolve.fallback = fallback;

  const plugins = config.plugins || [];
  plugins.push(
    new webpack.BannerPlugin(`Concerto CTO v${packageJson.version}
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
    })
  );

  config.plugins = plugins;

  return config;
};

// Rest of the webpack configuration
module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'concerto-cto.js',
    library: {
      name: 'concerto-cto',
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
      'path': 'path-browserify'
    }
  }
};
