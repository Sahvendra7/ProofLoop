"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BaselineScreen, CheckinScreen, Device, FocusScreen, MatchScreen, VerdictScreen } from "@/components/previews";
import { SampleDataButton } from "../sample-data-button";

type Step = { id: string; tab: string; when: string; title: string; body: string; preview: string; screen: ReactNode; cta: ReactNode };

const linkCta = (href: string, label: string, primary = false) => (
  <Link
    href={href}
    className={
      primary
        ? "inline-flex h-12 items-center rounded-full bg-strawberry-ink px-6 font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] transition-colors hover:bg-berry-deep"
        : "inline-flex items-center gap-1.5 font-semibold text-strawberry-ink underline decoration-strawberry-ink/30 underline-offset-4 hover:decoration-strawberry-ink"
    }
  >
    {label}
  </Link>
);

const STEPS: Step[] = [
  {
    id: "step-measure",
    tab: "Measure",
    when: "Day 0",
    title: "Take one clear photo.",
    body: "Consent first, then a framing oval so your face fills the frame the way YouCam needs. Eight concerns come back in about ten seconds, with progress straight from our server.",
    preview: "Illustration of the capture screen: an oval to fill with your face",
    screen: <CheckinScreen title="Take your baseline" />,
    cta: linkCta("/scan", "Start a fair test", true),
  },
  {
    id: "step-focus",
    tab: "Focus",
    when: "Day 0",
    title: "Choose one concern to test.",
    body: "Each focus is tied to one measured score, so a later check-in can say whether it moved. One focus keeps the test fair.",
    preview: "Preview of choosing one focus from sample scores",
    screen: <FocusScreen />,
    cta: <SampleDataButton label="Try it with sample data" size="md" />,
  },
  {
    id: "step-product",
    tab: "Product",
    when: "Day 0",
    title: "Pick one product, see every reason.",
    body: "Matches come from the catalogue by explicit rules: a tier, the reasons, cautions drawn from your own scores, and anything your filters set aside.",
    preview: "Preview of two matched products from the sample catalogue",
    screen: <MatchScreen />,
    cta: linkCta("/privacy#matching", "How matching works"),
  },
  {
    id: "step-baseline",
    tab: "Baseline",
    when: "Day 0",
    title: "Save the baseline.",
    body: "Your scan becomes the reference point, together with the normal-variation band for your focus and the scores that would count as up or down. They're fixed before you start.",
    preview: "Preview of a saved baseline from sample data: hydration 69",
    screen: <BaselineScreen />,
    cta: linkCta("/scan", "Start a fair test", true),
  },
  {
    id: "step-checkin",
    tab: "Check in",
    when: "Weeks later",
    title: "Check in under the same conditions.",
    body: "Same spot, similar light, same camera. ProofLoop compares the lighting of both photos before any units are spent, refuses the baseline photo itself, and tells you when a comparison isn't fair.",
    preview: "Illustration of the check-in screen",
    screen: <CheckinScreen title="Check in" />,
    cta: linkCta("/trials", "Open my trials"),
  },
  {
    id: "step-verdict",
    tab: "Verdict",
    when: "Planned day",
    title: "Read an honest verdict.",
    body: "A measured change, no clear change, or inconclusive — with the band, the numbers and every concern for context. Never a claim about why.",
    preview: "Preview of a verdict from a synthetic demo, not a measurement",
    screen: <VerdictScreen />,
    cta: linkCta("#verdicts", "What each verdict means"),
  },
];

