import { type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS } from '@/content/championships';
import { RegisterBody } from './RegisterBody';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ sim: string }> };

export default async function RegisterPage({ params }: Props) {
  const { sim: simSlug } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const champ = CHAMPIONSHIPS.find(
    (c) => c.game === sim.game && c.registrationKey && c.registrationOpen,
  );

  return (
    <Shell sim={sim} title={champ?.title ?? 'Register'}>
      <RegisterBody champ={champ} sim={sim} simSlug={simSlug} />
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
