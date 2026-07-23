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
  // Logo uploads go through a Server Action, whose request body defaults to a
  // 1 MB cap. uploadChampionshipLogo accepts images up to 2 MB, so raise the
  // limit to match — otherwise 1–2 MB logos are rejected by Next before the
  // action runs (surfaces only as "Body exceeded 1 MB limit" in the server log).
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
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
