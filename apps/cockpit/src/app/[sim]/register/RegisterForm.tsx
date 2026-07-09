'use client';

import { useActionState, useState } from 'react';
import { registerTeam, type RegisterState } from './actions';

type AvailableDriver = {
  id: string;
  display_name: string | null;
  tier: 'gold' | 'silver' | null;
};

type Props = {
  champKey: string;
  maxTeamSize: number;
  allowedCars: string[];
  simSlug: string;
  availableDrivers: AvailableDriver[];
};

export default function RegisterForm({
  champKey,
  maxTeamSize,
  allowedCars,
  simSlug,
  availableDrivers,
}: Props) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerTeam,
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const maxTeammates = maxTeamSize - 1;

  const filtered = availableDrivers.filter(
    (d) =>
      !search ||
      d.display_name?.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxTeammates) {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-8 max-w-[640px]">
      {/* Server-side context — not user-editable */}
      <input type="hidden" name="championship_key" value={champKey} />
      <input type="hidden" name="sim_slug" value={simSlug} />
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="teammate_id" value={id} />
      ))}

      {/* Team name */}
      <div>
        <label className="block font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-2">
          Team Name
        </label>
        <input
          name="team_name"
          required
          maxLength={80}
          placeholder="Enter your team name"
          className="w-full bg-panel-2 border border-line px-4 py-3 font-mono text-[13px] text-txt placeholder:text-txt-3 focus:outline-none focus:border-gold"
        />
      </div>

      {/* Car */}
      <div>
        <label className="block font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-2">
          Car
        </label>
        <select
          name="car"
          required
          defaultValue=""
          className="w-full bg-panel-2 border border-line px-4 py-3 font-mono text-[13px] text-txt focus:outline-none focus:border-gold cursor-pointer"
        >
          <option value="" disabled>
            Select a car…
          </option>
          {allowedCars.map((car) => (
            <option key={car} value={car}>
              {car}
            </option>
          ))}
        </select>
      </div>

      {/* Teammate picker */}
      {maxTeammates > 0 && (
        <div>
          <label className="block font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-2">
            Teammate{maxTeammates > 1 ? 's' : ''}{' '}
            <span className="text-txt-3/50 normal-case tracking-normal">
              {selected.size}/{maxTeammates} · same division only
            </span>
          </label>

          {availableDrivers.length === 0 ? (
            <p className="font-mono text-[12px] text-txt-3 px-4 py-4 border border-line">
              No available drivers in your division right now.
            </p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-panel-2 border border-line border-b-0 px-4 py-2.5 font-mono text-[12px] text-txt placeholder:text-txt-3 focus:outline-none focus:border-gold"
              />
              <div className="border border-line max-h-[300px] overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="font-mono text-[12px] text-txt-3 px-4 py-3">
                    No drivers match.
                  </p>
                )}
                {filtered.map((driver) => {
                  const checked = selected.has(driver.id);
                  const disabled = !checked && selected.size >= maxTeammates;
                  return (
                    <label
                      key={driver.id}
                      className={[
                        'flex items-center gap-3 px-4 py-2.5 border-b border-line/30 last:border-b-0 cursor-pointer select-none transition-colors',
                        checked
                          ? 'bg-gold/10'
                          : disabled
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-panel-2',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(driver.id)}
                        className="cursor-pointer"
                      />
                      <span className="font-mono text-[12px] text-txt flex-1">
                        {driver.display_name ?? '—'}
                      </span>
                      {driver.tier && (
                        <span
                          className={[
                            'font-mono text-[10px] tracking-[.15em] uppercase',
                            driver.tier === 'gold'
                              ? 'text-[#e6b53d]'
                              : 'text-txt-3',
                          ].join(' ')}
                        >
                          {driver.tier}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {state && 'error' in state && (
        <p className="font-mono text-[11px] tracking-[.15em] uppercase text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start font-mono text-[12px] tracking-[.2em] uppercase px-6 py-3 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors disabled:opacity-50"
      >
        {pending ? 'Registering…' : 'Register Team'}
      </button>
    </form>
  );
}
