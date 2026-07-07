/**
 * TEMPORARY — admin page for uploading SimGrid standings exports.
 *
 * Gated by a shared password (ADMIN_PASSWORD env var).
 * REPLACE WITH REAL AUTH before this app has real users beyond the
 * race director. This is a placeholder to keep randoms out, not a
 * real security boundary.
 */

import { cookies } from 'next/headers';
import { isValidSession, SESSION_COOKIE } from '../../../lib/admin-auth';
import { loginAction, uploadStandingsAction, logoutAction } from './actions';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminStandingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = typeof params.result === 'string' ? params.result : null;
  const msg = typeof params.msg === 'string' ? params.msg : null;

  if (!process.env.ADMIN_PASSWORD) {
    return (
      <Shell>
        <Banner type="error">
          ADMIN_PASSWORD is not set in the environment. Cannot authenticate.
        </Banner>
      </Shell>
    );
  }

  const jar = await cookies();
  const authed = isValidSession(jar.get(SESSION_COOKIE)?.value);

  if (!authed) {
    return (
      <Shell>
        <h2 className="font-display font-bold text-[24px] uppercase text-txt mb-6">
          Sign In
        </h2>
        {result === 'error' && msg && <Banner type="error">{msg}</Banner>}
        <form action={loginAction} className="flex flex-col gap-4 max-w-sm">
          <label className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3">
            Admin Password
            <input
              type="password"
              name="password"
              required
              className="mt-2 block w-full bg-carbon-2 border border-line text-txt font-mono text-sm px-3 py-2 focus:border-gold focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="bg-gold text-carbon font-mono text-[12px] tracking-[.2em] uppercase font-bold px-5 py-2.5 hover:bg-gold-soft transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-display font-bold text-[24px] uppercase text-txt">
          Upload Standings
        </h2>
        <form action={logoutAction}>
          <button
            type="submit"
            className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </form>
      </div>

      {result === 'success' && msg && <Banner type="success">{msg}</Banner>}
      {result === 'error' && msg && <Banner type="error">{msg}</Banner>}

      <form action={uploadStandingsAction} className="flex flex-col gap-5">
        <label className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3">
          Standings Key
          <input
            type="text"
            name="championshipId"
            required
            placeholder="e.g. 22872 or endurance-s3"
            className="mt-2 block w-full bg-carbon-2 border border-line text-txt font-mono text-sm px-3 py-2 focus:border-gold focus:outline-none"
          />
        </label>

        <label className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3">
          Paste Standings JSON
          <textarea
            name="jsonText"
            rows={14}
            placeholder='[{"carClass": "...", "standings": [...]}]'
            className="mt-2 block w-full bg-carbon-2 border border-line text-txt font-mono text-xs px-3 py-2 focus:border-gold focus:outline-none resize-y"
          />
        </label>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3">
            Or attach file
          </span>
          <input
            type="file"
            name="jsonFile"
            accept=".json"
            className="text-sm text-txt-3 font-mono file:bg-carbon-2 file:border file:border-line file:text-txt-2 file:font-mono file:text-xs file:px-3 file:py-1.5 file:cursor-pointer file:mr-3"
          />
        </div>

        <button
          type="submit"
          className="bg-gold text-carbon font-mono text-[12px] tracking-[.2em] uppercase font-bold px-5 py-2.5 hover:bg-gold-soft transition-colors cursor-pointer self-start"
        >
          Upload Standings
        </button>
      </form>

      <div className="mt-10 pt-6 border-t border-line">
        <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3/50">
          Files saved to src/content/standings/&#123;id&#125;.json — does not
          persist across deploys on hosted platforms (Vercel, etc.)
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="max-w-[720px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Admin
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Standings Upload
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
