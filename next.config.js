const { i18n } = require('./next-i18next.config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  reactStrictMode: true,
  experimental: {
    appDir: true
  },
  webpack(config, { isServer, dev }) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

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
