import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { bareDriverName } from '@/lib/driver-display-name';
import { getDriverProfile } from '@/lib/driver-profile';
import { getDriverStats } from '@/lib/driver-stats';
import { DriverStatsPanel, standingLabel } from '@/components/DriverStatsPanel';
import { DriverTierBadge } from '@/components/DriverTierBadge';
import { BackLink } from '@/components/BackLink';
import { EditProfileButton } from '@/components/EditProfileButton';
import { COUNTRIES } from '@/lib/countries';
import { countryFlagUrl } from '@/lib/country-flag';

const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]));

// Public driver page. Reads rollups that refresh nightly (and a few small
// indexed tables), so an hourly ISR window is plenty — no force-dynamic.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const driver = await getDriverProfile((await params).id);
  return { title: driver ? `${bareDriverName(driver.display_name)} — Driver Stats` : 'Driver not found' };
}

export default async function DriverPage({ params }: { params: Promise<{ id: string }> }) {
  const driver = await getDriverProfile((await params).id);
  if (!driver) notFound();

  const name = bareDriverName(driver.display_name);
  const stats = driver.steam_id ? await getDriverStats(driver.steam_id, driver.division_id) : null;
  const standing = { division: driver.division_id, tier: driver.tier, isSralien: driver.is_sralien };
  const division = standingLabel(standing);
  const image = driver.photo_url ?? driver.avatar_url;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <div className="flex items-start justify-between gap-4">
        <BackLink fallbackHref="/about/drivers" fallbackLabel="Drivers & Stats" />
        <EditProfileButton driverId={driver.id} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
      <div className="flex items-center gap-6 min-w-0">
        {image ? (
          <Image src={image} alt="" width={88} height={88} className="rounded-full shrink-0 object-cover w-[88px] h-[88px]" />
        ) : (
          <div className="w-[88px] h-[88px] rounded-full bg-panel-2 shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt">
            {name}
          </h1>
          {(driver.driver_number != null || driver.country || division) && (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-[14px] text-txt-2 mt-3">
              {driver.driver_number != null && (
                <span className="font-display font-bold text-[22px] leading-none text-gold">#{driver.driver_number}</span>
              )}
              {driver.country && (
                <span
                  className="relative inline-block w-6 h-[18px] overflow-hidden"
                  title={COUNTRY_NAMES.get(driver.country) ?? driver.country}
                >
                  <Image
                    src={countryFlagUrl(driver.country)}
                    alt={COUNTRY_NAMES.get(driver.country) ?? driver.country}
                    fill
                    sizes="24px"
                    unoptimized
                    className="object-cover"
                  />
                </span>
              )}
              {division && (
                <span className="flex items-center gap-2 text-txt-2">
                  <DriverTierBadge {...standing} />
                  {division}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
        {driver.steam_id && (
          <form method="get" action={`/drivers/${driver.id}/vs`} className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-sans text-[13px] text-txt-3">Compare head to head</span>
              <input
                type="search"
                name="q"
                placeholder="Compare with…"
                className="w-[220px] bg-panel border border-line px-4 py-2.5 font-sans text-[14px] text-txt placeholder:text-txt-3 focus:border-gold outline-none"
              />
            </label>
            <button
              type="submit"
              className="font-display text-[16px] tracking-[.06em] uppercase px-5 py-2 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors"
            >
              Go
            </button>
          </form>
        )}
      </div>

      {stats ? (
        <DriverStatsPanel stats={stats} />
      ) : (
        <div className="border border-line bg-panel px-7 py-6">
          <p className="font-sans text-[14px] text-txt-2">
            This driver hasn&apos;t linked a Steam account yet, so no results can be matched to them.
          </p>
        </div>
      )}
    </section>
  );
}
