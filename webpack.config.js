const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { config } = require('./package.json');

module.exports = (env = {}) => {
  const isDev = env.development;
  const isProduction = env.production;

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      index: './src/simple-index.js',
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'build'),
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          // 复制 Zotero 插件必需文件
          {
            from: 'addon/install.rdf',
            to: 'install.rdf',
          },
          {
            from: 'addon/chrome.manifest',
            to: 'chrome.manifest',
          },
          {
            from: 'addon/bootstrap.js',
            to: 'bootstrap.js',
          },
          {
            from: 'addon/chrome/',
            to: 'chrome/',
          },
        ],
      }),
    ],
    devtool: isDev ? 'source-map' : false,
    optimization: {
      minimize: isProduction,
    },
  };
};