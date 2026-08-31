// Generic car-silhouette glyph shown next to a car name on the register page
// (entry list, registered-team card). Deliberately generic rather than a
// manufacturer logo — Ferrari's shield, BMW's roundel, etc. are trademarked
// marks, not something to recreate freely; this just signals "car" the way
// the rest of the site uses icons/badges as visual anchors next to text.
export function CarIcon({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12.5l1.4-4.3A2 2 0 0 1 6.3 6.8h9.9a2 2 0 0 1 1.9 1.4l1.4 4.3H3Z" />
      <path d="M2.5 12.5h19v2.7a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-2.7Z" />
      <circle cx="7" cy="16.5" r="1.4" />
      <circle cx="17" cy="16.5" r="1.4" />
    </svg>
  );
}
