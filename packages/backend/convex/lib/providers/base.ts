import {
  BadBodyError,
  NotEnoughScopesError,
  RefreshTokenError,
  RetryableError,
  type PublishInput,
  type SocialProvider,
} from "./types";

/**
 * Shared base for every provider. All cross-cutting concerns live here so each
 * platform module only contains what is genuinely platform-specific.
 *
 * Provides:
 *  - `http()`: fetch with retry on 429/5xx and HTTP-status -> typed-error mapping
 *  - `validate()`: enforce platform limits BEFORE spending an API call
 *
 * (Adapted from Postiz's `SocialAbstract`.)
 */
export abstract class BaseProvider {
  /**
   * HTTP with automatic retry + error classification.
   *
   * The status->error mapping is the important part: it's what lets the publish
   * engine react correctly without knowing which platform it's talking to.
   *   401     -> RefreshTokenError   (refresh + retry once)
   *   403     -> NotEnoughScopesError (force reconnect)
   *   4xx     -> BadBodyError        (terminal; retrying wastes quota)
   *   429/5xx -> RetryableError      (backoff)
   */
  protected async http(
    url: string,
    init: RequestInit & { retries?: number } = {},
  ): Promise<any> {
    const { retries = 2, ...rest } = init;
    let lastErr: Error = new RetryableError("no attempt made");

    for (let attempt = 0; attempt <= retries; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, rest);
      } catch (e) {
        lastErr = new RetryableError(`network error: ${String(e)}`);
        if (attempt === retries) break;
        await this.backoff(attempt);
        continue;
      }

      if (res.ok) {
        const text = await res.text();
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      }

      const body = (await res.text()).slice(0, 400);

      if (res.status === 401) throw new RefreshTokenError(`401: ${body}`);
      if (res.status === 403) throw new NotEnoughScopesError(`403: ${body}`);

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000 || undefined;
        lastErr = new RetryableError(`${res.status}: ${body}`, retryAfter);
        if (attempt === retries) break;
        await this.backoff(attempt, retryAfter);
        continue;
      }

      // Any other 4xx is our fault and deterministic.
      throw new BadBodyError(`${res.status}: ${body}`);
    }

    throw lastErr;
  }

  private backoff(attempt: number, retryAfterMs?: number): Promise<void> {
    const ms = retryAfterMs ?? 1000 * 2 ** attempt;
    return new Promise((r) => setTimeout(r, Math.min(ms, 30_000)));
  }

  /**
   * Enforce platform limits before hitting the network. Every violation is a
   * BadBodyError because none of them get better by retrying.
   */
  protected validate(self: SocialProvider, input: PublishInput): void {
    const { limits } = self;
    const text = this.composeText(input);

    if (text.length > limits.maxCaptionLength) {
      throw new BadBodyError(
        `caption is ${text.length} chars; ${self.displayName} allows ${limits.maxCaptionLength}`,
      );
    }

    const images = input.media.filter((m) => m.type === "image");
    const videos = input.media.filter((m) => m.type === "video");

    if (limits.requiresMedia && input.media.length === 0) {
      throw new BadBodyError(`${self.displayName} requires an image or video`);
    }
    if (limits.textOnly && input.media.length > 0) {
      throw new BadBodyError(`${self.displayName} does not accept media`);
    }
    if (images.length > limits.maxImages) {
      throw new BadBodyError(
        `${images.length} images; ${self.displayName} allows ${limits.maxImages}`,
      );
    }
    if (videos.length > limits.maxVideos) {
      throw new BadBodyError(
        `${videos.length} videos; ${self.displayName} allows ${limits.maxVideos}`,
      );
    }

    if (input.options?.postFormat || input.options?.format) {
      const format = String(input.options.postFormat || input.options.format);
      const normalized = format === "text_post" ? "post" : format;
      if (
        limits.supportedFormats &&
        !limits.supportedFormats.includes(normalized as any) &&
        !limits.supportedFormats.includes(format as any)
      ) {
        throw new BadBodyError(
          `${self.displayName} does not support '${format}' format. Supported formats: ${limits.supportedFormats.join(", ")}`,
        );
      }
    }
  }

  /** Caption + hashtags as one string, the way every text-based platform wants it. */
  protected composeText(input: PublishInput): string {
    const tags = (input.hashtags ?? [])
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    return tags ? `${input.caption}\n\n${tags}` : input.caption;
  }
}
