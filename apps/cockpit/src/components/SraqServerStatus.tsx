import { formatDistanceToNow } from 'date-fns';
import type { SraqServerStatus } from '@/lib/acc/server-status';

// Text only, deliberately no status dot — this is a staleness signal (when
// did the bot's loop last see this server produce a session), not a live
// healthcheck the way AccServerStatus.tsx's SRAM1-7 panel is. A green dot
// here would claim a kind of freshness this data structurally can't back up
// (see lib/acc/server-status.ts's header comment).
export function SraqServerStatus({ servers }: { servers: SraqServerStatus[] }) {
  if (servers.length === 0) return null;

  return (
    <div className="border border-line/50 bg-carbon-2 px-5 py-4 mb-8">
      <span className="block font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mb-3">
        Qualifying Servers
      </span>
      <div className="flex flex-col gap-1.5">
        {servers.map((s) => (
          <div key={s.serverKey} className="font-mono text-[12px] text-txt-2 flex gap-2">
            <span className="text-txt shrink-0 w-16">{s.label}</span>
            {s.lastSeenAt ? (
              <span>
                {s.trackKey ? `${s.trackKey} — ` : ''}
                last activity {formatDistanceToNow(new Date(s.lastSeenAt))} ago
              </span>
            ) : (
              <span className="text-txt-3">no sessions recorded yet</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
