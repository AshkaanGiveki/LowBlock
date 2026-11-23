/**
 * Public leaderboard responses must not embed image data URIs. In production
 * a handful of avatar fields inflated a 9-player response to ~447 KB.
 * The image itself remains accessible through a separately cached URL.
 */
export function lightweightLeaderboardAvatar(userId: string, source?: string | null) {
  if (!source) return null;
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(source))
    return `/api/public-avatar/${encodeURIComponent(userId)}`;
  // Do not render arbitrary data: URLs (e.g. potentially active SVG content).
  if (/^data:/i.test(source)) return null;
  return source;
}
