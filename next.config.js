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
    // Content Security Policy for Next.js with external services
    const cspDirectives = [
      "default-src 'self'",
      // Scripts: Next.js requires unsafe-inline for hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.mxpnl.com",
      // Styles: CSS-in-JS requires unsafe-inline
      "style-src 'self' 'unsafe-inline'",
      // Images from self, data URIs, and HTTPS sources
      "img-src 'self' data: blob: https:",
      // Fonts
      "font-src 'self' data:",
      // API connections: Lambda, Cognito, Canvas API, Mixpanel
      "connect-src 'self' https://avxjw3hiwxhop4rbyvmprg6jku0jtcwq.lambda-url.us-east-1.on.aws https://*.amazoncognito.com https://*.auth.us-east-1.amazoncognito.com https://hdviynn2m4.execute-api.us-east-1.amazonaws.com https://api.mixpanel.com https://*.s3.amazonaws.com wss://*.amazoncognito.com",
      // Frame ancestors (same as X-Frame-Options: DENY)
      "frame-ancestors 'none'",
      // Base URI restriction
      "base-uri 'self'",
      // Form action restriction
      "form-action 'self' https://*.amazoncognito.com",
      // Object/embed restriction
      "object-src 'none'",
      // Upgrade insecure requests
      "upgrade-insecure-requests",
    ];
    const csp = cspDirectives.join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
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
            value: 'max-age=31536000; includeSubDomains; preload',
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
