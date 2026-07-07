import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';
import DivisionsTable, { type DriverRow, type Division } from './DivisionsTable';

export const dynamic = 'force-dynamic';

export default async function AdminDivisionsPage() {
  // Defense in depth: gate at page render AND every server action
  await requireAdmin();

  const [{ data: divisions, error: divError }, { data: drivers, error: drvError }] =
    await Promise.all([
      supabase.from('divisions').select('id, name').order('id'),
      supabase
        .from('drivers')
        .select('id, display_name, discord_id, steam_id, division_id, tier')
        .order('display_name', { nullsFirst: false })
        .limit(10000),
    ]);

  if (divError || drvError) {
    return (
      <Shell>
        <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 font-mono text-[12px] text-red-400">
          Failed to load data: {divError?.message ?? drvError?.message}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <DivisionsTable
        initialDrivers={(drivers ?? []) as DriverRow[]}
        divisions={(divisions ?? []) as Division[]}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="max-w-[1400px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Admin
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Division Assignment
      </h1>
      {children}
    </section>
  );
}
