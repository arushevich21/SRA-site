import { type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getChampionships } from '@/lib/championships-store';
import { findChampionshipWithMyClaim, isWithdrawWindow } from '@/lib/registration-claims';
import { RegisterBody } from './RegisterBody';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ sim: string }> };

export default async function RegisterPage({ params }: Props) {
  const { sim: simSlug } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const champs = (await getChampionships()).filter((c) => c.game === sim.game && c.registrationKey);
  const open = champs.find((c) => c.registrationOpen);
  // Once sign-ups close, a registered driver still needs this page: it is the
  // only place they can withdraw. Without it, a driver who can't make the race
  // has to ask an admin, who then edits the ACCSM grid by hand — and the next
  // entrylist push either overwrites that edit or refuses to touch the grid.
  const closedWithMine = open ? undefined : await findChampionshipWithMyClaim(champs.filter(isWithdrawWindow));
  const champ = open ?? closedWithMine;

  return (
    <Shell sim={sim} title={champ?.title ?? 'Register'}>
      <RegisterBody champ={champ} sim={sim} simSlug={simSlug} withdrawOnly={!open && !!closedWithMine} />
    </Shell>
  );
}

function Shell({
  sim,
  title,
  children,
}: {
  sim: { accentColor: string };
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: sim.accentColor }}
      >
        — Register
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        {title}
      </h1>
      {children}
    </section>
  );
}
