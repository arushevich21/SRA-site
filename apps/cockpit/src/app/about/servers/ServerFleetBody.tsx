'use client';

import { SIMS } from '@/content/sims';
import { GameLabel } from '@/components/GameLabel';
import { ServerCard, HostDownNotice } from '@/components/ServerCard';
import { useFleetStatus } from '@/components/ServerStatusPanel';

// Grouped by sim, in sims.ts order, so the accent colours do the wayfinding
// the same way they do everywhere else. A sim with no reachable servers is
// omitted entirely rather than rendering an empty heading — except when its
// host is down, which HostDownNotice reports explicitly so "no servers" and
// "we couldn't ask" never look the same.
export function ServerFleetBody() {
  const { status, failed } = useFleetStatus();

  if (failed) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-6 py-8 text-center">
        <p className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
          Server status unavailable
        </p>
      </div>
    );
  }

  if (status == null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="border border-line bg-panel px-4 py-4 h-[104px] animate-pulse" />
        ))}
      </div>
    );
  }

  const groups = SIMS.map((sim) => ({
    sim,
    servers: status.servers.filter((s) => s.game === sim.game),
    hostsDown: status.hostsDown.filter((h) => h.game === sim.game),
  })).filter((g) => g.servers.length > 0 || g.hostsDown.length > 0);

  if (groups.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-6 py-8 text-center">
        <p className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
          No servers are currently online
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-14">
      {groups.map(({ sim, servers, hostsDown }) => (
        <div key={sim.slug}>
          <div className="flex items-baseline gap-3 mb-5 pb-3 border-b border-line">
            <h2
              className="font-display font-black text-[22px] uppercase leading-none tracking-[-0.3px]"
              style={{ color: sim.accentColor }}
            >
              <GameLabel game={sim.game} />
            </h2>
            <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">
              {servers.length} {servers.length === 1 ? 'server' : 'servers'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {servers.map((s) => (
              <ServerCard key={`${s.host}-${s.name}`} server={s} accentColor={sim.accentColor} />
            ))}
          </div>

          {/* The AC Evo server advertises its full browser name rather than a
              bare tag, and that full string is what you actually scan for in
              game — so surface it here even though the card shows the short
              tag. */}
          {servers.some((s) => s.fullName !== s.name) && (
            <dl className="mt-5 flex flex-col gap-1.5">
              {servers
                .filter((s) => s.fullName !== s.name)
                .map((s) => (
                  <div key={`${s.host}-${s.name}-full`} className="flex flex-wrap gap-x-2 font-mono text-[11px]">
                    <dt className="text-txt-3 shrink-0">{s.name} in game</dt>
                    <dd className="text-txt-2 min-w-0">{s.fullName}</dd>
                  </div>
                ))}
            </dl>
          )}

          <HostDownNotice hosts={hostsDown} />
        </div>
      ))}
    </div>
  );
}
