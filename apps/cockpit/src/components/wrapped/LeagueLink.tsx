import Link from 'next/link';

// "Watch the league's season" — the extra action at the end of a driver's
// own story, and under a shared one.
export function LeagueLink() {
  return (
    <Link href="/wrapped/s19/league" className="wx-action">
      The league&apos;s season
    </Link>
  );
}
