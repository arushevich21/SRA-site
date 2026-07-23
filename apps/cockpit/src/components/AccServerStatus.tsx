'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { AccServerStatus as ServerStatus } from '@/app/api/acc/server-status/route';

// Live-ish ACCSM fleet status for the ACC overview page. Reads the cached
// /api/acc/server-status route (~60s) and re-polls on the same cadence, so the
// upstream servers are never hit directly from the browser.
export function AccServerStatus({ accentColor }: { accentColor: string }) {
  const [servers, setServers] = useState<ServerStatus[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let loaded = false;
    async function load() {
      try {
        const res = await fetch('/api/acc/server-status');
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { servers: ServerStatus[] };
        if (!alive) return;
        loaded = true;
        setServers(data.servers);
        setFailed(false);
      } catch {
        // Only surface a failure if we've never managed to load — a later
        // poll failing shouldn't blow away data already on screen.
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
          Our ACC race servers (SRAM1–7). Jump in on{' '}
          <span className="font-mono text-txt-2">SRA</span> in the in-game server browser.
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
              <div key={i} className="border border-line bg-panel px-4 py-4 h-[74px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {servers.map((s) => (
              <ServerCard key={s.label} server={s} accentColor={accentColor} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ServerCard({ server, accentColor }: { server: ServerStatus; accentColor: string }) {
  const racing = server.online && server.drivers > 0;

  // Any online server is green; racing ones additionally pulse (below).
  // Offline stays a dim gray.
  const dotClass = server.online ? 'bg-live' : 'bg-txt-3/25';

  return (
    <div
      className={[
        'border bg-panel px-4 py-3',
        racing ? 'border-live/40' : 'border-line',
        server.online ? '' : 'opacity-60',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={['w-[7px] h-[7px] rounded-full shrink-0', dotClass].join(' ')}
          style={racing ? { animation: 'live-pulse 1.8s infinite' } : undefined}
        />
        <span className="font-display font-bold text-[15px] uppercase text-txt">
          {server.label}
        </span>
        <span
          className="ml-auto font-mono text-[11px] tracking-[.12em] uppercase"
          style={racing ? { color: accentColor } : undefined}
        >
          <span className={racing ? '' : 'text-txt-3'}>
            {racing
              ? `${server.drivers} racing now`
              : server.online
                ? 'Online'
                : 'Offline'}
          </span>
        </span>
      </div>

      {server.lastTrackName && (
        <p className="mt-2 font-mono text-[11px] tracking-[.05em] text-txt-3 truncate">
          <span className="text-txt-3/60">Last raced </span>
          <span className="text-txt-2">{server.lastTrackName}</span>
          {server.lastRacedAt && (
            <span className="text-txt-3/60"> · {formatDistanceToNow(new Date(server.lastRacedAt))} ago</span>
          )}
        </p>
      )}
    </div>
  );
}
