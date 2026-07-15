const faqs = [
  {
    question: "What is an AI agent for marketing?",
    answer:
      "An AI agent for marketing turns a brand brief into repeatable work: drafting channel-specific copy, creating visual assets, scheduling campaigns, and tracking the publishing workflow. MagicBox keeps brand settings and optional human approval in that loop.",
  },
  {
    question: "How is marketing with AI different from a basic scheduler?",
    answer:
      "A scheduler publishes content you have already made. Marketing with AI can help create the caption and media for each channel before scheduling it. MagicBox combines generation, approval, scheduling, and publishing in one workflow.",
  },
  {
    question: "Which marketing agents are included in MagicBox?",
    answer:
      "MagicBox currently coordinates agents for brand-aware copy, images, scheduling, and direct publishing. Short-form video is a gated beta and is disabled by default. Instagram, LinkedIn, and YouTube are the supported direct-publishing channels; each connection still depends on platform approval and API permissions.",
  },
  {
    question: "Can I review content before it is published?",
    answer:
      "Yes. You can require approval for an automation, review generated posts, and keep control of the final publishing decision. Fully automated schedules are also available when you are comfortable with the workflow.",
  },
  {
    question: "Is MagicBox an AI agency near me?",
    answer:
      "MagicBox is an online AI marketing platform built in India, not a location-based agency. If you are comparing an AI agency near you with software, MagicBox is the self-serve option for running repeatable content workflows from anywhere.",
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
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
