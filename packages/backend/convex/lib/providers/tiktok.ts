import { BaseProvider } from "./base";
import {
  ProviderDeferredError,
  type AuthUrlInput,
  type ConnectedProfile,
  type ExchangeInput,
  type PostFormat,
  type ProviderToken,
  type PublishInput,
  type PublishResult,
  type SocialProvider,
} from "./types";

/**
 * TikTok — REGISTERED BUT DEFERRED.
 *
 * Developer verification and direct video publishing API access in review with ByteDance.
 */
class TikTokProvider extends BaseProvider implements SocialProvider {
  readonly id = "tiktok" as const;
  readonly displayName = "TikTok";
  readonly scopes = ["user.info.basic", "video.upload", "video.publish"];

  readonly credentialEnv = {
    clientId: "TIKTOK_CLIENT_KEY",
    clientSecret: "TIKTOK_CLIENT_SECRET",
  };

  readonly limits = {
    maxCaptionLength: 2200,
    maxImages: 0,
    maxVideos: 1,
    requiresMedia: true,
    supportedFormats: ["video", "reel"] as PostFormat[],
  };

  readonly deferred = {
    reason: "Coming soon (TikTok developer verification in progress)",
  };

  buildAuthUrl(_input: AuthUrlInput): string {
    throw new ProviderDeferredError(this.displayName, this.deferred.reason);
  }

  async exchangeCode(_input: ExchangeInput): Promise<ConnectedProfile[]> {
    throw new ProviderDeferredError(this.displayName, this.deferred.reason);
  }

  async refresh(
    _token: ProviderToken,
    _clientId: string,
    _clientSecret: string,
  ): Promise<ProviderToken> {
    throw new ProviderDeferredError(this.displayName, this.deferred.reason);
  }

  async publish(_token: ProviderToken, _input: PublishInput): Promise<PublishResult> {
    throw new ProviderDeferredError(this.displayName, this.deferred.reason);
  }

  async revoke(_token: ProviderToken): Promise<void> {
    // No-op for deferred provider
  }
}

export const tiktok = new TikTokProvider();
