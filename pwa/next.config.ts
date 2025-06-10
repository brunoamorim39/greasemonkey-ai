import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only enable standalone output for production builds
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
  }),

  serverExternalPackages: ['pdf-parse'],

  // Disable React strict mode to prevent hydration issues with browser extensions
  reactStrictMode: false,

  // Experimental optimizations to reduce compilation
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Enhanced Turbopack configuration for hot reload
  turbopack: {
    rules: {
      // Allow importing various file types that might be needed
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // Webpack configuration for both dev and production
  webpack: (config: any, { dev, isServer }: any) => {
    // Fix for natural library webworker-threads issue
    config.resolve = config.resolve || {};
    config.resolve.fallback = config.resolve.fallback || {};
    config.resolve.fallback['webworker-threads'] = false;

    // Development-specific configuration
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      }
    }
    return config
  },

  // Development optimizations for hot reload and compilation
  ...(process.env.NODE_ENV === 'development' && {
    // Disable caching issues that prevent hot reload
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),

  // PWA configuration (conditional to avoid conflicts with Turbopack in dev)
  ...(process.env.NODE_ENV === 'production' && {
    // Only enable PWA in production
    async rewrites() {
      return [
        {
          source: '/sw.js',
          destination: '/_next/static/sw.js',
        },
      ]
    },
  }),
};

// Only apply PWA wrapper in production to avoid dev conflicts
if (process.env.NODE_ENV === 'production') {
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: false,
  });
  module.exports = withPWA(nextConfig);
} else {
  module.exports = nextConfig;
}

export default nextConfig;
