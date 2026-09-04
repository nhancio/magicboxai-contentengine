/**
 * Real permalink for a published post. Returns null when we only know the
 * platform — never fall back to instagram.com / linkedin.com/feed.
 */
export function getSocialPostUrl(post: {
  platforms?: string[];
  results?: Array<{ permalink?: string }>;
  openUrl?: string;
}): string | null {
  const permalink =
    post.openUrl ||
    post.results?.find((r) => typeof r.permalink === "string" && r.permalink.trim())?.permalink;
  if (typeof permalink === "string" && permalink.trim()) return permalink.trim();
  return null;
}
