import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';
import DivisionsTable, { type DriverRow, type Division } from './DivisionsTable';

export const dynamic = 'force-dynamic';

export default async function AdminDivisionsPage() {
  // Defense in depth: gate at page render AND every server action
  await requireAdmin();

  const { data: divisions, error: divError } = await supabase
    .from('divisions')
    .select('id, name')
    .order('id');

  // Supabase's PostgREST caps responses at 1000 rows regardless of .limit().
  // Paginate in batches until we get them all.
  const PAGE = 1000;
  let allDrivers: DriverRow[] = [];
  let drvError: { message: string } | null = null;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, display_name, discord_id, steam_id, division_id, tier')
      .order('display_name', { nullsFirst: false })
      .range(from, from + PAGE - 1);

    if (error) { drvError = error; break; }
    allDrivers = allDrivers.concat((data ?? []) as DriverRow[]);
    if ((data?.length ?? 0) < PAGE) break;
  }

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
        initialDrivers={allDrivers}
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
