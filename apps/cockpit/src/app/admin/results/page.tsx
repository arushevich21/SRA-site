import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { uploadAccResultsAction } from './actions';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminResultsPage({ searchParams }: PageProps) {
  // Defense in depth: gate at page render AND every server action
  await requireAdmin();

  const params = await searchParams;
  const result = typeof params.result === 'string' ? params.result : null;
  const msg = typeof params.msg === 'string' ? params.msg : null;

  return (
    <Shell>
      <h2 className="font-display font-bold text-[24px] uppercase text-txt mb-8">
        Upload ACC Race Results
      </h2>

      {result === 'success' && msg && <Banner type="success">{msg}</Banner>}
      {result === 'error' && msg && <Banner type="error">{msg}</Banner>}

      <form action={uploadAccResultsAction} className="flex flex-col gap-5">
        <FileField label="Practice (FP) JSON" name="fpFile" />
        <FileField label="Qualifying (Q) JSON" name="qFile" />
        <FileField label="Race (R) JSON" name="rFile" />

        <button
          type="submit"
          className="bg-gold text-carbon font-mono text-[12px] tracking-[.2em] uppercase font-bold px-5 py-2.5 hover:bg-gold-soft transition-colors cursor-pointer self-start"
        >
          Upload Results
        </button>
      </form>

      <div className="mt-10 pt-6 border-t border-line">
        <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3/50">
          Attach any combination of the three raw session files from an ACCSM
          server. Saved to the Supabase &#123;acc_race_sessions&#125; table; FP/Q/R
          sharing the same metaData and track/day are grouped into one event on
          the public Results page. New sessions from ACCSM are also ingested
          automatically by the hot-lap cron — use this page for backfilling
          past events or re-adding a specific session.
        </p>
      </div>
    </Shell>
  );
}

function FileField({ label, name }: { label: string; name: string }) {
  return (
    <label className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3">
      {label}
      <input
        type="file"
        name={name}
        accept=".json"
        className="mt-2 block w-full text-sm text-txt-3 font-mono file:bg-carbon-2 file:border file:border-line file:text-txt-2 file:font-mono file:text-xs file:px-3 file:py-1.5 file:cursor-pointer file:mr-3"
      />
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="max-w-[720px] mx-auto px-7 pt-14 pb-24">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← Go back
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Admin
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Race Results Upload
      </h1>
      {children}
    </section>
  );
}

function Banner({
  type,
  children,
}: {
  type: 'success' | 'error';
  children: React.ReactNode;
}) {
  const styles =
    type === 'success'
      ? 'border-live/30 bg-live/5 text-live'
      : 'border-gold-deep/30 bg-gold-deep/5 text-gold-deep';
  return (
    <div className={`border ${styles} px-4 py-3 mb-6 font-mono text-[12px] tracking-[.1em]`}>
      {children}
    </div>
  );
}
