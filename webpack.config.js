const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: './src/index.tsx', // Entry point of your application
  output: {
    path: path.resolve(__dirname, 'build'), // Output directory
    filename: 'chat.[contenthash].js', // Name of the bundled file
    publicPath: '/', // Ensures assets are served correctly
    library: 'ChatApp',
    libraryTarget: 'umd',
    libraryExport: 'default',
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/, // Transpile .js, .jsx, .ts, and .tsx files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
          },
        },
      },
      {
        test: /\.css$/, // Process .css files
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new CopyPlugin({
      patterns: [{ from: 'public/favicon.ico', to: 'favicon.ico' }],
    }),
  ],
  devServer: {
    static: path.join(__dirname, 'build'),
    compress: true,
    port: 8004,
    hot: true, // Enable Hot Module Replacement
    historyApiFallback: true, // For single-page applications
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'], // Automatically resolve these extensions
  },
}
