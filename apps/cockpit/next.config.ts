import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sra/shared-types', '@sra/simgrid-client', '@sra/domain'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.simracingalliance.com',
      },
    ],
  },
};

export default nextConfig;
