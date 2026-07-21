import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sra/shared-types', '@sra/simgrid-client', '@sra/domain', '@sra/emperor-client'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.simracingalliance.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        pathname: '/avatars/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
    ],
  },
  // Workspace packages use NodeNext-style relative imports (e.g. './client.js' for './client.ts') —
  // webpack needs to know to resolve those .js specifiers against .ts source files.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
