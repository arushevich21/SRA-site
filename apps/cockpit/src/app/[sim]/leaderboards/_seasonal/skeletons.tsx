// Suspense fallbacks for the live seasonal pages, sized to the real
// components' geometry so nothing reflows when the data streams in.

// TrackList rows: min-h-[130px] with a 12px gap.
export function TrackListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading tracks">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="min-h-[130px] border border-line bg-carbon-2/60 animate-pulse" />
      ))}
    </div>
  );
}

// Board table rows while page 1 streams.
export function BoardSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="h-12 border border-line/50 bg-carbon-2/60 animate-pulse" />
      ))}
    </div>
  );
}
