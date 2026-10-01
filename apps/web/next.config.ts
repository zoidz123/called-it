import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets the dev server be opened as 127.0.0.1 as well as localhost; without it Next blocks its own dev assets.
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@called-it/core', '@called-it/db'],
}

export default nextConfig
