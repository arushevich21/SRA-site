import type { NextConfig } from 'next';

// Admin-uploaded championship logos live in Supabase Storage; allowlist that
// host (derived from the env URL so it isn't hardcoded per project) so the
// image optimizer will serve them.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

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
      ...(supabaseHost
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
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
