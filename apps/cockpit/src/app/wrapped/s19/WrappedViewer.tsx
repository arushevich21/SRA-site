'use client';

import { WrappedStory, type WrappedShare } from '@/components/wrapped/WrappedStory';
import type { WrappedDriverCard } from '@/lib/wrapped/card';
import { markWrappedSeen } from '../actions';
import { forgetWrappedPrompt } from '@/components/wrapped/useWrappedPrompt';
import { LeagueLink } from '@/components/wrapped/LeagueLink';

// The driver's own story. Starting it counts as having seen Wrapped, so the
// launch prompt stops appearing on every device. The tab's cached prompt
// state is dropped too, so the prompt doesn't flash on the next page.
export function WrappedViewer({ card, share }: { card: WrappedDriverCard; share: WrappedShare }) {
  return (
    <WrappedStory
      card={card}
      share={share}
      extra={<LeagueLink />}
      onStart={() => {
        forgetWrappedPrompt();
        void markWrappedSeen();
      }}
    />
  );
}
