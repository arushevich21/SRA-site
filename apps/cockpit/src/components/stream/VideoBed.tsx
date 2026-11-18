'use client';

import { useEffect, useRef } from 'react';

// The looping video bed under a holding scene. autoPlay + loop is enough in a
// normal browser tab, but an OBS browser source runs for hours with no one
// watching it, and Chromium's media pipeline can stall there without telling
// anyone: a decode hiccup, a dropped range request, the source being hidden and
// re-shown. The element then sits on one frame forever, with no error, and
// nothing ever calls play() again — the scene looks frozen on air.
//
// So the page watches the playhead itself. If it hasn't moved for a few
// seconds it nudges play(); if that doesn't take, it reloads the element.
// Reloads are rate-limited — the file is browser-cached for a week (see
// next.config.ts), but a reload loop is exactly the bandwidth runaway that
// commit 311fa75 cleaned up, so it must never spin.
const CHECK_MS = 2_000;
// Two missed checks (~4s still) before we touch anything: a loop seam or a
// scene switch can legitimately hold a frame for a moment.
const NUDGE_AFTER_CHECKS = 2;
// Still frozen after a nudge: reload the element.
const RELOAD_AFTER_CHECKS = 5;
const MIN_RELOAD_GAP_MS = 60_000;

export function VideoBed({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let lastTime = -1;
    let stillChecks = 0;
    let lastReload = 0;

    const play = () => {
      // A rejected play() (autoplay policy, mid-load) is not fatal — the next
      // check tries again.
      video.play().catch(() => {});
    };

    const reload = () => {
      const now = Date.now();
      if (now - lastReload < MIN_RELOAD_GAP_MS) return;
      lastReload = now;
      video.load();
      play();
    };

    play();

    const check = setInterval(() => {
      // Background tabs and hidden sources may legitimately pause rendering;
      // only judge a page that's actually being shown.
      if (document.visibilityState === 'hidden') {
        stillChecks = 0;
        return;
      }
      const t = video.currentTime;
      if (!video.paused && t !== lastTime) {
        lastTime = t;
        stillChecks = 0;
        return;
      }
      lastTime = t;
      stillChecks += 1;
      if (stillChecks >= RELOAD_AFTER_CHECKS) {
        stillChecks = 0;
        reload();
      } else if (stillChecks >= NUDGE_AFTER_CHECKS) {
        play();
      }
    }, CHECK_MS);

    // A hard media error never recovers on its own.
    const onError = () => reload();
    // Coming back into view (OBS scene switch) is the classic moment to find
    // the element paused.
    const onVisible = () => {
      if (document.visibilityState === 'visible') play();
    };
    video.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(check);
      video.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [src]);

  return (
    // Muted + playsInline is what lets Chromium autoplay without a gesture,
    // which an OBS browser source never gets.
    <video ref={ref} className={className} src={src} autoPlay muted loop playsInline aria-hidden="true" />
  );
}
