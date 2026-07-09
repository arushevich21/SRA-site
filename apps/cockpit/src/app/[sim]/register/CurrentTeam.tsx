'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { leaveTeam } from './actions';

type Member = {
  driver_id: string;
  display_name: string | null;
  tier: 'gold' | 'silver' | null;
};

type Props = {
  teamId: string;
  teamName: string;
  car: string;
  divisionName: string | null;
  members: Member[];
  currentDriverId: string;
  simSlug: string;
  maxTeamSize: number;
};

export default function CurrentTeam({
  teamId,
  teamName,
  car,
  divisionName,
  members,
  currentDriverId,
  simSlug,
  maxTeamSize,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const spotsOpen = maxTeamSize - members.length;

  function handleLeave() {
    startTransition(async () => {
      await leaveTeam(teamId, simSlug);
      router.refresh();
    });
  }

  return (
    <div className="max-w-[640px]">
      {/* Team card */}
      <div className="border border-gold/20 bg-gold/5 px-7 py-5 mb-6">
        <p className="font-mono text-[10px] tracking-[.3em] uppercase text-gold mb-1">
          Registered
        </p>
        <p className="font-display font-bold text-[22px] uppercase text-txt leading-tight">
          {teamName}
        </p>
        <p className="font-mono text-[12px] text-txt-3 mt-2">{car}</p>
        {divisionName && (
          <p className="font-mono text-[11px] text-txt-3/60 mt-1">
            {divisionName}
          </p>
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
