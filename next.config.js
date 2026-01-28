const { i18n } = require('./next-i18next.config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ['react-syntax-highlighter', 'refractor'],

  webpack(config, { isServer, dev }) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    // Force react-syntax-highlighter to use CommonJS prism-light version
    // refractor 3.x has core.js at root, not in lib/
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-syntax-highlighter$': 'react-syntax-highlighter/dist/cjs/prism-light.js',
      'refractor/core.js': 'refractor/core.js',
      'refractor/core': 'refractor/core.js',
    };

    // Add custom resolver plugin to handle refractor language imports
    config.resolve.plugins = config.resolve.plugins || [];
    config.resolve.plugins.push({
      apply: (resolver) => {
        const target = resolver.ensureHook('resolve');
        resolver.getHook('resolve').tapAsync('RefractorLangResolver', (request, resolveContext, callback) => {
          // Handle refractor language imports like refractor/lang/javascript
          if (request.request && request.request.match(/^refractor\/[^/]+$/)) {
            const lang = request.request.replace('refractor/', '');
            const newRequest = {
              ...request,
              request: `refractor/lang/${lang}.js`,
            };
            return resolver.doResolve(target, newRequest, `Rewriting refractor/${lang} to refractor/lang/${lang}.js`, resolveContext, callback);
          }
          callback();
        });
      },
    });

    return config;
  },
};

// if (
//     process.env.LD_LIBRARY_PATH == null ||
//     !process.env.LD_LIBRARY_PATH.includes(
//         `${process.env.PWD}/node_modules/canvas/build/Release:`,
//     )
// ) {
//   process.env.LD_LIBRARY_PATH = `${
//       process.env.PWD
//   }/node_modules/canvas/build/Release:${process.env.LD_LIBRARY_PATH || ''}`;
// }

module.exports = nextConfig;
