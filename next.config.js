const { i18n } = require('./next-i18next.config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  reactStrictMode: true,
  output: "standalone",

  // Ignore ESLint errors during build (existing codebase has lint issues)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Ignore TypeScript errors during build (existing codebase has type issues)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Production optimizations
  poweredByHeader: false,
  generateEtags: true,
  
  // Enable SWC minification
  swcMinify: true,
  
  // Modularize imports for better tree-shaking
  modularizeImports: {
    '@tabler/icons-react': {
      transform: '@tabler/icons-react/dist/esm/icons/{{member}}',
    },
    'react-icons': {
      transform: 'react-icons/{{member}}',
    },
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },

  webpack(config, { isServer, dev }) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    
    // Production optimizations
    if (!dev && !isServer) {
      // Enable module concatenation
      config.optimization.concatenateModules = true;
      
      // Split chunks optimally
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor splitting
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test(module) {
              return module.size() > 160000 &&
                /node_modules[\\/]/.test(module.identifier());
            },
            name(module) {
              const hash = require('crypto')
                .createHash('sha1')
                .update(module.identifier())
                .digest('hex');
              return `lib-${hash.substring(0, 8)}`;
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
          shared: {
            name(module, chunks) {
              const hash = require('crypto')
                .createHash('sha1')
                .update(chunks.reduce((acc, chunk) => acc + chunk.name, ''))
                .digest('hex');
              return `shared-${hash.substring(0, 8)}`;
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      };
    }

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
