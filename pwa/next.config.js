/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',

  serverExternalPackages: ['pdf-parse'],

  // Disable React strict mode to prevent hydration issues with browser extensions
  reactStrictMode: false,

  // Turbopack configuration (stable, no longer experimental)
  turbopack: {
    rules: {
      // Allow importing various file types that might be needed
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

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
}

// Only apply PWA wrapper in production to avoid dev conflicts
if (process.env.NODE_ENV === 'production') {
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: false,
  })
  module.exports = withPWA(nextConfig)
} else {
  module.exports = nextConfig
}
