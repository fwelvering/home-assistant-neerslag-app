// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');

const isProduction = process.env.NODE_ENV == 'production';

const TerserPlugin = require("terser-webpack-plugin");


const config = {
    entry: './neerslag-card.src.js',
    output: {
        path: path.resolve(__dirname, '../custom_components/neerslag/home-assistant-neerslag-card'),
        filename: 'neerslag-card.js',
    },
    plugins: [
        // Add your plugins here
        // Learn more about plugins from https://webpack.js.org/configuration/plugins/
    ],
    optimization: {
        minimize: true,
        // minimizer: [
        //     new TerserPlugin({
        //       minify: TerserPlugin.uglifyJsMinify,
        //       // `terserOptions` options will be passed to `uglify-js`
        //       // Link to options - https://github.com/mishoo/UglifyJS#minify-options
        //       terserOptions: {
        //         compress: {
        //             // compress options
        //         },

        //       },
        //     }),
        //   ],
    },
    module: {
        rules: [
            {
                // down-level the card and its dependencies (lit, chart.js) so older WebViews/Safari can run it
                test: /\.js$/,
                loader: "esbuild-loader",
                options: { target: "es2017" },
            },
        ],
        // rules: [
        //     {
        //         test: /\.(js|jsx)$/i,
        //         loader: 'babel-loader',
        //     },
        //     {
        //         test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
        //         type: 'asset',
        //     },

        //     // Add your rules for custom modules here
        //     // Learn more about loaders from https://webpack.js.org/loaders/
        // ],
    },
};

module.exports = () => {
    if (isProduction) {
        config.mode = 'production';
    } else {
        config.mode = 'development';
    }
    return config;
};





