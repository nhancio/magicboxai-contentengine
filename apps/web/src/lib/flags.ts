// Feature flags resolved at build time from Vite env vars.

/**
 * The pre-Suite avatar/UGC-video tools (Content Studio, Video Creator,
 * Ad Generator, Avatar Builder/Creator). Off by default — the product is the
 * social automation Suite. Set VITE_ENABLE_LEGACY_TOOLS=true to bring the old
 * routes and nav entries back.
 */
export const LEGACY_TOOLS_ENABLED =
  import.meta.env.VITE_ENABLE_LEGACY_TOOLS === "true";
