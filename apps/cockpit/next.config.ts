import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
