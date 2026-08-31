'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { allowedCarNameForModelId } from '@/content/acc-car-model-map';
import { CarIcon } from '@/components/CarIcon';
import { leaveTeam, updateRegistration, type UpdateRegistrationState } from './actions';

type Member = {
  driver_id: string;
  display_name: string | null;
  tier: 'gold' | 'silver' | null;
};

export type NextRoundInfo = {
  round: number;
  track: string;
  raceLength: string;
  date: string;
  time: string | null;
};

type Props = {
  teamId: string;
  teamName: string;
  car: string;
  carModelId: number | null;
  divisionId: number | null;
  divisionName: string | null;
  members: Member[];
  currentDriverId: string;
  currentDriverName: string | null;
  simSlug: string;
  maxTeamSize: number;
  championshipKey: string;
  season: string;
  allowedCars: string[];
  nextRound: NextRoundInfo | null;
};

export default function CurrentTeam({
  teamId,
  teamName,
  car,
  carModelId,
  divisionId,
  divisionName,
  members,
  currentDriverId,
  currentDriverName,
  simSlug,
  maxTeamSize,
  championshipKey,
  season,
  allowedCars,
  nextRound,
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
  // The signed-in driver's own division/tier crest — null on an ungraded
  // championship (divisionId null) or if their own member row somehow
  // carries no tier yet, same "no placeholder badge" rule TeamList follows.
  const myTier = members.find((m) => m.driver_id === currentDriverId)?.tier ?? null;
  const crestSrc =
    divisionId != null && myTier != null
      ? `/badges/Division ${divisionId} ${myTier === 'gold' ? 'Gold' : 'Silver'}.png`
      : null;

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
    <div className="flex flex-wrap items-start gap-10">
      <div className="w-full lg:w-[640px] shrink-0">
        {/* Team card */}
        <div className="flex items-start justify-between gap-5 border border-gold/20 bg-gold/5 px-7 py-5 mb-6">
          {editing ? (
            <form action={action} className="flex-1 flex flex-col gap-4">
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
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-mono text-[10px] tracking-[.3em] uppercase text-gold mb-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="w-3 h-3 shrink-0">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Registered
                </p>
                <p className="font-display font-bold text-[22px] uppercase text-txt leading-tight">
                  {teamName}
                </p>
                <p className="flex items-center gap-1.5 font-mono text-[12px] text-txt-3 mt-2">
                  <CarIcon className="w-[15px] h-[15px] shrink-0" />
                  {car}
                </p>
                {divisionName && (
                  <p className="font-mono text-[11px] text-txt-3/60 mt-1">{divisionName}</p>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="mt-4 font-mono text-[11px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors"
                >
                  Change car / team name
                </button>
              </div>
              {crestSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={crestSrc}
                  alt={`${divisionName ?? `Division ${divisionId}`} ${myTier}`}
                  className="w-[76px] h-[55px] shrink-0 object-contain"
                />
              )}
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
              {/* Badge art is per-division ("Division 3 Gold.png"), so there
                  is no badge to show on an ungraded championship. */}
              {member.tier && divisionId != null && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/badges/Division ${divisionId} ${member.tier === 'gold' ? 'Gold' : 'Silver'}.png`}
                  alt={`Div ${divisionId} ${member.tier}`}
                  className="h-6 w-auto"
                />
              )}
              <span className="font-mono text-[13px] text-txt flex-1">
                {member.display_name ?? '—'}
                {member.driver_id === currentDriverId && (
                  <span className="font-mono text-[10px] text-txt-3 ml-2">
                    you
                  </span>
                )}
              </span>
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

      {/* Next Round — real schedule data (ScheduleRound), not a filler
          panel: omitted entirely when the schedule has nothing upcoming
          rather than shown empty. */}
      {nextRound && (
        <div className="w-full lg:w-[320px] shrink-0">
          <div className="border border-line bg-panel">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
              <p className="font-mono text-[10px] tracking-[.3em] uppercase text-txt-3">
                Next Round
              </p>
              <p className="font-mono text-[10px] tracking-[.15em] uppercase text-gold">
                Round {nextRound.round}
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="font-display font-extrabold text-[28px] uppercase italic leading-[.95] tracking-[-.5px] text-gold mb-2.5">
                {nextRound.track}
              </p>
              <p className="flex items-center gap-2 font-sans text-[12px] text-txt-2 mb-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[13px] h-[13px] shrink-0 text-txt-3">
                  <rect x="3" y="5" width="18" height="16" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
                {nextRound.date}
                {nextRound.time ? ` · ${nextRound.time}` : ''}
              </p>
              <p className="flex items-center gap-2 font-sans text-[12px] text-txt-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[13px] h-[13px] shrink-0 text-txt-3">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
                {nextRound.raceLength}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
