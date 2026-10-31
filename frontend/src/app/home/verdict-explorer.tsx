"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, CircleDashed, Minus } from "lucide-react";
import { Dial } from "@/components/dial";
import { SourceTag } from "@/components/previews";
import { DURATION, EASE } from "@/lib/motion";

/**
 * The three kinds of answer ProofLoop gives, mirroring the backend's focus
 * outcomes (measured_improvement / measured_decline share "measured change";
 * insufficient_data is folded into the copy of "inconclusive"). Example numbers
 * only — labelled as an illustration. No outcome is presented as the expected one.
 */
const OUTCOMES = [
  {
    id: "change",
    tab: "Measured change",
    headline: "Beyond normal variation.",
    body: "The score moved further than two scans of unchanged skin usually differ — up or down, shown with the same weight. ProofLoop can't tell you why: the product, the season, sleep or your routine could all play a part.",
    dial: { baseline: 69, band: 5, current: 77 },
    caption: "Example: hydration 69 → 77, band ±5.",
    panel: "bg-night text-white",
    sub: "text-white/85",
    dialTone: "dark" as const,
  },
  {
    id: "none",
    tab: "No clear change",
    headline: "Within normal variation.",
    body: "The difference is inside the band we see between scans of unchanged skin. That's an honest answer, not a failure — many products take longer, and some don't change what a camera can measure.",
    dial: { baseline: 69, band: 5, current: 72 },
    caption: "Example: hydration 69 → 72, band ±5.",
    panel: "bg-berry-milk text-espresso",
    sub: "text-ink-2",
    dialTone: "light" as const,
  },
  {
    id: "inconclusive",
    tab: "Inconclusive",
    headline: "We can't call this one.",
    body: "The two photos were taken in conditions too different to compare fairly — usually lighting — or a measurement was missing. Re-scan in similar light for a usable answer.",
    dial: { baseline: 69, band: 5, current: undefined },
    caption: "Example: lighting differed too much, so no comparison is made.",
    panel: "bg-white text-espresso outline-2 -outline-offset-2 outline-dashed outline-line-strong",
    sub: "text-ink-2",
    dialTone: "light" as const,
  },
];

export function VerdictExplorer() {
  const [index, setIndex] = useState(1);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useReducedMotion();
  const o = OUTCOMES[index];
  const dark = o.dialTone === "dark";

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + OUTCOMES.length) % OUTCOMES.length;
    setIndex(next);
    tabs.current[next]?.focus();
  }

  return (
    <section id="verdicts" aria-labelledby="verdicts-title" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">The verdict</p>
          <h2 id="verdicts-title" className="text-section mt-4 text-espresso">
            Three honest answers. None of them guaranteed.
          </h2>
        </div>
        <p className="text-lede text-ink-2">
          Every check-in ends in one of three readings, judged against the plan you fixed on day 0. Pick one to see how the
          dial reads it.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Verdict types"
        onKeyDown={onKey}
        className="mt-10 inline-flex max-w-full flex-wrap gap-1 rounded-full bg-sunken p-1.5 ring-1 ring-line"
      >
        {OUTCOMES.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            id={`verdict-tab-${t.id}`}
            aria-selected={i === index}
            aria-controls="verdict-panel"
            tabIndex={i === index ? 0 : -1}
            onClick={() => setIndex(i)}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-2 transition-colors duration-[var(--duration-fast)] hover:text-ink aria-selected:bg-espresso aria-selected:text-white sm:px-5 forced-colors:aria-selected:[forced-color-adjust:none] forced-colors:aria-selected:bg-[Highlight] forced-colors:aria-selected:text-[HighlightText]"
          >
            {t.tab}
          </button>
        ))}
      </div>

      <div
        id="verdict-panel"
        role="tabpanel"
        aria-labelledby={`verdict-tab-${o.id}`}
        className={`grain mt-6 grid grid-cols-1 items-center gap-10 overflow-hidden rounded-[var(--radius-stage)] p-7 transition-[background-color,color] duration-[var(--duration-slow)] sm:p-12 md:grid-cols-[1.15fr_1fr] ${o.panel} ${dark ? "on-night" : ""}`}
      >
        <LazyMotion features={domAnimation} strict>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={o.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: DURATION.base, ease: EASE.outSoft }}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-11 place-items-center rounded-full ${
                    o.id === "change" ? "bg-strawberry text-white" : dark ? "bg-white/10 text-white" : "bg-white text-espresso ring-1 ring-line"
                  }`}
                >
                  {o.id === "change" ? (
                    <span className="flex"><ArrowUpRight aria-hidden className="size-4" /><ArrowDownRight aria-hidden className="size-4" /></span>
                  ) : o.id === "none" ? (
                    <Minus aria-hidden className="size-5" />
                  ) : (
                    <CircleDashed aria-hidden className="size-5" />
                  )}
                </span>
                <SourceTag kind="illustration" />
              </div>
              <h3 className="mt-6 font-display text-[clamp(2.1rem,4.4vw,3.6rem)] font-bold leading-[0.95] tracking-[-0.03em] [font-variation-settings:'wdth'_80]">
                {o.headline}
              </h3>
              <p className={`mt-4 max-w-xl text-lg leading-relaxed ${o.sub}`}>{o.body}</p>
              <p className={`mt-4 text-sm ${o.sub}`}>{o.caption}</p>
            </m.div>
          </AnimatePresence>
        </LazyMotion>
        <div>
          <div className={`mx-auto w-full max-w-sm transition-[filter,opacity] duration-[var(--duration-slow)] ${o.id === "inconclusive" ? "opacity-60 grayscale" : ""}`}>
            <Dial
              baseline={o.dial.baseline}
              band={o.dial.band}
              current={o.dial.current}
              span={14}
              label={`${o.tab} example`}
              tone={o.dialTone}
              caption={<p className={`text-sm ${o.sub}`}>{o.dial.current === undefined ? "not compared" : `vs band ±${o.dial.band}`}</p>}
            >
              <p className="tabular font-condensed text-5xl font-bold leading-none">
                {o.dial.current === undefined ? "—" : `${o.dial.current - o.dial.baseline > 0 ? "+" : ""}${o.dial.current - o.dial.baseline}`}
              </p>
            </Dial>
          </div>
          {/* How to read the dial: by shape as well as colour. */}
          <ul className={`mx-auto mt-6 grid max-w-sm grid-cols-1 gap-2 text-sm ${o.sub}`}>
            <li className="flex items-center gap-3">
              <span aria-hidden className={`h-4 w-[3px] shrink-0 rounded-full ${dark ? "bg-white" : "bg-espresso"}`} />
              Upright needle: your baseline
            </li>
            <li className="flex items-center gap-3">
              <span aria-hidden className={`h-2 w-6 shrink-0 rounded-full ${dark ? "bg-berry-milk" : "bg-[#f6bedc]"}`} />
              Berry arc: normal variation, ±{o.dial.band}
            </li>
            <li className="flex items-center gap-3">
              <span aria-hidden className="h-[3px] w-6 shrink-0 rotate-[-30deg] rounded-full bg-strawberry" />
              Red needle: the check-in, dashed while inside the band
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
