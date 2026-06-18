import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@called-it/core', '@called-it/db'],
}

export default nextConfig
