import Image from 'next/image';
import Link from 'next/link';
import { COUNTRIES } from '@/lib/countries';
import { countryFlagUrl } from '@/lib/country-flag';
import { bareDriverName } from '@/lib/driver-display-name';
import {
  DIRECTORY_PAGE_SIZE,
  DIRECTORY_SORTS,
  getDriverDirectory,
  getDriversOverview,
  parseDirectorySort,
  type DirectorySort,
} from '@/lib/driver-directory';
import { DriverTierBadge } from '@/components/DriverTierBadge';

// Every number here is live (drivers table + the race/rating rollups) — this
// page used to be hardcoded. Search/sort/page live in the URL so results are
// linkable and work without JS; the reads are two cheap SQL functions.

// Driver numbers run 1–999 (#1 is the reigning champion's display number).
const NUMBER_POOL = 999;
const TOP_COUNTRIES = 5;

const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]));
const nf = new Intl.NumberFormat('en-US');

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function hrefWith(params: { q: string; sort: DirectorySort; div: number | null }, page: number): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.sort !== 'wins') sp.set('sort', params.sort);
  if (params.div) sp.set('div', String(params.div));
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return `/about/drivers${qs ? `?${qs}` : ''}#directory`;
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-line bg-panel p-6">
      <span className="font-display text-[48px] text-gold leading-none">{value}</span>
      <span className="block font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mt-2">{label}</span>
    </div>
  );
}

