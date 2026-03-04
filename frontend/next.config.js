const path = require('node:path');

/** @type {import('next').NextConfig} */
const netlifyAssetHost = process.env.NEXT_PUBLIC_ASSET_PREFIX
  || (process.env.SITE_NAME ? `https://${process.env.SITE_NAME}.netlify.app` : undefined);

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname),
  },

  // Serve Next static assets from Netlify host in production to avoid custom-domain proxy/cache mismatches.
  assetPrefix: process.env.NODE_ENV === 'production' ? netlifyAssetHost : undefined,
  
  // Enable static export for Netlify (optional - comment out if using SSR)
  // output: 'export',
  
  // Image optimization for external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'production', // For static export
  },
  
  async rewrites() {
    // In production, API calls go directly to the backend URL
    // In development, proxy to localhost:3001
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
      {
        source: '/generated/:path*',
        destination: `${apiUrl}/generated/:path*`,
      },
    ];
  },
  
  // Required for Netlify
  trailingSlash: false,
};

module.exports = nextConfig;
