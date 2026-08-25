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
    // Defaults are 8 deviceSizes x 8 imageSizes (16 total variants Vercel's
    // optimizer can generate per source image). Every <Image> on this site
    // renders at a known, bounded size (icons/flags/badges are ~16-40px,
    // manufacturer logos ~20-28px, track hero art tops out at this app's own
    // max-w-[1280px] page container) — nothing here is ever full-viewport at
    // 4K. Cut to what's actually used so each image needs far fewer
    // transformations, which is what Vercel's Image Optimization quota
    // counts against.
    deviceSizes: [640, 828, 1280, 1920],
    imageSizes: [16, 32, 48, 64, 128],
    // Default minimumCacheTTL is 60s — every optimized image (track hero
    // photos, the sitewide logo, srating/championship logos) was getting
    // re-transformed and re-billed against the quota roughly every minute a
    // cache miss occurred, regardless of whether the source ever changed.
    // None of these change more than monthly: local /public assets only
    // change on redeploy, and admin-uploaded championship logos get a fresh
    // crypto.randomUUID() path per upload (see uploadChampionshipLogo in
    // admin/events/actions.ts) rather than overwriting an existing URL, so a
    // long TTL can never serve stale content under a reused URL.
    minimumCacheTTL: 2678400, // 31 days, per Vercel's own usage-reduction guidance
    // Default is ['image/avif', 'image/webp'] — two encodes (and two cache
    // entries) per size variant. webp alone still has effectively universal
    // browser support and roughly halves the remaining transformation count.
    formats: ['image/webp'],
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
