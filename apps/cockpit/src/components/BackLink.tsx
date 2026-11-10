'use client';

import { useRouter } from 'next/navigation';

// "← Back" for pages reachable from many places (a driver page is linked from
// profiles, results, boards…), so there's no single parent to hard-code.
// Goes back in history when the visitor arrived from elsewhere on this site;
// otherwise (opened from a shared link, new tab) it's a plain link to
// `fallbackHref` — which is also what renders before hydration / without JS.
export function BackLink({ fallbackHref, fallbackLabel }: { fallbackHref: string; fallbackLabel: string }) {
  const router = useRouter();

  return (
    <a
      href={fallbackHref}
      onClick={(e) => {
        let sameSite = false;
        try {
          sameSite = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
        } catch {
          sameSite = false;
        }
        if (sameSite && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
    >
      ← Back<span className="sr-only"> (or {fallbackLabel})</span>
    </a>
  );
}
