"use client";

import { useEffect, useId, useState } from "react";
import { Dial } from "@/components/dial";
import { SourceTag } from "@/components/previews";
import { motionReduced } from "@/lib/motion";
import { NOISE_BANDS, SAMPLE_SCORES, SYNTHETIC_FOLLOWUP } from "@/lib/sample";

const BASELINE: number = SAMPLE_SCORES[0].score; // hydration in the recorded sample scan: 69
const BAND = NOISE_BANDS.moisture; // ±5, measured
const FOLLOW_UP = SYNTHETIC_FOLLOWUP.moisture; // 77 in the labelled synthetic demo
const SPAN = 14;

/**
 * The homepage's one interactive moment: the variation dial as an instrument the visitor can turn. Moving the
 * example check-in across the berry band flips the reading between "within" and "beyond" normal variation —
 * the whole idea of ProofLoop in one gesture. Illustration only: the band is hydration's measured ±5, the
 * numbers come from the sample scan and synthetic demo, and nothing here is a result.
 */
export function HeroInstrument() {
  const id = useId();
  // Starts on the baseline, then swings to the demo check-in once: the page-load moment.
  const [value, setValue] = useState<number>(BASELINE);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (motionReduced()) {
      const t = requestAnimationFrame(() => setValue(FOLLOW_UP));
      return () => cancelAnimationFrame(t);
    }
    const t = setTimeout(() => setValue((v) => (v === BASELINE ? FOLLOW_UP : v)), 900);
    return () => clearTimeout(t);
  }, []);

  const delta = value - BASELINE;
  const beyond = Math.abs(delta) > BAND;
  const signed = `${delta > 0 ? "+" : ""}${delta}`;
  const reading = beyond ? "Beyond normal variation" : "Within normal variation";
  const valueText = `${value}, ${delta === 0 ? "the same as the baseline" : `${Math.abs(delta)} ${Math.abs(delta) === 1 ? "point" : "points"} ${delta > 0 ? "above" : "below"} the baseline of ${BASELINE}`}: ${reading.toLowerCase()}`;

  return (
      <div className="relative rounded-[var(--radius-xl)] bg-night-2/80 p-5 ring-1 ring-white/10 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.8)] backdrop-blur-sm sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Hydration, example trial</p>
            <p className="mt-0.5 text-xs text-white/75">Baseline {BASELINE}, normal variation ±{BAND}</p>
          </div>
          <SourceTag kind="illustration" />
        </div>

        <div className="relative mx-auto mt-2 w-full max-w-[22rem]">
          <Dial
            baseline={BASELINE}
            band={BAND}
            current={value}
            span={SPAN}
            tone="dark"
            label="Example dial"
            summary={`Example dial: baseline ${BASELINE}, normal variation plus or minus ${BAND}. Use the slider below to move the example check-in.`}
          >
            <p className="tabular font-condensed text-[clamp(2.1rem,8.5vw,2.9rem)] font-bold leading-none text-white">{value}</p>
          </Dial>
        </div>

        {/* Readout: the dial in words. Outside the dial box so it can never collide with its graphics. */}
        <dl className="mt-1 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-white/10 text-center ring-1 ring-white/10">
          {[
            ["Baseline", `${BASELINE}`],
            ["Check-in", `${value}`],
            ["Change", delta === 0 ? "0" : signed],
          ].map(([k, v]) => (
            <div key={k} className="bg-night-2 px-2 py-2.5">
              <dt className="text-[0.7rem] text-white/70">{k}</dt>
              <dd className="tabular font-condensed text-2xl font-bold text-white">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex min-h-9 items-center justify-center" aria-hidden>
          {/* Re-keyed on each change of reading, so its short CSS entrance replays only when the reading flips. */}
          <p
              key={reading}
              className={`menu-in inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                beyond ? "bg-strawberry text-white" : "bg-berry-milk text-espresso"
              }`}
            >
              <span aria-hidden className={`size-2 rounded-full ${beyond ? "bg-white" : "bg-berry-deep"}`} />
              {reading}
          </p>
        </div>

        <div className="mt-4">
          <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm font-semibold text-white">
            Move the example check-in
            <span className="text-xs font-normal text-white/70">{touched ? "" : "Try it"}</span>
          </label>
          <input
            id={id}
            type="range"
            min={BASELINE - SPAN}
            max={BASELINE + SPAN}
            step={1}
            value={value}
            aria-valuetext={valueText}
            onChange={(e) => {
              setTouched(true);
              setValue(Number(e.target.value));
            }}
            className="instrument-range mt-3 w-full"
            style={{
              ["--band-from" as string]: `${((SPAN - BAND) / (2 * SPAN)) * 100}%`,
              ["--band-to" as string]: `${((SPAN + BAND) / (2 * SPAN)) * 100}%`,
            }}
          />
          <div aria-hidden className="mt-1.5 flex justify-between text-[0.7rem] text-white/70 tabular">
            <span>{BASELINE - SPAN}</span>
            <span>band {BASELINE - BAND}–{BASELINE + BAND}</span>
            <span>{BASELINE + SPAN}</span>
          </div>
        </div>
      </div>
  );
}
