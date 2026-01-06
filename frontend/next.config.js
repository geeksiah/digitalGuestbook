/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE: process.env.VITE_API_BASE || 'http://localhost:4000',
  },
  // Turbopack config (Next.js 16 default)
  turbopack: {},
}

module.exports = nextConfig

