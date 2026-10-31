"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { BaselineScreen, CheckinScreen, FocusScreen, MatchScreen, PhoneFrame, VerdictScreen } from "@/components/previews";
import { Reveal } from "@/components/reveal";
import { SampleDataButton } from "../sample-data-button";
import { CapsText } from "@/components/ui";

type Step = { id: string; tab: string; tag: string; title: string; body: string; preview: string; screen: ReactNode; cta: ReactNode };

const linkCta = (href: string, label: string) => (
  <Link
    href={href}
    className="group inline-flex h-12 items-center gap-3 rounded-full bg-strawberry-ink pl-6 pr-1.5 font-semibold text-white hover:bg-berry-deep"
  >
    {label}
    <span aria-hidden className="grid size-9 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
      <ArrowUpRight className="size-4" />
    </span>
  </Link>
);

const STEPS: Step[] = [
  {
    id: "step-measure",
    tab: "Measure",
    tag: "YouCam Skin Analysis",
    title: "Take one clear photo.",
    body: "Consent first, then a framing oval so your face fills the frame the way YouCam needs. Eight concerns come back in about ten seconds, with progress straight from our server.",
    preview: "Illustration of the capture screen: an oval to fill with your face",
    screen: <CheckinScreen title="Take your baseline" />,
    cta: linkCta("/scan", "Start a fair test"),
  },
  {
    id: "step-focus",
    tab: "One focus",
    tag: "Your lowest scores first",
    title: "Choose one concern to test.",
    body: "Each focus is tied to one measured score, so a later check-in can say whether it moved. One focus keeps the test fair.",
    preview: "Preview of choosing one focus from sample scores",
    screen: <FocusScreen />,
    cta: <SampleDataButton label="Try it with sample data" size="md" />,
  },
  {
    id: "step-product",
    tab: "One product",
    tag: "Explainable matching",
    title: "Pick one product, see every reason.",
    body: "Matches come from the catalogue by explicit rules: a tier, the reasons, cautions drawn from your own scores, and anything your filters set aside.",
    preview: "Preview of two matched products from the sample catalogue",
    screen: <MatchScreen />,
    cta: linkCta("/privacy#matching", "How matching works"),
  },
  {
    id: "step-baseline",
    tab: "Baseline",
    tag: "Day 0",
    title: "Save the baseline.",
    body: "Your scan becomes the reference point, together with the normal-variation band for your focus. Nothing else to set up.",
    preview: "Preview of a saved baseline from sample data: hydration 69",
    screen: <BaselineScreen />,
    cta: linkCta("/scan", "Start a fair test"),
  },
  {
    id: "step-checkin",
    tab: "Check in",
    tag: "Weeks later",
    title: "Check in under the same conditions.",
    body: "Same spot, similar light, same camera. ProofLoop compares the lighting of both photos and tells you when a comparison isn't fair.",
    preview: "Illustration of the check-in screen",
    screen: <CheckinScreen title="Check in" />,
    cta: linkCta("/trials", "Open my trials"),
  },
  {
    id: "step-verdict",
    tab: "Verdict",
    tag: "Measured, not assumed",
    title: "Read an honest verdict.",
    body: "A measured change, no clear change, or inconclusive — with the band, the numbers and every concern for context. Never a claim about why.",
    preview: "Preview of a verdict from a synthetic demo, not a measurement",
    screen: <VerdictScreen />,
    cta: linkCta("#verdicts", "What each verdict means"),
  },
];

/** Six-step product demo with a sticky step bar that follows the scroll position. */
export function HowItWorks() {
  const [active, setActive] = useState(STEPS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px" },
    );
    STEPS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="px-3 sm:px-5">
      <div className="berry-glow mx-auto max-w-[88rem] rounded-[2.5rem] pb-16 pt-20 sm:pb-24 sm:pt-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="max-w-2xl">
            <p className="eyebrow"><CapsText>How it works</CapsText></p>
            <h2 id="how-title" className="text-section mt-3 text-espresso">
              Six steps from <span className="text-berry-deep">hope to evidence.</span>
            </h2>
          </Reveal>

          <nav aria-label="Steps" className="sticky top-[5.25rem] z-20 mt-10 sm:top-24">
            <ol className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-white/95 p-1.5 shadow-[var(--shadow-float)] ring-1 ring-white backdrop-blur">
              {STEPS.map((s, i) => (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    aria-current={active === s.id ? "step" : undefined}
                    className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-strawberry-ink transition-colors hover:bg-berry-soft aria-[current=step]:bg-strawberry-ink aria-[current=step]:text-white forced-colors:aria-[current=step]:[forced-color-adjust:none] forced-colors:aria-[current=step]:bg-[Highlight] forced-colors:aria-[current=step]:text-[HighlightText]"
                  >
                    <span className="tabular opacity-70">{i + 1}</span> {s.tab}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <ol className="mt-10 space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.id} id={s.id} className="scroll-mt-44">
                <Reveal className={`grid gap-4 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
                  <div className="strawberry-glow flex items-center justify-center overflow-hidden rounded-[2rem] px-6 pt-10 md:min-h-[30rem]">
                    <PhoneFrame label={s.preview} className="w-[15.5rem] translate-y-6">
                      {s.screen}
                    </PhoneFrame>
                  </div>
                  <div className="flex flex-col justify-center rounded-[2rem] bg-white p-7 sm:p-10">
                    <span className="w-fit rounded-full bg-berry-soft px-3 py-1 text-xs font-semibold text-berry-deep">
                      Step {i + 1} · {s.tag}
                    </span>
                    <h3 className="mt-5 font-display text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold leading-[1.02] text-strawberry-ink">{s.title}</h3>
                    <p className="mt-4 text-lg leading-relaxed text-ink-2">{s.body}</p>
                    <div className="mt-7">{s.cta}</div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