export default async function DriversPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (first(sp.q) ?? '').trim().slice(0, 60);
  const sort = parseDirectorySort(first(sp.sort));
  const divRaw = Number(first(sp.div));
  const div = Number.isInteger(divRaw) && divRaw > 0 ? divRaw : null;
  const pageRaw = Number(first(sp.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const params = { q, sort, div };

  const [overview, directory] = await Promise.all([
    getDriversOverview(),
    getDriverDirectory({ search: q, sort, division: div, page }),
  ]);
  const pages = Math.max(1, Math.ceil(directory.total / DIRECTORY_PAGE_SIZE));
  const otherCountries = overview ? Math.max(0, overview.countries.length - TOP_COUNTRIES) : 0;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">— About</span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Drivers &amp; Stats
      </h1>

      {/* Overall */}
      {overview && (
        <>
          <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">Overall</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <Tile value={nf.format(overview.numbered)} label="Active Drivers" />
            <Tile value={`${Math.round((overview.numbered / NUMBER_POOL) * 100)}%`} label="Number Utilization" />
            <Tile value={nf.format(overview.withResults)} label="Raced GT3 Series" />
            <Tile value={nf.format(overview.inDivision)} label="In a Division" />
          </div>
          <p className="font-sans text-[13px] text-txt-3 -mt-4 mb-10">
            Active drivers hold a driver number ({nf.format(overview.numbered)} of {NUMBER_POOL} in use).
          </p>
        </>
      )}

      <div className="h-px bg-line my-12" />

      {/* Directory */}
      <h2 id="directory" className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6 scroll-mt-24">
        Driver Directory
      </h2>
      <form method="get" action="/about/drivers#directory" className="flex flex-wrap items-end gap-3 mb-6">
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name or number"
            className="bg-panel border border-line px-4 py-2.5 font-sans text-[14px] text-txt placeholder:text-txt-3 focus:border-gold outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">Division</span>
          <select
            name="div"
            defaultValue={div ?? ''}
            className="bg-panel border border-line px-3 py-2.5 font-sans text-[14px] text-txt focus:border-gold outline-none"
          >
            <option value="">All drivers</option>
            {(overview?.divisions ?? []).map((d) => (
              <option key={d.division} value={d.division}>
                Division {d.division}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">Sort</span>
          <select
            name="sort"
            defaultValue={sort}
            className="bg-panel border border-line px-3 py-2.5 font-sans text-[14px] text-txt focus:border-gold outline-none"
          >
            {Object.entries(DIRECTORY_SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="font-mono text-[12px] tracking-[.2em] uppercase px-5 py-3 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors"
        >
          Apply
        </button>
        {(q || div || sort !== 'wins') && (
          <Link
            href="/about/drivers#directory"
            className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold py-3"
          >
            Reset
          </Link>
        )}
      </form>

      <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mb-3">
        {nf.format(directory.total)} driver{directory.total === 1 ? '' : 's'}
        {q && <> matching “{q}”</>}
        {div && <> · Division {div}</>}
        {' · '}
        {DIRECTORY_SORTS[sort]}
      </p>

      {directory.rows.length === 0 ? (
        <div className="border border-line bg-panel p-6">
          <p className="font-sans text-[14px] text-txt-2">No drivers match. Try a different name or number.</p>
        </div>
      ) : (
        <div className="border border-line bg-panel overflow-x-auto">
          <table className="w-full text-left min-w-[560px]">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">
                <th className="font-normal px-4 py-3 w-16">#</th>
                <th className="font-normal px-4 py-3">Driver</th>
                <th className="font-normal px-4 py-3">Division</th>
                <th className="font-normal px-4 py-3 text-right">Starts</th>
                <th className="font-normal px-4 py-3 text-right">Wins</th>
                <th className="font-normal px-4 py-3 text-right hidden sm:table-cell">Podiums</th>
                <th className="font-normal px-4 py-3 text-right hidden sm:table-cell">SRAting</th>
              </tr>
            </thead>
            <tbody>
              {directory.rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-panel-2 group">
                  <td className="px-4 py-2.5 font-mono text-[13px] text-txt-3">{r.driverNumber ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/drivers/${r.id}`}
                      className="flex items-center gap-2.5 font-sans text-[14px] text-txt group-hover:text-gold"
                    >
                      {r.country ? (
                        <span className="relative w-4 h-3 shrink-0 overflow-hidden">
                          <Image
                            src={countryFlagUrl(r.country)}
                            alt={COUNTRY_NAMES.get(r.country) ?? r.country}
                            fill
                            sizes="16px"
                            unoptimized
                            className="object-cover"
                          />
                        </span>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      {bareDriverName(r.displayName)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <DriverTierBadge isSralien={r.isSralien} division={r.division} tier={r.tier} />
                      {r.division == null && !r.isSralien && <span className="text-txt-3">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[13px] text-txt-2">{r.starts ?? '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-mono text-[13px] ${r.wins ? 'text-gold' : 'text-txt-2'}`}>
                    {r.wins ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[13px] text-txt-2 hidden sm:table-cell">
                    {r.podiums ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[13px] text-txt-2 hidden sm:table-cell">
                    {r.composite == null ? '—' : `${(r.composite * 100).toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-4 mt-4" aria-label="Directory pages">
          {page > 1 ? (
            <Link href={hrefWith(params, page - 1)} className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 hover:text-gold">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
            Page {Math.min(page, pages)} of {pages}
          </span>
          {page < pages ? (
            <Link href={hrefWith(params, page + 1)} className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 hover:text-gold">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {overview && (
        <>
          <div className="h-px bg-line my-12" />

          {/* Geographic Breakdown */}
          <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">Geographic Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
            {overview.countries.slice(0, TOP_COUNTRIES).map((g) => (
              <div key={g.country} className="border border-line bg-panel p-6">
                <span className="font-display text-[28px] text-gold leading-none">{nf.format(g.count)}</span>
                <span className="block font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mt-2">
                  {COUNTRY_NAMES.get(g.country) ?? g.country}
                </span>
                <span className="block font-sans text-sm text-txt-2 mt-1">
                  {((g.count / Math.max(1, overview.withCountry)) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
            {otherCountries > 0 && (
              <div className="border border-line bg-panel p-6 flex items-center justify-center">
                <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 text-center">
                  + {otherCountries} other countries
                </span>
              </div>
            )}
          </div>
          <p className="font-sans text-[13px] text-txt-3">
            Of the {nf.format(overview.withCountry)} drivers who have set a country on their profile.
          </p>

          <div className="h-px bg-line my-12" />

          {/* Division Breakdown */}
          <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">Division Breakdown</h2>
          <div className="border border-line bg-panel rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line">
                  {['Division', 'Total', 'Gold', 'Silver'].map((h) => (
                    <th key={h} className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 px-6 py-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.divisions.map((row) => (
                  <tr key={row.division} className="border-b border-line last:border-0">
                    <td className="font-sans text-sm text-txt px-6 py-4 font-semibold">
                      <Link href={hrefWith({ q: '', sort: 'rating', div: row.division }, 1)} className="hover:text-gold">
                        D{row.division}
                      </Link>
                    </td>
                    <td className="font-sans text-sm text-txt-2 px-6 py-4">{row.total}</td>
                    <td className="font-sans text-sm text-gold px-6 py-4">{row.gold}</td>
                    <td className="font-sans text-sm text-txt-2 px-6 py-4">{row.silver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="h-px bg-line my-12" />

      {/* SRAlien Note */}
      <div className="border border-line bg-panel p-6">
        <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-2 block">Classification Note</span>
        <p className="font-sans text-sm text-txt-2 leading-relaxed">
          SRAlien classification for elite performers (ratings 99+).
        </p>
      </div>
    </section>
  );
}
