'use client';

import { useEffect, useRef, useState } from 'react';

// Decorative looping hero video for the /[sim] landing pages.
// - prefers-reduced-motion: never autoplays; the poster frame stands in.
// - A looping video next to content needs a way to stop it (WCAG 2.2.2), so
//   there's a small pause/play control in the corner.
// The video itself is hidden from assistive tech — it carries no information.
export function SimHeroVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    video.play().then(
      () => setPlaying(true),
      () => setPlaying(false), // autoplay blocked (data saver etc.) — poster stays
    );
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true), () => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <video
        ref={ref}
        className="absolute inset-0 w-full h-full object-cover"
        src={src}
        poster={poster}
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause background video' : 'Play background video'}
        className="absolute z-20 right-4 bottom-4 sm:right-6 sm:bottom-6 w-9 h-9 grid place-items-center border border-line-2 bg-carbon/60 text-txt-2 hover:text-gold hover:border-gold/60 transition-colors"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2" y="1" width="3" height="10" fill="currentColor" />
            <rect x="7" y="1" width="3" height="10" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
          </svg>
        )}
      </button>
    </>
  );
}
