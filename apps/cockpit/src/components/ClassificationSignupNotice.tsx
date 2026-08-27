'use client';

import { useEffect, useState } from 'react';
import { getMyClassificationSignupNotice } from '@/app/[sim]/leaderboards/hotstint-qualifying/actions';
import type { ClassificationSignupState } from '@/lib/acc/hot-stint-store';

const HOW_TO_REGISTER_URL =
  'https://discord.com/channels/915686674833498203/1026549846615785543';

// Per-driver nudge, not a static banner: fetched client-side on mount via a
// server action so this stays cheap for the common case (signed out, or
// signed in but neither signed up nor has set a stint — "likely just
// perusing," per the request that shaped this) without forcing the page's
// revalidate=300 HTML off ISR the way a cookie read in the server component
// would (same reasoning as useCurrentDriverContext.ts). Renders nothing
// until resolved, and nothing at all for the two "nothing to report" states:
// signed out, or has neither/both of signup and a stint.
export function ClassificationSignupNotice() {
  const [state, setState] = useState<ClassificationSignupState>(null);

  useEffect(() => {
    let active = true;
    getMyClassificationSignupNotice().then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (state === null) return null;

  const isComplete = state === 'complete';

  return (
    <div
      className={[
        'border bg-carbon-2 px-5 py-4 mb-8',
        isComplete ? 'border-green-400/40' : 'border-[var(--sim-accent)]/40',
      ].join(' ')}
    >
      <p
        className={[
          'font-sans text-[14px] leading-relaxed',
          isComplete ? 'text-green-400' : 'text-txt-2',
        ].join(' ')}
      >
        {state === 'complete' ? (
          "You're all set — you've signed up for classification and posted a qualifying stint."
        ) : state === 'signed_up_no_stint' ? (
          "You're signed up for classification but haven't set a qualifying stint yet — get out on the classification server before it closes."
        ) : (
          <>
            You&apos;ve set a qualifying stint but haven&apos;t signed up for classification —
            sign up to make it count.{' '}
            <a
              href={HOW_TO_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--sim-accent)] hover:underline"
            >
              Sign up in #how-to-register →
            </a>
          </>
        )}
      </p>
    </div>
  );
}