/**
 * Six-step product story. Desktop: the steps scroll past a sticky device whose screen follows the step in view;
 * GSAP ScrollTrigger scrubs only the progress rail and a slight device tilt (loaded on demand, desktop only,
 * never under reduced motion). Phones: the device sits above a swipeable row of step cards — no pinned scroll.
 * Everything reads in order without JavaScript or animation.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const section = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);

  // Which step is in view: vertical on desktop, horizontal scroll position on phones.
  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    let io: IntersectionObserver | null = null;
    const onScroll = () => {
      const card = ol.firstElementChild as HTMLElement | null;
      if (!card) return;
      const stride = card.offsetWidth + parseFloat(getComputedStyle(ol).columnGap || "0");
      setActive(Math.max(0, Math.min(STEPS.length - 1, Math.round(ol.scrollLeft / stride))));
    };
    const setup = () => {
      io?.disconnect();
      ol.removeEventListener("scroll", onScroll);
      if (desktop.matches && typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver(
          (entries) => {
            const hit = entries.find((e) => e.isIntersecting);
            if (hit) setActive(STEPS.findIndex((s) => s.id === hit.target.id));
          },
          { rootMargin: "-45% 0px -45% 0px" },
        );
        [...ol.children].forEach((li) => io!.observe(li));
      } else {
        ol.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      }
    };
    setup();
    desktop.addEventListener("change", setup);
    return () => {
      io?.disconnect();
      ol.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", setup);
    };
  }, []);

  // Scroll choreography (desktop, motion allowed): GSAP is imported only here, only when it will run, and only once
  // the section is within a screen of the viewport — so it is never part of the page's initial JavaScript.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!desktop || reduce || !section.current || typeof IntersectionObserver === "undefined") return;
    let cleanup = () => {};
    let cancelled = false;
    const near = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        near.disconnect();
        start();
      },
      { rootMargin: "100% 0px" },
    );
    near.observe(section.current);
    const start = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled || !section.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const trigger = { trigger: list.current, start: "top 55%", end: "bottom 55%", scrub: 0.6 };
        gsap.set(fill.current, { opacity: 1 });
        gsap.fromTo(fill.current, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: trigger });
        gsap.fromTo(
          tilt.current,
          { rotate: -3, y: 24 },
          { rotate: 2.5, y: -24, ease: "none", scrollTrigger: { ...trigger, scrub: 1.2 } },
        );
      });
      ScrollTrigger.refresh();
      cleanup = () => mm.revert();
    };
    return () => {
      cancelled = true;
      near.disconnect();
      cleanup();
    };
  }, []);

  const scrollToStep = (i: number) => {
    const ol = list.current;
    const li = ol?.children[i] as HTMLElement | undefined;
    if (!ol || !li) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ol.scrollTo({ left: li.offsetLeft - ol.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section ref={section} id="how-it-works" aria-labelledby="how-title" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title" className="text-section mt-4 text-espresso">
              Six steps from a hunch to a fair answer.
            </h2>
          </div>
          <p className="text-lede self-end text-ink-2 lg:pb-2">
            The test is set up before you know the outcome, so the result can&apos;t be talked into anything.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-8 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          {/* Stage: above the cards on phones; a sticky column on desktop. */}
          <div className="lg:order-last">
            <div className="lg:sticky lg:top-28 lg:flex lg:h-[calc(100svh-8.5rem)] lg:min-h-[34rem] lg:items-center">
              <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
                <div className="night-stage grain calibration-grid relative overflow-hidden rounded-[var(--radius-stage)] px-6 pb-8 pt-8 sm:px-10">
                  <div className="flex items-center justify-between text-xs font-semibold text-white/80">
                    <span>
                      <span className="tabular text-white">{active + 1}</span> of {STEPS.length} · {STEPS[active].tab}
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-white">{STEPS[active].when}</span>
                  </div>
                  {/* A faint dial scale behind the device ties the story back to the instrument. */}
                  <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute left-1/2 top-[55%] w-[135%] -translate-x-1/2 -translate-y-1/2 opacity-60">
                    {Array.from({ length: 49 }, (_, i) => {
                      const a = ((-120 + i * 5 - 90) * Math.PI) / 180;
                      const r1 = i % 6 === 0 ? 84 : 88;
                      const p = (r: number) => [Math.round((100 + r * Math.cos(a)) * 100) / 100, Math.round((100 + r * Math.sin(a)) * 100) / 100];
                      const [x1, y1] = p(r1);
                      const [x2, y2] = p(93);
                      const inBand = i >= 21 && i <= 27;
                      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={inBand ? "#fcd7f3" : "rgb(255 255 255 / 0.22)"} strokeWidth={i % 6 === 0 ? 1.2 : 0.7} strokeLinecap="round" />;
                    })}
                  </svg>
                  <div ref={tilt} className="relative mx-auto mt-6 w-[14.5rem] will-change-transform sm:w-[16rem]">
                    <Device className="aspect-[9/18.5]">
                      <div className="relative h-full">
                        {STEPS.map((s, i) => (
                          <figure
                            key={s.id}
                            role="img"
                            aria-label={s.preview}
                            aria-hidden={i !== active || undefined}
                            className={`absolute inset-0 transition-[opacity,transform] duration-[var(--duration-slow)] ease-[var(--ease-out-soft)] ${
                              i === active ? "opacity-100" : "pointer-events-none translate-y-3 scale-[0.98] opacity-0"
                            }`}
                          >
                            {s.screen}
                          </figure>
                        ))}
                      </div>
                    </Device>
                  </div>
                </div>

                {/* Step rail: a measuring scale on desktop, a row of steps on phones. */}
                <nav aria-label="Steps" className="mt-5">
                  <ol className="grid grid-cols-6 gap-1.5">
                    {STEPS.map((s, i) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          aria-current={i === active ? "step" : undefined}
                          onClick={(e) => {
                            if (!window.matchMedia("(min-width: 1024px)").matches) {
                              e.preventDefault();
                              scrollToStep(i);
                            }
                          }}
                          className="group flex flex-col gap-1.5 rounded-lg px-0.5 pb-1 pt-1 text-[0.72rem] font-semibold text-ink-3 transition-colors hover:text-ink aria-[current=step]:text-ink"
                        >
                          <span
                            aria-hidden
                            className="h-1.5 rounded-full bg-line-strong transition-colors duration-[var(--duration-base)] group-aria-[current=step]:bg-strawberry-ink forced-colors:group-aria-[current=step]:bg-[Highlight]"
                          />
                          <span className="truncate">{s.tab}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </div>
            </div>
          </div>

          {/* Steps. On desktop a measuring line beside them fills as you read (scrubbed by GSAP; absent without it). */}
          <div className="relative lg:pl-14">
            <span aria-hidden className="absolute bottom-[12svh] left-0 top-[12svh] hidden w-px bg-line-strong lg:block">
              <span ref={fill} className="block h-full w-[3px] -translate-x-px origin-top rounded-full bg-strawberry-ink opacity-0" />
            </span>
            <ol
              ref={list}
              className="no-scrollbar relative -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0"
            >
              {STEPS.map((s, i) => (
                <li
                  key={s.id}
                  id={s.id}
                  className="w-[84vw] max-w-[24rem] shrink-0 snap-start scroll-mt-32 lg:flex lg:min-h-[66svh] lg:w-auto lg:max-w-none lg:items-center"
                >
                  <div className="h-full rounded-[var(--radius-lg)] bg-white p-6 ring-1 ring-line sm:p-8 lg:rounded-none lg:bg-transparent lg:p-0 lg:ring-0">
                    <div className="flex items-baseline gap-4">
                      <span
                        aria-hidden
                        className={`tabular font-condensed text-5xl font-bold leading-none transition-colors duration-[var(--duration-slow)] lg:text-7xl ${
                          i === active ? "text-strawberry" : "text-strawberry lg:text-tick"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-ink-3">{s.when}</span>
                    </div>
                    <h3 className="mt-5 font-display text-[clamp(1.75rem,3.2vw,2.8rem)] font-bold leading-[1] tracking-[-0.025em] text-espresso">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.title}
                    </h3>
                    <p className="mt-4 max-w-md text-[1.05rem] leading-relaxed text-ink-2">{s.body}</p>
                    <div className="mt-7">{s.cta}</div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex justify-end gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => scrollToStep(Math.max(0, active - 1))}
                aria-label="Previous step"
                className="grid size-12 place-items-center rounded-full bg-white text-ink ring-1 ring-line-strong hover:bg-sunken"
              >
                <ArrowLeft aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollToStep(Math.min(STEPS.length - 1, active + 1))}
                aria-label="Next step"
                className="grid size-12 place-items-center rounded-full bg-espresso text-white hover:bg-night"
              >
                <ArrowRight aria-hidden className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
