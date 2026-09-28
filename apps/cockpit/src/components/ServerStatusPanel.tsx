'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FleetStatus, FleetServer } from '@/lib/server-fleet';
import { ServerCard, HostDownNotice } from '@/components/ServerCard';

// Live-ish fleet panel for a single sim's page (currently the ACC calendar).
// Reads the cached /api/server-status route (~60s) and re-polls on the same
// cadence, so the upstream managers are never hit directly from the browser.
// The full cross-sim view lives at /about/servers.
export function ServerStatusPanel({
  game,
  accentColor,
}: {
  game: string;
  accentColor: string;
}) {
  const { status, failed } = useFleetStatus();

  const servers: FleetServer[] | null =
    status == null ? null : status.servers.filter((s) => s.game === game);
  const hostsDown = (status?.hostsDown ?? []).filter((h) => h.game === game);

  return (
    <section className="border-t border-line">
      <div className="max-w-[1280px] mx-auto px-7 py-24">
        <span
          className="block font-mono text-[11px] tracking-[.35em] uppercase mb-3"
          style={{ color: accentColor }}
        >
          Live Now
        </span>
        <h2 className="font-display font-black text-[clamp(28px,4vw,48px)] uppercase leading-[.92] tracking-[-0.5px] text-txt mb-4">
          Server Status
        </h2>
        <p className="font-sans text-[14px] text-txt-3 mb-10 max-w-[640px]">
          Our ACC race servers. Jump in on{' '}
          <span className="font-mono text-txt-2">SRA</span> in the in-game server browser, or see{' '}
          <Link href="/about/servers" className="text-txt-2 underline underline-offset-2 hover:text-gold-soft">
            every SRA server across all sims
          </Link>
          .
        </p>

        {failed ? (
          <div className="border border-line/50 bg-carbon-2 px-6 py-8 text-center">
            <p className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
              Server status unavailable
            </p>
          </div>
        ) : servers == null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="border border-line bg-panel px-4 py-4 h-[104px] animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {servers.map((s) => (
                <ServerCard key={`${s.host}-${s.name}`} server={s} accentColor={accentColor} />
              ))}
            </div>
            <HostDownNotice hosts={hostsDown} />
          </>
        )}
      </div>
    </section>
  );
}

export function useFleetStatus(): { status: FleetStatus | null; failed: boolean } {
  const [status, setStatus] = useState<FleetStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let loaded = false;
    async function load() {
      try {
        const res = await fetch('/api/server-status');
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as FleetStatus;
        if (!alive) return;
        loaded = true;
        setStatus(data);
        setFailed(false);
      } catch {
        // Only surface a failure if we've never managed to load — a later poll
        // failing shouldn't blow away data already on screen.
        if (alive && !loaded) setFailed(true);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return { status, failed };
}
