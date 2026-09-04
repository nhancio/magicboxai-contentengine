/**
 * Trending reel ingestion via Monid/TikHub, filtered down to genuinely
 * AI-generated content only (see aiContentFilter). Requires MONID_API_KEY;
 * returns an empty result rather than substituting non-AI footage.
 */
export { searchTrendingReels, type TrendingReelsResult } from "../../packages/backend/convex/lib/monid";
export {
  SEARCH_QUERY_SCHEMA,
  buildSearchQueryPrompt,
  GENERIC_FALLBACK_QUERIES,
} from "../../packages/backend/convex/lib/maya/searchQueries";
export { filterAIGeneratedOnly } from "../../packages/backend/convex/lib/maya/aiContentFilter";
