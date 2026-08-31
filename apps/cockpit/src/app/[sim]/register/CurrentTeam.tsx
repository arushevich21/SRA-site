'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { allowedCarNameForModelId } from '@/content/acc-car-model-map';
import { leaveTeam, updateRegistration, type UpdateRegistrationState } from './actions';

type Member = {
  driver_id: string;
  display_name: string | null;
  tier: 'gold' | 'silver' | null;
};

type Props = {
  teamId: string;
  teamName: string;
  car: string;
  carModelId: number | null;
  divisionName: string | null;
  members: Member[];
  currentDriverId: string;
  currentDriverName: string | null;
  simSlug: string;
  maxTeamSize: number;
  championshipKey: string;
  season: string;
  allowedCars: string[];
};

export default function CurrentTeam({
  teamId,
  teamName,
  car,
  carModelId,
  divisionName,
  members,
  currentDriverId,
  currentDriverName,
  simSlug,
  maxTeamSize,
  championshipKey,
  season,
  allowedCars,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [state, action, savePending] = useActionState<UpdateRegistrationState, FormData>(
    updateRegistration,
    null,
  );
  const spotsOpen = maxTeamSize - members.length;
  // accCarModelName() (used for `car`, display-only) doesn't match every
  // allowedCars picker string — see allowedCarNameForModelId's comment —
  // so the edit form needs its own lookup to pre-select the right <option>.
  const currentCarPickerName = allowedCarNameForModelId(carModelId);

  function handleLeave() {
    startTransition(async () => {
      await leaveTeam(teamId, championshipKey, season, simSlug);
      router.refresh();
    });
  }

  // Close the form once the save lands — RegisterBody re-fetches on the
  // revalidatePath triggered by updateRegistration, so router.refresh() isn't
  // needed here the way it is for leaveTeam (a client-only local action).
  useEffect(() => {
    if (state && 'success' in state) setEditing(false);
  }, [state]);

  return (
    <div className="max-w-[640px]">
      {/* Team card */}
      <div className="border border-gold/20 bg-gold/5 px-7 py-5 mb-6">
        <p className="font-mono text-[10px] tracking-[.3em] uppercase text-gold mb-1">
          Registered
        </p>
        {editing ? (
          <form action={action} className="flex flex-col gap-4 mt-3">
            <input type="hidden" name="team_id" value={teamId} />
            <input type="hidden" name="championship_key" value={championshipKey} />
            <input type="hidden" name="sim_slug" value={simSlug} />

            <div>
              <label className="block font-mono text-[10px] tracking-[.2em] uppercase text-txt-3 mb-1.5">
                Team Name
              </label>
              <input
                name="team_name"
                required
                maxLength={80}
                defaultValue={teamName}
                className="w-full bg-panel-2 border border-line px-3 py-2 font-mono text-[13px] text-txt focus:outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] tracking-[.2em] uppercase text-txt-3 mb-1.5">
                Car
              </label>
              <select
                name="car"
                required
                defaultValue={currentCarPickerName ?? ''}
                className="w-full bg-panel-2 border border-line px-3 py-2 font-mono text-[13px] text-txt focus:outline-none focus:border-gold cursor-pointer"
              >
                <option value="" disabled>
                  Select a car…
                </option>
                {allowedCars.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {state && 'error' in state && (
              <p className="font-mono text-[11px] tracking-[.1em] uppercase text-red-400">
                {state.error}
              </p>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={savePending}
                className="font-mono text-[11px] tracking-[.15em] uppercase px-4 py-2 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors disabled:opacity-50"
              >
                {savePending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={savePending}
                className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-txt transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="font-display font-bold text-[22px] uppercase text-txt leading-tight">
              {teamName}
            </p>
            <p className="font-mono text-[12px] text-txt-3 mt-2">{car}</p>
            {divisionName && (
              <p className="font-mono text-[11px] text-txt-3/60 mt-1">{divisionName}</p>
            )}
            <button
              onClick={() => setEditing(true)}
              className="mt-4 font-mono text-[11px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors"
            >
              Change car / team name
            </button>
          </>
        )}
      </div>

      {/* Members */}
      <div className="border border-line mb-6">
        <p className="font-mono text-[10px] tracking-[.3em] uppercase text-txt-3 px-5 py-3 border-b border-line">
          Team Members — {members.length}/{maxTeamSize}
        </p>
        {members.map((member) => (
          <div
            key={member.driver_id}
            className="flex items-center gap-3 px-5 py-3 border-b border-line/30 last:border-b-0"
          >
            <span className="font-mono text-[13px] text-txt flex-1">
              {member.display_name ?? '—'}
              {member.driver_id === currentDriverId && (
                <span className="font-mono text-[10px] text-txt-3 ml-2">
                  you
                </span>
              )}
            </span>
            {member.tier && (
              <span
                className={[
                  'font-mono text-[10px] tracking-[.15em] uppercase',
                  member.tier === 'gold' ? 'text-[#e6b53d]' : 'text-txt-3',
                ].join(' ')}
              >
                {member.tier}
              </span>
            )}
          </div>
        ))}
        {spotsOpen > 0 && (
          <div className="px-5 py-3 font-mono text-[11px] text-txt-3/40 italic">
            {spotsOpen} spot{spotsOpen > 1 ? 's' : ''} open — waiting for teammate
          </div>
        )}
      </div>

      <p className="font-mono text-[12px] text-txt-3 mb-4">
        Racing as <span className="text-txt">{currentDriverName ?? 'your account'}</span>
        {' · '}
        <Link href="/profile" className="hover:text-gold transition-colors">
          edit profile
        </Link>
      </p>

      <button
        onClick={handleLeave}
        disabled={isPending}
        className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Leaving…' : 'Leave team'}
      </button>
    </div>
  );
}
