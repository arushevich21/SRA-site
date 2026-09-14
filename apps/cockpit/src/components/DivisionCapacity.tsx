import type { DivisionCapacityRow } from '@/lib/division-capacity';

// Per-division driver counts on the register page.
//
// Advisory, never a gate: registration is not blocked at the cap (see
// 20260914c_division_driver_cap.sql). The number exists because some ACC
// tracks have fewer than 50 pit boxes, so a division filling up needs to be
// VISIBLE to whoever is running the series — hence the amber state rather than
// a refusal.
export function DivisionCapacity({ rows }: { rows: DivisionCapacityRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-10">
      <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-4">
        Signed Up
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {rows.map((r) => {
          // Bar is clamped at 100% so an over-subscribed division stays inside
          // its track; the count text above it still shows the real number.
          const pct =
            r.cap != null && r.cap > 0 ? Math.min(100, (r.driverCount / r.cap) * 100) : 0;

          return (
            <div key={r.divisionId} className="border border-line bg-panel px-4 py-3">
              <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mb-2">
                {r.divisionName}
              </p>
              <p className="font-display font-bold text-[20px] text-txt leading-none">
                {r.driverCount}
                {r.cap != null && (
                  <span
                    className={[
                      'font-mono text-[13px] ml-1',
                      r.atCapacity ? 'text-gold-deep' : 'text-txt-3',
                    ].join(' ')}
                  >
                    / {r.cap}
                  </span>
                )}
                <span className="font-mono text-[11px] text-txt-3 ml-2">
                  driver{r.driverCount === 1 ? '' : 's'}
                </span>
              </p>

              {r.cap != null && (
                <div className="mt-3 h-[3px] w-full bg-line/60">
                  <div
                    className={['h-full', r.atCapacity ? 'bg-gold-deep' : 'bg-gold'].join(' ')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {r.atCapacity && (
                <p className="font-mono text-[10px] tracking-[.15em] uppercase text-gold-deep mt-2">
                  At capacity
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
