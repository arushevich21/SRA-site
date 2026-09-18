// Large broadcast media — the circuit hero clips the schedule-reveal scene
// plays — lives in the public `stream-media` Supabase Storage bucket, not in
// the repo: eight clips at 20–45 MB each is not something to carry in git.
// Bucket is public and immutable-cached; uploading a new clip under the same
// key means bumping the name.

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

// The re-encoded (1080p30, CRF 18, faststart) hero clip for a track key.
export function trackVideoUrl(trackKey: string): string {
  return `${base}/storage/v1/object/public/stream-media/videos/${trackKey}.mp4`;
}
