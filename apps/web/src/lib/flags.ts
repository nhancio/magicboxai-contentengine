// Feature flags resolved at build time from Vite env vars.

/**
 * Legacy UGC tools (Content Studio, Video Creator). Off by default — the product
 * is the social automation Suite. Set VITE_ENABLE_LEGACY_TOOLS=true to bring the
 * old routes and nav entries back.
 */
export const LEGACY_TOOLS_ENABLED =
  import.meta.env.VITE_ENABLE_LEGACY_TOOLS === "true";
