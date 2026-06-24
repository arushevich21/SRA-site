import { notFound } from 'next/navigation';
import { getSimBySlug, SIM_SLUGS } from '@/content/sims';

export function generateStaticParams() {
  return SIM_SLUGS.map((sim) => ({ sim }));
}

export default async function SimLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  return (
    <div style={{ '--sim-accent': sim.accentColor } as React.CSSProperties}>
      {children}
    </div>
  );
}
