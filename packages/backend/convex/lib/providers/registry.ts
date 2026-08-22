import type { PlatformId, SocialProvider } from "./types";
import { instagram } from "./instagram";
import { facebook } from "./facebook";
import { linkedin } from "./linkedin";
import { youtube } from "./youtube";
import { twitter } from "./twitter";
import { tiktok } from "./tiktok";
import { reddit } from "./reddit";
import { whatsapp } from "./whatsapp";

/**
 * The one place platforms are enumerated.
 *
 * Everything downstream (OAuth, publish, scheduler, UI channel list) resolves a
 * provider through here by id and never branches on platform names. Adding a
 * platform = write the module, add one line here.
 */
const REGISTRY: Record<PlatformId, SocialProvider> = {
  instagram,
  facebook,
  linkedin,
  youtube,
  twitter,
  tiktok,
  reddit,
  whatsapp,
};

export function getProvider(id: string): SocialProvider {
  const p = REGISTRY[id as PlatformId];
  if (!p) throw new Error(`Unknown platform: ${id}`);
  return p;
}

export function allProviders(): SocialProvider[] {
  return Object.values(REGISTRY);
}

/** Providers a user can actually connect right now (excludes deferred ones). */
export function connectableProviders(): SocialProvider[] {
  return allProviders().filter((p) => !p.deferred);
}

/**
 * Channel catalogue for the UI: what exists, what's live, and — for deferred
 * platforms — an honest reason instead of a broken connect button.
 */
export function providerCatalogue() {
  return allProviders().map((p) => ({
    id: p.id,
    displayName: p.displayName,
    available: !p.deferred,
    reason: p.deferred?.reason,
    limits: p.limits,
  }));
}
