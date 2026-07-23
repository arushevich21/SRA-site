import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';
import BopEditor, { type BopCell } from './BopEditor';

export const dynamic = 'force-dynamic';

export default async function AdminBopPage() {
  await requireAdmin();

  const [{ data: config }, { data: entries }] = await Promise.all([
    supabase.from('bop_config').select('bop_id, name, updated_at').eq('id', 'default').maybeSingle(),
    supabase.from('bop_entries').select('track, car_model, ballast_kg, restrictor'),
  ]);

  const cells: BopCell[] = (entries ?? []).map((e) => ({
    track: e.track as string,
    carModel: e.car_model as number,
    ballastKg: e.ballast_kg as number,
    restrictor: e.restrictor as number,
  }));

  return (
    <section className="max-w-[1600px] mx-auto px-7 pt-14 pb-24">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← Go back
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Admin
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-3">
        Custom BoP
      </h1>
      <p className="font-sans text-[14px] text-txt-3 mb-10 max-w-[720px]">
        Balance of Performance ballast &amp; restrictor per track and car. Edit
        the grid, <span className="text-txt-2">Save</span>, then{' '}
        <span className="text-txt-2">Download bop.json</span> and upload it to
        each championship in ACCSM. Blank/0 cells are omitted from the file.
      </p>

      <BopEditor
        initialCells={cells}
        bopId={(config?.bop_id as string) ?? ''}
        bopName={(config?.name as string) ?? 'Default'}
      />
    </section>
  );
}
