import type { FleetServer } from '@/lib/server-fleet';

// Shared between the calendar's ACC panel and the full /about/servers page so
// the two can't drift on what a state looks like.
//
// Three states, not two: "Up" (running, nobody on it) and "Idle" (no event
// loaded) are genuinely different things to a driver deciding where to go, and
// collapsing them into one "Online" was part of why the old panel was useless.
// A host we can't reach at all doesn't appear here — we can't enumerate a dead
// host's servers, so that's reported separately as a host-down notice.
export function ServerCard({
  server,
  accentColor,
}: {
  server: FleetServer;
  accentColor: string;
}) {
  const racing = server.state === 'racing';

  const statusLabel = racing
    ? `${server.drivers} racing now`
    : server.state === 'up'
      ? 'Up'
      : 'Idle';

  return (
    <div
      className={[
        'border bg-panel px-4 py-3',
        racing ? 'border-live/40' : 'border-line',
        server.state === 'idle' ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <span
          className={[
            'w-[7px] h-[7px] rounded-full shrink-0 mt-[6px]',
            server.state === 'idle' ? 'bg-txt-3/25' : 'bg-live',
          ].join(' ')}
          style={racing ? { animation: 'live-pulse 1.8s infinite' } : undefined}
        />
        {/* Server names wrap rather than truncate — the name is the whole
            point of this panel, so an ellipsis would defeat it. */}
        <span className="font-display font-bold text-[15px] uppercase text-txt leading-tight min-w-0">
          {server.name}
        </span>
        <span
          className="ml-auto font-mono text-[11px] tracking-[.12em] uppercase shrink-0 mt-[2px]"
          style={racing ? { color: accentColor } : undefined}
        >
          <span className={racing ? '' : 'text-txt-3'}>{statusLabel}</span>
        </span>
      </div>

      {(server.trackName || server.session) && (
        <p className="mt-2 font-mono text-[11px] tracking-[.05em] text-txt-2">
          {server.trackName ?? 'Unknown track'}
          {server.session && <span className="text-txt-3"> · {server.session}</span>}
        </p>
      )}

      {server.championship && (
        <p className="mt-1 font-mono text-[11px] tracking-[.05em] text-txt-3">
          {server.championship}
        </p>
      )}

      {/* What the box is FOR (quali vs race conditions, quick race, ...).
          An observed label is read off the last completed session's advertised
          name, so it lags a reconfiguration — the dotted underline and title
          mark it as inferred rather than live config. A curated label carries
          no such caveat. */}
      {server.purpose && (
        <p
          className={[
            'mt-1 font-mono text-[11px] tracking-[.05em] text-txt-2',
            server.purposeSource === 'observed'
              ? 'decoration-dotted underline underline-offset-[3px] decoration-txt-3/40'
              : '',
          ].join(' ')}
          title={
            server.purposeSource === 'observed'
              ? `Read from this server's last completed session${
                  server.purposeObservedAt
                    ? ` on ${new Date(server.purposeObservedAt).toLocaleDateString()}`
                    : ''
                } — not a live read of its current configuration.`
              : undefined
          }
        >
          {server.purpose}
        </p>
      )}

      <p className="mt-2 font-mono text-[10px] tracking-[.18em] uppercase text-txt-3/50">
        {server.host}
        {server.isPrivate !== null && <> · {server.isPrivate ? 'Private' : 'Public'}</>}
      </p>
    </div>
  );
}

export function HostDownNotice({ hosts }: { hosts: { host: string }[] }) {
  if (hosts.length === 0) return null;
  return (
    <p className="mt-4 font-mono text-[11px] tracking-[.05em] text-txt-3/60">
      Couldn&apos;t reach {hosts.map((h) => h.host).join(', ')} — any servers there aren&apos;t listed.
    </p>
  );
}
