/**
 * OAuth verification section — Google reviewers need a public page that:
 * 1) Identifies the app as "MagicBox" (must match consent screen)
 * 2) Explains purpose / functionality without login
 * 3) Explains why Google / YouTube user data is requested
 * 4) Links Privacy Policy (same URL as consent screen)
 *
 * @see https://support.google.com/cloud/answer/13807376
 * @see https://support.google.com/cloud/answer/13804963
 */
export function AboutMagicBoxSection() {
  return (
    <section
      id="about-magicbox"
      className="border-t border-foreground/10 bg-secondary/30 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-[900px] px-6 lg:px-12">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          About the application
        </p>
        <h2 className="mb-6 font-display text-4xl tracking-tight lg:text-5xl">
          What MagicBox is
        </h2>
        <div className="space-y-5 text-base leading-relaxed text-muted-foreground lg:text-lg">
          <p>
            <strong className="font-medium text-foreground">MagicBox</strong> is
            the product name of this application. It is operated by Nhancio
            Technologies Private Limited (Hyderabad, India). MagicBox is{" "}
            <strong className="font-medium text-foreground">
              AI marketing automation software
            </strong>{" "}
            that helps users create social media content, review drafts, schedule
            posts, and publish to connected channels.
          </p>
          <p>
            <strong className="font-medium text-foreground">Core functionality</strong>
            : users enter brand context and a content brief; MagicBox generates
            channel-specific copy and media; users approve or edit drafts; MagicBox
            publishes or schedules posts to Instagram, LinkedIn, and YouTube when
            those accounts are connected by the user.
          </p>
          <p>
            <strong className="font-medium text-foreground">
              Why MagicBox requests Google user data
            </strong>
            : to connect a YouTube channel via Google OAuth so MagicBox can upload
            videos the user chooses to publish, and can read channel metadata needed
            to complete that publish flow. MagicBox requests only the minimum YouTube
            scopes required for upload and channel access (
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-sm text-foreground">
              youtube.upload
            </code>
            ,{" "}
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-sm text-foreground">
              youtube.readonly
            </code>
            ). Access tokens are stored server-side and used only to perform
            actions the user initiates in MagicBox.
          </p>
          <p>
            MagicBox does not sell Google user data. Details on collection, use,
            retention, and deletion are in the{" "}
            <a
              href="/privacy.html"
              className="font-medium text-foreground underline underline-offset-4"
            >
              MagicBox Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="/terms.html"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Terms of Service
            </a>
            .
          </p>
          <p className="text-sm">
            Support:{" "}
            <a
              href="mailto:support@magicboxai.in"
              className="font-medium text-foreground underline underline-offset-4"
            >
              support@magicboxai.in
            </a>
            {" · "}
            Homepage:{" "}
            <a
              href="https://magicboxai.in/"
              className="font-medium text-foreground underline underline-offset-4"
            >
              https://magicboxai.in/
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
