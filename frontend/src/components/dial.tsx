"use client";

import { useInView } from "./reveal";

/**
 * The variation dial: a tick-mark gauge centred on the baseline. Ticks inside
 * ±band are "normal variation"; a check-in outside them is a measured change.
 * Always pair it with a text explanation — the SVG is decorative to AT, and
 * the component renders its own sr-only summary.
 *
 * Colour follows the product's one rule: espresso/white = the baseline, berry = the normal-variation band,
 * strawberry = the check-in. The check-in needle turns about the hub with a CSS transition, so a changing
 * `current` (the homepage instrument) animates and can be interrupted mid-swing.
 *
 * Text placement follows the gauge geometry so it never collides with ticks:
 * `children` (the headline value) sits in the tick-free interior below the hub
 * (x 33–167 of 200 in the viewBox), and `caption` sits in the full-width clear
 * band under the lowest ticks (y > 146 of 172).
 */
export function Dial({
  baseline,
  band,
  current,
  span = 15,
  label,
  tone = "light",
  children,
  caption,
  className = "",
  beyond,
  summary: summaryOverride,
}: {
  baseline: number;
  band: number;
  current?: number;
  /** points shown either side of the baseline */
  span?: number;
  label: string;
  tone?: "light" | "dark";
  /** headline value, drawn inside the gauge */
  children?: React.ReactNode;
  /** secondary line, drawn under the gauge */
  caption?: React.ReactNode;
  className?: string;
  /** Whether the check-in is beyond the band, as decided by the server. Without it the dial classifies its own
   * illustration values (homepage examples only). */
  beyond?: boolean;
  /** Replaces the screen-reader sentence. Trial pages pass one without any classification of their own. */
  summary?: string;
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  const start = -120; // degrees, 0 = up
  const end = 120;
  const clamp = (v: number) => Math.max(baseline - span, Math.min(baseline + span, v));
  const toAngle = (v: number) => start + ((v - (baseline - span)) / (2 * span)) * (end - start);
  const ticks = Array.from({ length: 2 * span + 1 }, (_, i) => baseline - span + i);
  // Rounded so server and browser render identical attributes (no hydration mismatch).
  const round = (n: number) => Math.round(n * 100) / 100;
  const polar = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [round(100 + r * Math.cos(rad)), round(100 + r * Math.sin(rad))] as const;
  };
  const arc = (from: number, to: number, r: number) => {
    const [x1, y1] = polar(from, r);
    const [x2, y2] = polar(to, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const inBand = (v: number) => Math.abs(v - baseline) <= band;
  const outside = current !== undefined && (beyond ?? !inBand(current));
  const dark = tone === "dark";
  const muted = dark ? "rgb(255 255 255 / 0.26)" : "var(--color-tick)";
  const faint = dark ? "rgb(255 255 255 / 0.1)" : "var(--color-line)";
  const bandTick = dark ? "#fcd7f3" : "#e78bb7";
  const bandArc = dark ? "rgb(252 215 243 / 0.9)" : "#f6bedc";
  const ink = dark ? "#ffffff" : "var(--color-espresso)";
  const needle = current === undefined ? 0 : round(toAngle(clamp(current)));
  const lo = toAngle(baseline - band);
  const hi = toAngle(baseline + band);

  const summary =
    summaryOverride ??
    (current === undefined
      ? `${label}: baseline ${baseline}, normal variation plus or minus ${band} points.`
      : `${label}: baseline ${baseline}, check-in ${current}, a change of ${current - baseline > 0 ? "+" : ""}${current - baseline}. Normal variation is plus or minus ${band}, so this is ${outside ? "beyond" : "within"} normal variation.`);

  return (
    <div ref={ref} data-visible={visible} className={`relative ${className}`}>
      <svg viewBox="0 0 200 172" className="h-auto w-full overflow-visible" aria-hidden>
        {/* Scale ring and inner track */}
        <path d={arc(start, end, 97)} fill="none" stroke={faint} strokeWidth="1" />
        <path d={arc(start, end, 66)} fill="none" stroke={faint} strokeWidth="9" strokeLinecap="round" />
        {ticks.map((v, i) => {
          const a = toAngle(v);
          const major = (v - baseline) % 5 === 0;
          const [x1, y1] = polar(a, major ? 77 : 81);
          const [x2, y2] = polar(a, 92);
          const isCurrent = current !== undefined && v === current;
          return (
            <line
              key={v}
              className="dial-tick"
              style={{ ["--i" as string]: i }}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isCurrent ? "var(--color-strawberry)" : inBand(v) ? bandTick : muted}
              strokeWidth={isCurrent ? 4 : major ? 2.4 : 1.4}
              strokeLinecap="round"
            />
          );
        })}
        {/* The normal-variation band, with small edge marks at ±band */}
        <path className="dial-draw" d={arc(lo, hi, 66)} fill="none" stroke={bandArc} strokeWidth="9" strokeLinecap="round" />
        {[lo, hi].map((a) => {
          const [x1, y1] = polar(a, 58);
          const [x2, y2] = polar(a, 61);
          return <line key={a} className="dial-draw" x1={x1} y1={y1} x2={x2} y2={y2} stroke={bandTick} strokeWidth="2" strokeLinecap="round" />;
        })}
        {/* Baseline needle: the dial is centred on the baseline, so it always points straight up. */}
        <line x1="100" y1="100" x2="100" y2="44" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        {current !== undefined && (
          <g className="dial-needle" style={{ transform: `rotate(${needle}deg)` }}>
            <line
              x1="100"
              y1="104"
              x2="100"
              y2="30"
              stroke="var(--color-strawberry)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={outside ? undefined : "4 4"}
            />
          </g>
        )}
        <circle cx="100" cy="100" r="7" fill={ink} />
        <circle cx="100" cy="100" r="2.5" fill={current !== undefined ? "var(--color-strawberry)" : dark ? "var(--color-night)" : "#fff"} />
      </svg>
      <span className="sr-only">{summary}</span>
      {children && (
        // Bottom edge at y = 148/172 of the SVG; sides at x = 33 and 167 of 200.
        <div className="pointer-events-none absolute inset-x-[17%] top-0 flex aspect-[134/148] items-end justify-center text-center">
          <div className="w-full">{children}</div>
        </div>
      )}
      {caption && <div className="relative -mt-[11%] px-2 text-center">{caption}</div>}
    </div>
  );
}
