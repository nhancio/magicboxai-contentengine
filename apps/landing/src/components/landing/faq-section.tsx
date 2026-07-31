const faqs = [
  {
    question: "What is a UGC factory and how does MagicBox automate UGC content creation?",
    answer:
      "A UGC (User-Generated Content) factory is an automated system for producing authentic, relatable video and social content at scale. MagicBox acts as an AI UGC factory by taking your brand context and generating high-converting AI avatar videos, social posts, and graphics tailored for Instagram, LinkedIn, and YouTube without needing expensive video shoots.",
    related: { label: "See how it works", href: "#how-it-works" },
  },
  {
    question: "How do I create AI videos with MagicBox?",
    answer:
      "To create AI videos with MagicBox: 1) Input your website URL or brand brief to establish your brand profile. 2) Select your desired video format (Reels, Shorts, or LinkedIn video). 3) Let MagicBox generate the script, voiceover, and AI avatar visual. 4) Review the generated draft and click schedule to automate your marketing distribution.",
    related: { label: "Explore video features", href: "#features" },
  },
  {
    question: "How does MagicBox streamline AI content creation and marketing distribution?",
    answer:
      "MagicBox combines AI content creation (copy, images, AI videos) with an end-to-end marketing distribution engine. Instead of juggling separate tools for script writing, video generation, approval management, and post scheduling, MagicBox orchestrates the entire pipeline in one unified platform.",
    related: { label: "Compare plans", href: "#pricing" },
  },
  {
    question: "What does MagicBox do?",
    answer:
      "MagicBox turns a brand brief into channel-ready social drafts, then keeps review, scheduling, and publishing in one workflow. It is designed for teams that want a consistent publishing system without losing final control.",
    related: { label: "See how it works", href: "#how-it-works" },
  },
  {
    question: "Which channels can I publish to?",
    answer:
      "MagicBox supports direct publishing to connected Instagram, LinkedIn, and YouTube accounts. Supported formats vary by platform, and each connection still depends on the platform permissions and API approval available to your account.",
    related: { label: "View supported channels", href: "#supported" },
  },
  {
    question: "How is marketing with AI different from a basic scheduler?",
    answer:
      "A scheduler publishes content you have already made. Marketing with AI can help create the caption and media for each channel before scheduling it. MagicBox combines generation, approval, scheduling, and publishing in one workflow.",
    related: { label: "Explore the features", href: "#features" },
  },
  {
    question: "Do I need a paid plan to publish?",
    answer:
      "You can create and save drafts on the Free plan. A paid plan is required when you are ready to schedule or publish to a connected channel. The pricing page shows the current allowance and billing terms before checkout.",
    related: { label: "Compare plans", href: "#pricing" },
  },
  {
    question: "Can I review content before it is published?",
    answer:
      "Yes. You can require approval for an automation, review generated posts, and keep control of the final publishing decision. Fully automated schedules are also available when you are comfortable with the workflow.",
    related: { label: "See the approval workflow", href: "#how-it-works" },
  },
  {
    question: "Is MagicBox an AI agency near me?",
    answer:
      "MagicBox is an online AI marketing platform built in India, not a location-based agency. If you are comparing an AI agency near you with software, MagicBox is the self-serve option for running repeatable content workflows from anywhere.",
    related: { label: "Compare pricing plans", href: "#pricing" },
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-foreground/10 py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-12">
        <div>
          <span className="mb-5 block font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Frequently asked questions
          </span>
          <h2 className="font-display text-5xl tracking-tight lg:text-6xl">
            AI marketing,
            <br />without the mystery
          </h2>
        </div>

        <div className="divide-y divide-foreground/10 border-y border-foreground/10">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
                {faq.question}
                <span aria-hidden="true" className="font-mono text-xl text-muted-foreground group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-2xl pt-4 leading-relaxed text-muted-foreground">{faq.answer}</p>
              {faq.related && (
                <a
                  href={faq.related.href}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
                >
                  {faq.related.label}
                  <span aria-hidden="true">→</span>
                </a>
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
