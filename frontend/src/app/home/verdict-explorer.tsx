"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowDownRight, ArrowUpRight, CircleDashed, Minus } from "lucide-react";
import { Dial } from "@/components/dial";
import { SourceTag } from "@/components/previews";
import { Reveal } from "@/components/reveal";
import { CapsText } from "@/components/ui";

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
    panel: "bg-espresso text-white",
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
    panel: "bg-white text-espresso border-2 border-dashed border-line-strong",
    sub: "text-ink-2",
    dialTone: "light" as const,
  },
];

export function VerdictExplorer() {
  const [index, setIndex] = useState(1);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const o = OUTCOMES[index];

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
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="eyebrow"><CapsText>The verdict</CapsText></p>
        <h2 id="verdicts-title" className="text-section mt-3 text-espresso">
          Three honest answers. <span className="text-strawberry">None of them guaranteed.</span>
        </h2>
      </Reveal>

      <div role="tablist" aria-label="Verdict types" onKeyDown={onKey} className="mx-auto mt-10 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full bg-white p-1.5 ring-1 ring-line">
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
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-strawberry-ink transition-colors hover:bg-berry-soft aria-selected:bg-strawberry-ink aria-selected:text-white sm:px-5 forced-colors:aria-selected:[forced-color-adjust:none] forced-colors:aria-selected:bg-[Highlight] forced-colors:aria-selected:text-[HighlightText]"
          >
            {t.tab}
          </button>
        ))}
      </div>

      <div
        id="verdict-panel"
        role="tabpanel"
        aria-labelledby={`verdict-tab-${o.id}`}
        className={`mt-8 grid items-center gap-8 rounded-[2.5rem] p-7 transition-colors duration-500 sm:p-12 md:grid-cols-[1.2fr_1fr] ${o.panel}`}
      >
        <div>
          <div className="flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-full ${o.id === "change" ? "bg-strawberry text-white" : "bg-white text-espresso ring-1 ring-line"}`}>
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
          <h3 className="mt-6 font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.02]">{o.headline}</h3>
          <p className={`mt-4 max-w-xl text-lg leading-relaxed ${o.sub}`}>{o.body}</p>
          <p className={`mt-4 text-sm ${o.sub}`}>{o.caption}</p>
        </div>
        <div className={`mx-auto w-full max-w-sm ${o.id === "inconclusive" ? "opacity-60 grayscale" : ""}`}>
          <Dial
            key={o.id}
            baseline={o.dial.baseline}
            band={o.dial.band}
            current={o.dial.current}
            span={14}
            label={`${o.tab} example`}
            tone={o.dialTone}
            caption={<p className={`text-sm ${o.sub}`}>{o.dial.current === undefined ? "not compared" : `vs band ±${o.dial.band}`}</p>}
          >
            <p className="tabular font-display text-4xl font-bold">
              {o.dial.current === undefined ? "—" : `${o.dial.current - o.dial.baseline > 0 ? "+" : ""}${o.dial.current - o.dial.baseline}`}
            </p>
          </Dial>
        </div>
      </div>
    </section>
  );
}
