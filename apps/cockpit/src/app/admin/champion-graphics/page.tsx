import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { getSeasonChampions } from '@/lib/graphics/season-champions';

export const dynamic = 'force-dynamic';

// Champion graphics for a finished season: every division × title × format,
// each linking to the PNG /graphics/champions renders, with a download link.
// ?season=acc-gt3-s20 for another season (any registration key ending -sN).

const DEFAULT_KEY = 'acc-gt3-s19';

export default async function AdminChampionGraphicsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const { season: keyParam } = await searchParams;
  const key = keyParam && /^[a-z0-9-]+-s\d+$/.test(keyParam) ? keyParam : DEFAULT_KEY;
  const seasonNo = Number(/-s(\d+)$/.exec(key)![1]);

  let champions: Awaited<ReturnType<typeof getSeasonChampions>> = [];
  let error: string | null = null;
  try {
    champions = await getSeasonChampions(key);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <section className="max-w-[1400px] mx-auto px-7 pt-14 pb-24">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← Go back
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">— Admin</span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-4">
        Season {seasonNo} Champions
      </h1>
      <p className="font-mono text-[12px] text-txt-3 mb-10 max-w-[900px] leading-relaxed">
        Drivers’ and teams’ champions per division, from the final standings as SRA scores them (each
        driver’s own drop round). A driver’s broadcast photo is used when they’ve uploaded one; otherwise
        their race number fills the frame. Click a card for the full PNG; “Download” saves it named for the
        title. Square is 1080×1080, 16:9 is 1920×1080.
      </p>

      {error && <p className="font-mono text-[12px] text-red-400 mb-8">Couldn’t load standings: {error}</p>}

      <div className="flex flex-col gap-12">
        {champions.map((c) => (
          <div key={c.division}>
            <h2 className="font-display font-bold text-[22px] uppercase text-txt mb-4">
              Division {c.division}
              <span className="ml-3 font-mono text-[11px] tracking-[.15em] text-txt-3 normal-case">
                {c.driver.name}
                {c.team ? ` · ${c.team.name}` : ''}
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {(['driver', 'team'] as const)
                .filter((kind) => kind === 'driver' || c.team)
                .flatMap((kind) =>
                  (['square', 'wide'] as const).map((format) => {
                    const href = `/graphics/champions/${key}/${c.division}/${kind}${format === 'wide' ? '?format=wide' : ''}`;
                    const label = `${kind === 'driver' ? 'Drivers’' : 'Teams’'} · ${format === 'wide' ? '16:9' : 'Square'}`;
                    return (
                      <div key={`${kind}-${format}`} className="border border-white/10 bg-white/[.03]">
                        <a href={href} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG from our own route */}
                          <img
                            src={href}
                            alt={`Season ${seasonNo} Division ${c.division} ${label} champion`}
                            width={format === 'wide' ? 1920 : 1080}
                            height={1080}
                            loading="lazy"
                            className={`w-full ${format === 'wide' ? 'aspect-video' : 'aspect-square'} object-cover`}
                          />
                        </a>
                        <div className="flex items-center justify-between px-3 py-2 font-mono text-[11px] tracking-[.15em] uppercase">
                          <span className="text-txt">{label}</span>
                          <a
                            href={`${href}${href.includes('?') ? '&' : '?'}download=1`}
                            className="text-gold hover:underline"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    );
                  }),
                )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
